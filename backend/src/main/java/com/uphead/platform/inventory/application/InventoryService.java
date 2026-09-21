package com.uphead.platform.inventory.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.common.config.RabbitMQConfig;
import com.uphead.platform.common.exception.InsufficientInventoryException;
import com.uphead.platform.common.exception.ResourceConflictException;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.dashboard.application.DashboardCacheEvictor;
import com.uphead.platform.inventory.domain.Inventory;
import com.uphead.platform.inventory.infrastructure.InventoryRepository;
import com.uphead.platform.notification.application.Event;
import com.uphead.platform.notification.application.port.EventPublisher;
import com.uphead.platform.product.infrastructure.ProductRepository;
import com.uphead.platform.warehouse.infrastructure.WarehouseRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
public class InventoryService {

    /** Matches the threshold DashboardService uses to count "low stock" rows. */
    public static final int LOW_STOCK_THRESHOLD = 10;

    private final InventoryRepository inventoryRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;
    private final EventPublisher eventPublisher;
    private final AuditService auditService;
    private final DashboardCacheEvictor dashboardCacheEvictor;

    public InventoryService(InventoryRepository inventoryRepository, WarehouseRepository warehouseRepository,
                             ProductRepository productRepository, EventPublisher eventPublisher,
                             AuditService auditService, DashboardCacheEvictor dashboardCacheEvictor) {
        this.inventoryRepository = inventoryRepository;
        this.warehouseRepository = warehouseRepository;
        this.productRepository = productRepository;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
        this.dashboardCacheEvictor = dashboardCacheEvictor;
    }

    @Transactional
    public InventoryResponse createInventory(InventoryRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        // Defense in depth: the warehouse/product FKs in the schema are single-column, so nothing
        // at the DB level stops a row referencing another tenant's warehouse/product. Confirm both
        // belong to the caller's organization before creating the inventory row.
        warehouseRepository.findByIdAndOrganizationId(request.warehouseId(), organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found"));
        productRepository.findByIdAndOrganizationId(request.productId(), organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        Inventory existing = inventoryRepository.findByOrganizationIdAndWarehouseIdAndProductId(
            organizationId, request.warehouseId(), request.productId()
        ).orElse(null);

        if (existing != null) {
            throw new ResourceConflictException("Inventory already exists for this warehouse and product");
        }

        Inventory inventory = new Inventory(
            organizationId,
            request.warehouseId(),
            request.productId(),
            request.quantity(),
            0
        );

        Inventory saved = inventoryRepository.save(inventory);
        InventoryResponse response = InventoryResponse.from(saved);
        auditService.createAuditLog("INVENTORY_CREATED", "Inventory", saved.getId(), null, response);
        dashboardCacheEvictor.evict(organizationId);
        return response;
    }

    @Transactional
    public InventoryResponse adjustInventory(InventoryAdjustRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Inventory before = inventoryRepository.findByIdAndOrganizationId(request.inventoryId(), organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Inventory not found"));
        InventoryResponse beforeResponse = InventoryResponse.from(before);

        // Atomic conditional update — never a read-modify-write, so concurrent adjustments can't lose an update.
        int affectedRows = request.quantity() >= 0
            ? inventoryRepository.addInventory(request.inventoryId(), organizationId, request.quantity())
            : inventoryRepository.subtractInventory(request.inventoryId(), organizationId, -request.quantity());

        if (affectedRows == 0) {
            throw new InsufficientInventoryException("Insufficient inventory for adjustment");
        }

        Inventory saved = inventoryRepository.findByIdAndOrganizationId(request.inventoryId(), organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Inventory not found"));
        InventoryResponse response = InventoryResponse.from(saved);

        auditService.createAuditLog("INVENTORY_ADJUSTED", "Inventory", saved.getId(), beforeResponse, response);
        eventPublisher.publishEvent(RabbitMQConfig.INVENTORY_UPDATED_ROUTING_KEY,
            new Event("INVENTORY_UPDATED", organizationId, null, response));
        publishLowStockIfNeeded(organizationId, saved);
        dashboardCacheEvictor.evict(organizationId);

        return response;
    }

    @Transactional
    public void transferInventory(InventoryTransferRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        if (request.sourceWarehouseId().equals(request.destinationWarehouseId())) {
            throw new ResourceConflictException("Source and destination warehouses cannot be the same");
        }

        // Defense in depth: confirm both warehouses and the product belong to the caller's
        // organization before touching any inventory row.
        warehouseRepository.findByIdAndOrganizationId(request.sourceWarehouseId(), organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Source warehouse not found"));
        warehouseRepository.findByIdAndOrganizationId(request.destinationWarehouseId(), organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Destination warehouse not found"));
        productRepository.findByIdAndOrganizationId(request.productId(), organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        Inventory source = inventoryRepository.findByOrganizationIdAndWarehouseIdAndProductId(
            organizationId, request.sourceWarehouseId(), request.productId()
        ).orElseThrow(() -> new ResourceNotFoundException("Source inventory not found"));

        Inventory destination = inventoryRepository.findByOrganizationIdAndWarehouseIdAndProductId(
            organizationId, request.destinationWarehouseId(), request.productId()
        ).orElse(null);

        // Deterministic lock order between the two existing rows (lower UUID first) so two
        // transfers running in opposite directions (A->B and B->A) can't deadlock at the database
        // level. Only matters when both rows already exist; a brand-new destination row has
        // nothing to lock against yet.
        boolean sourceFirst = destination == null || source.getId().compareTo(destination.getId()) <= 0;

        if (sourceFirst) {
            debitSource(source, organizationId, request.quantity());
            creditDestination(destination, organizationId, request);
        } else {
            creditDestination(destination, organizationId, request);
            debitSource(source, organizationId, request.quantity());
        }

        Inventory refreshedSource = inventoryRepository.findByIdAndOrganizationId(source.getId(), organizationId).orElse(source);

        auditService.createAuditLog("INVENTORY_TRANSFERRED", "Inventory", source.getId(),
            Map.of("productId", request.productId(), "from", request.sourceWarehouseId(), "to", request.destinationWarehouseId(), "quantity", request.quantity()),
            null);
        eventPublisher.publishEvent(RabbitMQConfig.INVENTORY_TRANSFER_ROUTING_KEY,
            new Event("INVENTORY_TRANSFER_COMPLETED", organizationId, null, Map.of(
                "productId", request.productId(),
                "sourceWarehouseId", request.sourceWarehouseId(),
                "destinationWarehouseId", request.destinationWarehouseId(),
                "quantity", request.quantity()
            )));
        publishLowStockIfNeeded(organizationId, refreshedSource);
        dashboardCacheEvictor.evict(organizationId);
    }

    private void debitSource(Inventory source, UUID organizationId, Integer quantity) {
        // Atomic, floor-guarded debit — replaces the old read-then-write (lost-update race).
        int debited = inventoryRepository.subtractInventory(source.getId(), organizationId, quantity);
        if (debited == 0) {
            throw new InsufficientInventoryException("Insufficient inventory in source warehouse");
        }
    }

    private void creditDestination(Inventory destination, UUID organizationId, InventoryTransferRequest request) {
        if (destination == null) {
            inventoryRepository.save(new Inventory(
                organizationId, request.destinationWarehouseId(), request.productId(), request.quantity(), 0
            ));
        } else {
            inventoryRepository.addInventory(destination.getId(), organizationId, request.quantity());
        }
    }

    @Transactional
    public void reserveInventory(UUID inventoryId, Integer quantity) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        // ATOMIC RESERVATION - Critical for concurrency control
        int affectedRows = inventoryRepository.reserveInventory(inventoryId, organizationId, quantity);

        if (affectedRows == 0) {
            throw new InsufficientInventoryException("Requested quantity is unavailable");
        }

        inventoryRepository.findByIdAndOrganizationId(inventoryId, organizationId)
            .ifPresent(inventory -> publishLowStockIfNeeded(organizationId, inventory));
        dashboardCacheEvictor.evict(organizationId);
    }

    @Transactional
    public void releaseInventory(UUID inventoryId, Integer quantity) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        int affectedRows = inventoryRepository.releaseInventory(inventoryId, organizationId, quantity);

        if (affectedRows == 0) {
            throw new ResourceConflictException("Failed to release inventory - insufficient reserved quantity");
        }
        dashboardCacheEvictor.evict(organizationId);
    }

    /**
     * Finalizes a reservation when an order completes: the stock has shipped, so it comes off
     * {@code reservedQuantity} for good rather than going back to {@code availableQuantity}
     * (that's {@link #releaseInventory}, used for cancellations instead). Without this,
     * reservedQuantity for completed orders is never cleared and grows without bound.
     */
    @Transactional
    public void consumeReservedInventory(UUID inventoryId, Integer quantity) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        int affectedRows = inventoryRepository.consumeReservedInventory(inventoryId, organizationId, quantity);

        if (affectedRows == 0) {
            throw new ResourceConflictException("Failed to consume reservation - insufficient reserved quantity");
        }
    }

    public InventoryResponse getInventory(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Inventory inventory = inventoryRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Inventory not found"));

        return InventoryResponse.from(inventory);
    }

    public Page<InventoryResponse> getInventory(Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        return inventoryRepository.findByOrganizationId(organizationId, pageable)
            .map(InventoryResponse::from);
    }

    public Page<InventoryResponse> getInventoryByWarehouse(UUID warehouseId, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        return inventoryRepository.findByOrganizationIdAndWarehouseId(organizationId, warehouseId, pageable)
            .map(InventoryResponse::from);
    }

    public Page<InventoryResponse> getInventoryByProduct(UUID productId, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        return inventoryRepository.findByOrganizationIdAndProductId(organizationId, productId, pageable)
            .map(InventoryResponse::from);
    }

    private void publishLowStockIfNeeded(UUID organizationId, Inventory inventory) {
        if (inventory.getAvailableQuantity() < LOW_STOCK_THRESHOLD) {
            eventPublisher.publishEvent(RabbitMQConfig.INVENTORY_LOW_ROUTING_KEY,
                new Event("INVENTORY_LOW", organizationId, null, Map.of(
                    "productId", inventory.getProductId(),
                    "warehouseId", inventory.getWarehouseId(),
                    "remainingQuantity", inventory.getAvailableQuantity()
                )));
        }
    }
}
