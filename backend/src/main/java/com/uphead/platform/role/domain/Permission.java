package com.uphead.platform.role.domain;

import jakarta.persistence.*;
import java.util.UUID;

/**
 * Global reference data — the fixed catalog of permission codes the system understands.
 * Seeded once (V2__seed_permissions.sql), never organization-scoped.
 */
@Entity
@Table(name = "permissions")
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private String category;

    public Permission() {
    }

    public Permission(String code, String description, String category) {
        this.code = code;
        this.description = description;
        this.category = category;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }
}
