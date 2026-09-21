package com.uphead.platform.role.api;

import com.uphead.platform.role.application.RolePermissionsRequest;
import com.uphead.platform.role.application.RoleRequest;
import com.uphead.platform.role.application.RoleResponse;
import com.uphead.platform.role.application.RoleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/roles")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    // Also reachable with user.manage alone: assigning a user to a role requires the role list
    // (the user form's role picker), so a custom role that manages users but wasn't separately
    // given role.read shouldn't be unable to see role names at all. See KNOWN_LIMITATIONS.md
    // "Addressed in this pass" and frontend hooks/useLookups.ts (useRoleLookup), which mirrors
    // this same OR condition.
    @GetMapping
    @PreAuthorize("hasAuthority('role.read') or hasAuthority('user.manage')")
    public ResponseEntity<List<RoleResponse>> getRoles() {
        return ResponseEntity.ok(roleService.listRoles());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('role.manage')")
    public ResponseEntity<RoleResponse> createRole(@Valid @RequestBody RoleRequest request) {
        return ResponseEntity.ok(roleService.createRole(request));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('role.manage')")
    public ResponseEntity<RoleResponse> renameRole(@PathVariable UUID id, @Valid @RequestBody RoleRequest request) {
        return ResponseEntity.ok(roleService.renameRole(id, request));
    }

    @PatchMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('role.manage')")
    public ResponseEntity<RoleResponse> updatePermissions(
            @PathVariable UUID id,
            @Valid @RequestBody RolePermissionsRequest request) {
        return ResponseEntity.ok(roleService.updatePermissions(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('role.manage')")
    public ResponseEntity<Void> deleteRole(@PathVariable UUID id) {
        roleService.deleteRole(id);
        return ResponseEntity.ok().build();
    }
}
