package com.uphead.platform.inventory.domain;

import com.uphead.platform.common.util.Auditable;
import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "inventory", 
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"organization_id", "warehouse_id", "product_id"})
    },
    indexes = {
        @Index(name = "idx_inventory_organization_id", columnList = "organization_id"),
        @Index(name = "idx_inventory_warehouse_id", columnList = "warehouse_id"),
        @Index(name = "idx_inventory_product_id", columnList = "product_id")
    }
)
public class Inventory extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "available_quantity", nullable = false)
    private Integer availableQuantity = 0;

    @Column(name = "reserved_quantity", nullable = false)
    private Integer reservedQuantity = 0;

    @Version
    private Integer version;

    public Inventory() {
    }

    public Inventory(UUID organizationId, UUID warehouseId, UUID productId, Integer availableQuantity, Integer reservedQuantity) {
        this.organizationId = organizationId;
        this.warehouseId = warehouseId;
        this.productId = productId;
        this.availableQuantity = availableQuantity;
        this.reservedQuantity = reservedQuantity;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(UUID organizationId) {
        this.organizationId = organizationId;
    }

    public UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public UUID getProductId() {
        return productId;
    }

    public void setProductId(UUID productId) {
        this.productId = productId;
    }

    public Integer getAvailableQuantity() {
        return availableQuantity;
    }

    public void setAvailableQuantity(Integer availableQuantity) {
        this.availableQuantity = availableQuantity;
    }

    public Integer getReservedQuantity() {
        return reservedQuantity;
    }

    public void setReservedQuantity(Integer reservedQuantity) {
        this.reservedQuantity = reservedQuantity;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public Integer getTotalQuantity() {
        return availableQuantity + reservedQuantity;
    }
}
