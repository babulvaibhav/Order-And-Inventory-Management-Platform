package com.uphead.platform.role.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.common.exception.ResourceConflictException;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.security.PermissionCodes;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.role.domain.Permission;
import com.uphead.platform.role.domain.Role;
import com.uphead.platform.role.infrastructure.PermissionRepository;
import com.uphead.platform.role.infrastructure.RoleRepository;
import com.uphead.platform.user.infrastructure.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserRepository userRepository;
    private final RolePermissionService rolePermissionService;
    private final AuditService auditService;

    public RoleService(RoleRepository roleRepository, PermissionRepository permissionRepository,
                        UserRepository userRepository, RolePermissionService rolePermissionService,
                        AuditService auditService) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.userRepository = userRepository;
        this.rolePermissionService = rolePermissionService;
        this.auditService = auditService;
    }

    public List<RoleResponse> listRoles() {
        return listRolesForOrganization(TenantContextHolder.getOrganizationId());
    }

    /**
     * Used by the Platform Owner to populate the role picker when adding a user to an
     * organization it doesn't itself belong to (the tenant-scoped {@link #listRoles()} would
     * return the platform-owner role's own — nonexistent — role list instead).
     */
    public List<RoleResponse> listRolesForOrganization(UUID organizationId) {
        return roleRepository.findByOrganizationId(organizationId).stream()
            .map(RoleResponse::from)
            .toList();
    }

    /**
     * The catalog used to build a tenant role's permission-matrix editor. Platform-only codes
     * (organization.read/organization.manage) are never included here — this endpoint is reachable
     * by any org-scoped user holding {@code role.read}, and offering those codes in the UI is what
     * let an org Admin grant itself platform-owner powers. See {@link #updatePermissions} for the
     * matching server-side rejection (defense in depth — this filter alone isn't enough since a
     * client could still submit the permission ID directly).
     */
    public List<PermissionResponse> listPermissionCatalog() {
        return permissionRepository.findAllByOrderByCategoryAscCodeAsc().stream()
            .filter(permission -> !PermissionCodes.PLATFORM_ONLY.contains(permission.getCode()))
            .map(PermissionResponse::from)
            .toList();
    }

    @Transactional
    public RoleResponse createRole(RoleRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        if (roleRepository.existsByOrganizationIdAndName(organizationId, request.name())) {
            throw new ResourceConflictException("A role named \"" + request.name() + "\" already exists");
        }

        Role role = new Role(organizationId, request.name(), false);
        Role saved = roleRepository.save(role);
        auditService.createAuditLog("ROLE_CREATED", "Role", saved.getId(), null, RoleResponse.from(saved));
        return RoleResponse.from(saved);
    }

    @Transactional
    public RoleResponse renameRole(UUID id, RoleRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        Role role = roleRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        if (role.isSystem()) {
            throw new ResourceConflictException("The default Admin/Manager/Staff roles cannot be renamed");
        }
        if (!role.getName().equals(request.name())
                && roleRepository.existsByOrganizationIdAndName(organizationId, request.name())) {
            throw new ResourceConflictException("A role named \"" + request.name() + "\" already exists");
        }

        RoleResponse before = RoleResponse.from(role);
        role.setName(request.name());
        Role saved = roleRepository.save(role);
        auditService.createAuditLog("ROLE_RENAMED", "Role", saved.getId(), before, RoleResponse.from(saved));
        return RoleResponse.from(saved);
    }

    @Transactional
    public RoleResponse updatePermissions(UUID id, RolePermissionsRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        Role role = roleRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        // A mutable HashSet, not Set.copyOf(...): Hibernate mutates a managed @ManyToMany
        // collection in place (clear + repopulate) during merge, which throws
        // UnsupportedOperationException against an immutable Set.
        Set<Permission> newPermissions = new HashSet<>(permissionRepository.findAllById(request.permissionIds()));

        // Every role reachable through this endpoint is organization-scoped (role.organizationId
        // != null — the platform-owner role has its own fixed permission set and is never edited
        // here). Reject platform-only codes outright rather than silently stripping them: a client
        // sending organization.read/organization.manage directly (bypassing the filtered catalog
        // in listPermissionCatalog) would otherwise still succeed. This is the fix for the
        // cross-tenant privilege-escalation bug — see KNOWN_LIMITATIONS.md "Addressed in this pass".
        boolean requestsPlatformOnlyCode = newPermissions.stream()
            .anyMatch(p -> PermissionCodes.PLATFORM_ONLY.contains(p.getCode()));
        if (requestsPlatformOnlyCode) {
            throw new ResourceConflictException(
                "organization.read/organization.manage cannot be granted to an organization role");
        }

        boolean keepsRoleManage = newPermissions.stream().anyMatch(p -> p.getCode().equals(PermissionCodes.ROLE_MANAGE));

        if (!keepsRoleManage) {
            boolean anotherRoleHasRoleManage = roleRepository.findByOrganizationId(organizationId).stream()
                .filter(other -> !other.getId().equals(id))
                .anyMatch(other -> other.hasPermission(PermissionCodes.ROLE_MANAGE));
            if (!anotherRoleHasRoleManage) {
                throw new ResourceConflictException(
                    "Cannot remove 'role.manage' from the last role that has it — this would lock the organization out of role management");
            }
        }

        RoleResponse before = RoleResponse.from(role);
        role.setPermissions(newPermissions);
        Role saved = roleRepository.save(role);
        rolePermissionService.evict(id);
        auditService.createAuditLog("PERMISSIONS_CHANGED", "Role", saved.getId(), before, RoleResponse.from(saved));
        return RoleResponse.from(saved);
    }

    @Transactional
    public void deleteRole(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        Role role = roleRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        if (role.isSystem()) {
            throw new ResourceConflictException("The default Admin/Manager/Staff roles cannot be deleted");
        }
        if (userRepository.countByRoleIdAndOrganizationId(id, organizationId) > 0) {
            throw new ResourceConflictException("Reassign users off this role before deleting it");
        }

        roleRepository.delete(role);
        rolePermissionService.evict(id);
        auditService.createAuditLog("ROLE_DELETED", "Role", id, RoleResponse.from(role), null);
    }

    /** Used by OrganizationService to seed the three default roles for a newly created organization. */
    @Transactional
    public Role createSystemRole(UUID organizationId, String name, List<String> permissionCodes) {
        Set<Permission> permissions = permissionRepository.findByCodeIn(permissionCodes).stream()
            .collect(Collectors.toSet());
        Role role = new Role(organizationId, name, true);
        role.setPermissions(permissions);
        return roleRepository.save(role);
    }
}
