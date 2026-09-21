package com.uphead.platform.organization.api;

import com.uphead.platform.organization.application.CreateOrganizationRequest;
import com.uphead.platform.organization.application.OrganizationResponse;
import com.uphead.platform.organization.application.OrganizationService;
import com.uphead.platform.organization.application.UpdateOrganizationRequest;
import com.uphead.platform.role.application.RoleResponse;
import com.uphead.platform.role.application.RoleService;
import com.uphead.platform.user.application.UserRequest;
import com.uphead.platform.user.application.UserResponse;
import com.uphead.platform.user.application.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Reachable only by the Platform Owner role (organization.read / organization.manage). */
@RestController
@RequestMapping("/v1/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;
    private final UserService userService;
    private final RoleService roleService;

    public OrganizationController(OrganizationService organizationService, UserService userService,
                                   RoleService roleService) {
        this.organizationService = organizationService;
        this.userService = userService;
        this.roleService = roleService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('organization.manage')")
    public ResponseEntity<OrganizationResponse> createOrganization(@Valid @RequestBody CreateOrganizationRequest request) {
        return ResponseEntity.ok(organizationService.createOrganization(request));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('organization.read')")
    public ResponseEntity<Page<OrganizationResponse>> getOrganizations(
            @RequestParam(required = false) String search,
            Pageable pageable) {
        return ResponseEntity.ok(organizationService.listOrganizations(search, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('organization.read')")
    public ResponseEntity<OrganizationResponse> getOrganization(@PathVariable UUID id) {
        return ResponseEntity.ok(organizationService.getOrganization(id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('organization.manage')")
    public ResponseEntity<OrganizationResponse> updateOrganization(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateOrganizationRequest request) {
        return ResponseEntity.ok(organizationService.updateOrganization(id, request));
    }

    // --- Users within an organization ---------------------------------------------------------
    // Creating an organization already seeds its first Admin (OrganizationService.createOrganization),
    // but until this was added that was the *only* way any user could ever exist in an
    // organization: there was no recovery path if that admin's credentials were lost or never
    // used, and no way to add a second user without that admin signing in first. These let the
    // Platform Owner manage an organization's users directly, the same way it manages the
    // organization itself — organizationId comes from the path, not TenantContextHolder (a
    // platform-owner caller has none of its own).

    @GetMapping("/{id}/users")
    @PreAuthorize("hasAuthority('organization.read')")
    public ResponseEntity<Page<UserResponse>> getOrganizationUsers(@PathVariable UUID id, Pageable pageable) {
        return ResponseEntity.ok(userService.getUsersForOrganization(id, pageable));
    }

    @PostMapping("/{id}/users")
    @PreAuthorize("hasAuthority('organization.manage')")
    public ResponseEntity<UserResponse> createOrganizationUser(@PathVariable UUID id, @Valid @RequestBody UserRequest request) {
        return ResponseEntity.ok(userService.createUserForOrganization(id, request));
    }

    @PatchMapping("/{id}/users/{userId}")
    @PreAuthorize("hasAuthority('organization.manage')")
    public ResponseEntity<UserResponse> updateOrganizationUser(
            @PathVariable UUID id,
            @PathVariable UUID userId,
            @Valid @RequestBody UserRequest request) {
        return ResponseEntity.ok(userService.updateUserForOrganization(id, userId, request));
    }

    /** Role picker for the add/edit-user forms above — the organization's own roles, not the caller's (nonexistent) ones. */
    @GetMapping("/{id}/roles")
    @PreAuthorize("hasAuthority('organization.read')")
    public ResponseEntity<List<RoleResponse>> getOrganizationRoles(@PathVariable UUID id) {
        return ResponseEntity.ok(roleService.listRolesForOrganization(id));
    }
}
