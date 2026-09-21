package com.uphead.platform.role.domain;

import com.uphead.platform.common.util.Auditable;
import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A named, permission-bearing role.
 * <p>
 * {@code organizationId == null} marks the single global platform-level role (Platform Owner),
 * which manages organizations rather than tenant data. Every organization is seeded with three
 * {@code isSystem} roles (Admin/Manager/Staff) that cannot be renamed or deleted, but whose
 * permission set — like any custom role's — can be freely edited via the role management API.
 */
@Entity
@Table(name = "roles",
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_roles_org_name", columnNames = {"organization_id", "name"})
       },
       indexes = {
           @Index(name = "idx_roles_organization_id", columnList = "organization_id")
       })
public class Role extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(nullable = false)
    private String name;

    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "role_permissions",
        joinColumns = @JoinColumn(name = "role_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    private Set<Permission> permissions = new HashSet<>();

    public Role() {
    }

    public Role(UUID organizationId, String name, boolean isSystem) {
        this.organizationId = organizationId;
        this.name = name;
        this.isSystem = isSystem;
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

    public boolean isSystem() {
        return isSystem;
    }

    public void setSystem(boolean system) {
        isSystem = system;
    }

    public Set<Permission> getPermissions() {
        return permissions;
    }

    public void setPermissions(Set<Permission> permissions) {
        this.permissions = permissions;
    }

    public boolean hasPermission(String code) {
        return permissions.stream().anyMatch(p -> p.getCode().equals(code));
    }
}
