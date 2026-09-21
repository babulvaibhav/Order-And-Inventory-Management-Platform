package com.uphead.platform.role.api;

import com.uphead.platform.role.application.PermissionResponse;
import com.uphead.platform.role.application.RoleService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The full catalog of permission codes, for building a role's permission-matrix editor. */
@RestController
@RequestMapping("/v1/permissions")
public class PermissionController {

    private final RoleService roleService;

    public PermissionController(RoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('role.read')")
    public ResponseEntity<List<PermissionResponse>> getPermissions() {
        return ResponseEntity.ok(roleService.listPermissionCatalog());
    }
}
