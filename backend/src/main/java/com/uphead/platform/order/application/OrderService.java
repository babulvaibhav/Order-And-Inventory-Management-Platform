package com.uphead.platform.order.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.common.config.RabbitMQConfig;
import com.uphead.platform.common.exception.AccessDeniedBusinessException;
import com.uphead.platform.common.exception.InsufficientInventoryException;
import com.uphead.platform.common.exception.InvalidStatusTransitionException;
import com.uphead.platform.common.exception.ResourceConflictException;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.security.PermissionCodes;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.customer.domain.Customer;
import com.uphead.platform.customer.infrastructure.CustomerRepository;
import com.uphead.platform.dashboard.application.DashboardCacheEvictor;
import com.uphead.platform.inventory.application.InventoryService;
import com.uphead.platform.inventory.domain.Inventory;
import com.uphead.platform.inventory.infrastructure.InventoryRepository;
import com.uphead.platform.notification.application.Event;
import com.uphead.platform.notification.application.port.EventPublisher;
import com.uphead.platform.order.domain.Order;
import com.uphead.platform.order.domain.OrderItem;
import com.uphead.platform.order.infrastructure.OrderRepository;
import com.uphead.platform.product.domain.Product;
import com.uphead.platform.product.infrastructure.ProductRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;
    private final EventPublisher eventPublisher;
    private final AuditService auditService;
    private final DashboardCacheEvictor dashboardCacheEvictor;

    public OrderService(OrderRepository orderRepository, CustomerRepository customerRepository,
                       ProductRepository productRepository, InventoryRepository inventoryRepository,
                       InventoryService inventoryService, EventPublisher eventPublisher,
                       AuditService auditService, DashboardCacheEvictor dashboardCacheEvictor) {
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
        this.dashboardCacheEvictor = dashboardCacheEvictor;
    }

    @Transactional
    public OrderResponse createOrder(OrderRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Customer customer = customerRepository.findByIdAndOrganizationId(request.customerId(), organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        // Look up products server-side — price and status must never be trusted from the client.
        Map<UUID, Product> productsById = request.items().stream()
            .map(OrderItemRequest::productId)
            .distinct()
            .collect(Collectors.toMap(id -> id, id -> productRepository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id))));

        productsById.values().stream()
            .filter(product -> product.getStatus() == Product.Status.DISABLED)
            .findFirst()
            .ifPresent(product -> {
                throw new ResourceConflictException("Product \"" + product.getName() + "\" is disabled and cannot be ordered");
            });

        // Prepare inventory reservations - sort by (inventory ID, request) pairs together, not by
        // index into two independently-ordered lists. Sorting a separate inventories list and then
        // re-pairing it with request.items() by position (the previous bug) reserves item A's
        // requested quantity against item B's inventory row as soon as the sort reorders anything.
        record ReservationLine(Inventory inventory, OrderItemRequest itemRequest) {
        }
        List<ReservationLine> reservationLines = new ArrayList<>();
        for (OrderItemRequest itemRequest : request.items()) {
            Inventory inventory = inventoryRepository.findByOrganizationIdAndWarehouseIdAndProductId(
                organizationId, itemRequest.warehouseId(), itemRequest.productId()
            ).orElseThrow(() -> new ResourceNotFoundException("Inventory not found for warehouse and product"));

            reservationLines.add(new ReservationLine(inventory, itemRequest));
        }
        reservationLines.sort(Comparator.comparing(line -> line.inventory().getId()));

        BigDecimal totalAmount = BigDecimal.ZERO;
        Order order = new Order(organizationId, customer.getId(), BigDecimal.ZERO, request.notes());
        order.setStatus(Order.Status.PENDING);

        for (ReservationLine line : reservationLines) {
            OrderItemRequest itemRequest = line.itemRequest();
            Inventory inventory = line.inventory();
            Product product = productsById.get(itemRequest.productId());

            try {
                inventoryService.reserveInventory(inventory.getId(), itemRequest.quantity());
            } catch (InsufficientInventoryException e) {
                // Rollback happens automatically via @Transactional.
                throw new InsufficientInventoryException("INSUFFICIENT_INVENTORY for product: " + itemRequest.productId());
            }

            BigDecimal unitPrice = product.getPrice();
            OrderItem orderItem = new OrderItem(itemRequest.productId(), itemRequest.quantity(), unitPrice, itemRequest.warehouseId());
            order.addItem(orderItem);
            totalAmount = totalAmount.add(orderItem.getTotalPrice());
        }
        order.setTotalAmount(totalAmount);

        Order savedOrder = orderRepository.save(order);
        OrderResponse response = OrderResponse.from(savedOrder);

        auditService.createAuditLog("ORDER_CREATED", "Order", savedOrder.getId(), null, response);
        eventPublisher.publishEvent(RabbitMQConfig.ORDER_CREATED_ROUTING_KEY,
            new Event("ORDER_CREATED", organizationId, null, response));
        // Pending-orders count changed (reserveInventory above already evicted for the
        // available-inventory count, but that doesn't cover this one).
        dashboardCacheEvictor.evict(organizationId);

        return response;
    }

    @Transactional
    public OrderResponse updateOrderStatus(UUID id, Order.Status newStatus) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Order order = orderRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        Order.Status currentStatus = order.getStatus();
        if (!isValidStatusTransition(currentStatus, newStatus)) {
            throw new InvalidStatusTransitionException("Invalid status transition from " + currentStatus + " to " + newStatus);
        }

        // Cancelling is gated by order.cancel; every other forward transition only needs order.create
        // (which STAFF also holds, per the assignment's "Staff: process orders" role description).
        String requiredPermission = newStatus == Order.Status.CANCELLED ? PermissionCodes.ORDER_CANCEL : PermissionCodes.ORDER_CREATE;
        if (!TenantContextHolder.hasPermission(requiredPermission)) {
            throw new AccessDeniedBusinessException("Missing permission: " + requiredPermission);
        }

        OrderResponse before = OrderResponse.from(order);
        // Force-load the items before the compare-and-swap update below clears the persistence
        // context (Order.items is lazy; the detached `order` reference can't load it afterward).
        List<OrderItem> items = new ArrayList<>(order.getItems());

        // Atomic compare-and-swap: only succeeds if the order is still in `currentStatus`. This is
        // what stops two concurrent requests (e.g. two PENDING->CANCELLED calls racing each other)
        // from both passing the transition check above and both running the inventory side effect
        // below — a double release/consume. See KNOWN_LIMITATIONS.md "Addressed in this pass".
        int updated = orderRepository.updateStatusIfCurrent(id, organizationId, currentStatus, newStatus);
        if (updated == 0) {
            throw new InvalidStatusTransitionException(
                "Order status changed concurrently — expected " + currentStatus + ", please retry");
        }

        if (newStatus == Order.Status.CANCELLED) {
            for (OrderItem item : items) {
                if (item.getWarehouseId() != null) {
                    inventoryRepository.findByOrganizationIdAndWarehouseIdAndProductId(
                        organizationId, item.getWarehouseId(), item.getProductId()
                    ).ifPresent(inventory -> inventoryService.releaseInventory(inventory.getId(), item.getQuantity()));
                }
            }
        } else if (newStatus == Order.Status.COMPLETED) {
            // The stock has shipped: consume the reservation for good instead of leaving
            // reservedQuantity to grow without bound (previously not handled at all — see
            // KNOWN_LIMITATIONS.md "Addressed in this pass").
            for (OrderItem item : items) {
                if (item.getWarehouseId() != null) {
                    inventoryRepository.findByOrganizationIdAndWarehouseIdAndProductId(
                        organizationId, item.getWarehouseId(), item.getProductId()
                    ).ifPresent(inventory -> inventoryService.consumeReservedInventory(inventory.getId(), item.getQuantity()));
                }
            }
        }

        // Re-fetch: the compare-and-swap's clearAutomatically detached the entity loaded above.
        Order saved = orderRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        OrderResponse response = OrderResponse.from(saved);

        auditService.createAuditLog("ORDER_STATUS_CHANGED", "Order", saved.getId(), before, response);
        if (newStatus == Order.Status.CANCELLED) {
            eventPublisher.publishEvent(RabbitMQConfig.ORDER_CANCELLED_ROUTING_KEY,
                new Event("ORDER_CANCELLED", organizationId, null, response));
        }
        // Pending/completed-orders counts changed (the CANCELLED branch's releaseInventory call
        // above already evicted for the available-inventory count, but not for these).
        dashboardCacheEvictor.evict(organizationId);

        return response;
    }

    // readOnly transactions: Order.items is lazy and open-in-view is disabled, so the Hibernate
    // session must still be open while OrderResponse.from(...) reads it — without this the mapping
    // throws LazyInitializationException as soon as an order has any items.
    @Transactional(readOnly = true)
    public OrderResponse getOrder(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Order order = orderRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        return OrderResponse.from(order);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> getOrders(Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        return orderRepository.findByOrganizationId(organizationId, pageable)
            .map(OrderResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> getOrdersByStatus(Order.Status status, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        return orderRepository.findByOrganizationIdAndStatus(organizationId, status, pageable)
            .map(OrderResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> searchOrders(String search, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        return orderRepository.findByOrganizationIdAndCustomerSearch(organizationId, search, pageable)
            .map(OrderResponse::from);
    }

    private boolean isValidStatusTransition(Order.Status current, Order.Status newStatus) {
        return switch (current) {
            case PENDING -> newStatus == Order.Status.CONFIRMED || newStatus == Order.Status.CANCELLED;
            case CONFIRMED -> newStatus == Order.Status.PROCESSING || newStatus == Order.Status.CANCELLED;
            case PROCESSING -> newStatus == Order.Status.COMPLETED;
            case COMPLETED -> false;
            case CANCELLED -> false;
        };
    }
}
