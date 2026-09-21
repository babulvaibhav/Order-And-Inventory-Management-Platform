package com.uphead.platform.warehouse.api;

import com.uphead.platform.warehouse.application.WarehouseRequest;
import com.uphead.platform.warehouse.application.WarehouseResponse;
import com.uphead.platform.warehouse.application.WarehouseService;
import com.uphead.platform.warehouse.domain.Warehouse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/v1/warehouses")
public class WarehouseController {

    private final WarehouseService warehouseService;

    public WarehouseController(WarehouseService warehouseService) {
        this.warehouseService = warehouseService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('warehouse.write')")
    public ResponseEntity<WarehouseResponse> createWarehouse(@Valid @RequestBody WarehouseRequest request) {
        WarehouseResponse response = warehouseService.createWarehouse(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('warehouse.read')")
    public ResponseEntity<WarehouseResponse> getWarehouse(@PathVariable UUID id) {
        WarehouseResponse response = warehouseService.getWarehouse(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('warehouse.read')")
    public ResponseEntity<Page<WarehouseResponse>> getWarehouses(
            @RequestParam(required = false) Warehouse.Status status,
            Pageable pageable) {
        
        Page<WarehouseResponse> response;
        if (status != null) {
            response = warehouseService.getWarehousesByStatus(status, pageable);
        } else {
            response = warehouseService.getWarehouses(pageable);
        }
        
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('warehouse.write')")
    public ResponseEntity<WarehouseResponse> updateWarehouse(
            @PathVariable UUID id,
            @Valid @RequestBody WarehouseRequest request) {
        WarehouseResponse response = warehouseService.updateWarehouse(id, request);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/disable")
    @PreAuthorize("hasAuthority('warehouse.write')")
    public ResponseEntity<Void> disableWarehouse(@PathVariable UUID id) {
        warehouseService.disableWarehouse(id);
        return ResponseEntity.ok().build();
    }
}
