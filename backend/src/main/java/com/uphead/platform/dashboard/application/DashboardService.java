package com.uphead.platform.dashboard.application;

import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.customer.domain.Customer;
import com.uphead.platform.customer.infrastructure.CustomerRepository;
import com.uphead.platform.inventory.application.InventoryService;
import com.uphead.platform.inventory.infrastructure.InventoryRepository;
import com.uphead.platform.order.domain.Order;
import com.uphead.platform.order.infrastructure.OrderRepository;
import com.uphead.platform.product.infrastructure.ProductRepository;
import com.uphead.platform.warehouse.infrastructure.WarehouseRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private final ProductRepository productRepository;
    private final WarehouseRepository warehouseRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;

    public DashboardService(ProductRepository productRepository, WarehouseRepository warehouseRepository,
                          InventoryRepository inventoryRepository, OrderRepository orderRepository,
                          CustomerRepository customerRepository) {
        this.productRepository = productRepository;
        this.warehouseRepository = warehouseRepository;
        this.inventoryRepository = inventoryRepository;
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
    }

    // Key format matches what AGENTS.md §22 and README document (dashboard:{organizationId}:summary)
    // — it was previously Spring's default derivation (dashboard::getDashboardSummary-<orgId>)
    // instead, which nothing outside this class could predict or reason about. Must stay in sync
    // with DashboardCacheEvictor's key expression. See KNOWN_LIMITATIONS.md "Addressed in this pass".
    @Cacheable(value = "dashboard", key = "'dashboard:' + T(com.uphead.platform.common.tenant.TenantContextHolder).getOrganizationId() + ':summary'")
    public DashboardSummaryResponse getDashboardSummary() {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        long totalProducts = productRepository.countByOrganizationId(organizationId);
        long totalWarehouses = warehouseRepository.countByOrganizationId(organizationId);
        long totalAvailableInventory = inventoryRepository.sumAvailableQuantityByOrganizationId(organizationId);
        long pendingOrders = orderRepository.countByOrganizationIdAndStatus(organizationId, Order.Status.PENDING);
        long completedOrders = orderRepository.countByOrganizationIdAndStatus(organizationId, Order.Status.COMPLETED);
        // Was a second hardcoded `10` here, independent of InventoryService's own threshold —
        // the two could silently drift. See KNOWN_LIMITATIONS.md "Addressed in this pass".
        long lowStockProducts = inventoryRepository.countLowStockByOrganizationId(organizationId, InventoryService.LOW_STOCK_THRESHOLD);

        List<Order> recentOrders = orderRepository.findTop5ByOrganizationIdOrderByCreatedAtDesc(organizationId);
        List<DashboardSummaryResponse.RecentOrder> recentOrderResponses = recentOrders.stream()
                .map(order -> {
                    Customer customer = customerRepository.findById(order.getCustomerId()).orElse(null);
                    return new DashboardSummaryResponse.RecentOrder(
                            order.getId(),
                            customer != null ? customer.getName() : "Unknown",
                            order.getTotalAmount(),
                            order.getStatus().name()
                    );
                })
                .collect(Collectors.toList());

        return new DashboardSummaryResponse(
                totalProducts,
                totalWarehouses,
                totalAvailableInventory,
                pendingOrders,
                completedOrders,
                lowStockProducts,
                recentOrderResponses
        );
    }
}
