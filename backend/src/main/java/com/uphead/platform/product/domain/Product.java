package com.uphead.platform.product.domain;

import jakarta.persistence.*;
import com.uphead.platform.common.util.Auditable;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "products", 
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_products_org_sku", columnNames = {"organization_id", "sku"})
       },
       indexes = {
           @Index(name = "idx_products_organization_id", columnList = "organization_id"),
           @Index(name = "idx_products_status", columnList = "organization_id, status"),
           @Index(name = "idx_products_created_at", columnList = "organization_id, created_at")
       })
public class Product extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID organizationId;

    @Column(nullable = false)
    private String sku;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    public enum Status {
        ACTIVE,
        DISABLED
    }

    public Product() {
    }

    public Product(UUID organizationId, String sku, String name, String description, BigDecimal price) {
        this.organizationId = organizationId;
        this.sku = sku;
        this.name = name;
        this.description = description;
        this.price = price;
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

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }
}
