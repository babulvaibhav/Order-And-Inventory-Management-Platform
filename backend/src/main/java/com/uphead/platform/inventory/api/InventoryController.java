package com.uphead.platform.inventory.api;

import com.uphead.platform.inventory.application.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// @Validated (class-level) is required for Bean Validation annotations on @RequestParam methods
// to actually be enforced — without it, a negative quantity on reserve/release silently passed
// through, raising available stock or driving reserved negative. See KNOWN_LIMITATIONS.md
// "Addressed in this pass".
@Validated
@RestController
@RequestMapping("/v1/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('inventory.update')")
    public ResponseEntity<InventoryResponse> createInventory(@Valid @RequestBody InventoryRequest request) {
        InventoryResponse response = inventoryService.createInventory(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory.read')")
    public ResponseEntity<InventoryResponse> getInventory(@PathVariable UUID id) {
        InventoryResponse response = inventoryService.getInventory(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('inventory.read')")
    public ResponseEntity<Page<InventoryResponse>> getInventory(
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) UUID productId,
            Pageable pageable) {
        
        Page<InventoryResponse> response;
        if (warehouseId != null) {
            response = inventoryService.getInventoryByWarehouse(warehouseId, pageable);
        } else if (productId != null) {
            response = inventoryService.getInventoryByProduct(productId, pageable);
        } else {
            response = inventoryService.getInventory(pageable);
        }
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/adjust")
    @PreAuthorize("hasAuthority('inventory.update')")
    public ResponseEntity<InventoryResponse> adjustInventory(@Valid @RequestBody InventoryAdjustRequest request) {
        InventoryResponse response = inventoryService.adjustInventory(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/transfer")
    @PreAuthorize("hasAuthority('inventory.update')")
    public ResponseEntity<Void> transferInventory(@Valid @RequestBody InventoryTransferRequest request) {
        inventoryService.transferInventory(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reserve")
    @PreAuthorize("hasAuthority('inventory.update')")
    public ResponseEntity<Void> reserveInventory(
            @RequestParam UUID inventoryId,
            @RequestParam @NotNull @Positive(message = "Quantity must be positive") Integer quantity) {
        inventoryService.reserveInventory(inventoryId, quantity);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/release")
    @PreAuthorize("hasAuthority('inventory.update')")
    public ResponseEntity<Void> releaseInventory(
            @RequestParam UUID inventoryId,
            @RequestParam @NotNull @Positive(message = "Quantity must be positive") Integer quantity) {
        inventoryService.releaseInventory(inventoryId, quantity);
        return ResponseEntity.ok().build();
    }
}
