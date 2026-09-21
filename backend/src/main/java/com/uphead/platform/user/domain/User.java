package com.uphead.platform.user.domain;

import jakarta.persistence.*;
import com.uphead.platform.common.util.Auditable;
import java.util.UUID;

@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_users_organization_id", columnList = "organization_id"),
    @Index(name = "idx_users_role_id", columnList = "role_id")
})
public class User extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** NULL only for the platform-owner user(s), who are not scoped to any single organization. */
    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String name;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @Column(nullable = false)
    private Boolean active = true;

    public User() {
    }

    public User(UUID organizationId, String email, String password, String name, UUID roleId) {
        this.organizationId = organizationId;
        this.email = email;
        this.password = password;
        this.name = name;
        this.roleId = roleId;
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public UUID getRoleId() {
        return roleId;
    }

    public void setRoleId(UUID roleId) {
        this.roleId = roleId;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public boolean isPlatformOwner() {
        return organizationId == null;
    }
}
