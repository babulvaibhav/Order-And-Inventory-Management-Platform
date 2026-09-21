package com.uphead.platform.warehouse.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.dashboard.application.DashboardCacheEvictor;
import com.uphead.platform.warehouse.domain.Warehouse;
import com.uphead.platform.warehouse.infrastructure.WarehouseRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;
    private final AuditService auditService;
    private final DashboardCacheEvictor dashboardCacheEvictor;

    public WarehouseService(WarehouseRepository warehouseRepository, AuditService auditService,
                             DashboardCacheEvictor dashboardCacheEvictor) {
        this.warehouseRepository = warehouseRepository;
        this.auditService = auditService;
        this.dashboardCacheEvictor = dashboardCacheEvictor;
    }

    @Transactional
    public WarehouseResponse createWarehouse(WarehouseRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Warehouse warehouse = new Warehouse(
            organizationId,
            request.name(),
            request.address()
        );

        if (request.status() != null) {
            warehouse.setStatus(request.status());
        }

        Warehouse saved = warehouseRepository.save(warehouse);
        WarehouseResponse response = WarehouseResponse.from(saved);
        auditService.createAuditLog("WAREHOUSE_CREATED", "Warehouse", saved.getId(), null, response);
        dashboardCacheEvictor.evict(organizationId);
        return response;
    }

    @Transactional
    public WarehouseResponse updateWarehouse(UUID id, WarehouseRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Warehouse warehouse = warehouseRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found"));

        WarehouseResponse before = WarehouseResponse.from(warehouse);
        warehouse.setName(request.name());
        warehouse.setAddress(request.address());

        if (request.status() != null) {
            warehouse.setStatus(request.status());
        }

        Warehouse saved = warehouseRepository.save(warehouse);
        WarehouseResponse response = WarehouseResponse.from(saved);
        auditService.createAuditLog("WAREHOUSE_UPDATED", "Warehouse", saved.getId(), before, response);
        dashboardCacheEvictor.evict(organizationId);
        return response;
    }

    @Transactional
    public void disableWarehouse(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Warehouse warehouse = warehouseRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found"));

        WarehouseResponse before = WarehouseResponse.from(warehouse);
        warehouse.setStatus(Warehouse.Status.DISABLED);
        Warehouse saved = warehouseRepository.save(warehouse);
        auditService.createAuditLog("WAREHOUSE_DISABLED", "Warehouse", id, before, WarehouseResponse.from(saved));
        dashboardCacheEvictor.evict(organizationId);
    }

    public WarehouseResponse getWarehouse(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        Warehouse warehouse = warehouseRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found"));
        
        return WarehouseResponse.from(warehouse);
    }

    public Page<WarehouseResponse> getWarehouses(Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return warehouseRepository.findByOrganizationId(organizationId, pageable)
            .map(WarehouseResponse::from);
    }

    public Page<WarehouseResponse> getWarehousesByStatus(Warehouse.Status status, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return warehouseRepository.findByOrganizationIdAndStatus(organizationId, status, pageable)
            .map(WarehouseResponse::from);
    }
}
