package com.uphead.platform.warehouse.infrastructure;

import com.uphead.platform.warehouse.domain.Warehouse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WarehouseRepository extends JpaRepository<Warehouse, UUID> {
    
    Optional<Warehouse> findByIdAndOrganizationId(UUID id, UUID organizationId);
    
    Page<Warehouse> findByOrganizationId(UUID organizationId, Pageable pageable);
    
    Page<Warehouse> findByOrganizationIdAndStatus(UUID organizationId, Warehouse.Status status, Pageable pageable);
    
    long countByOrganizationId(UUID organizationId);
}
