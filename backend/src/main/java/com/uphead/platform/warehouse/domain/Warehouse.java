package com.uphead.platform.warehouse.domain;

import jakarta.persistence.*;
import com.uphead.platform.common.util.Auditable;
import java.util.UUID;

@Entity
@Table(name = "warehouses", indexes = {
    @Index(name = "idx_warehouses_organization_id", columnList = "organization_id")
})
public class Warehouse extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID organizationId;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    public enum Status {
        ACTIVE,
        DISABLED
    }

    public Warehouse() {
    }

    public Warehouse(UUID organizationId, String name, String address) {
        this.organizationId = organizationId;
        this.name = name;
        this.address = address;
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }
}
