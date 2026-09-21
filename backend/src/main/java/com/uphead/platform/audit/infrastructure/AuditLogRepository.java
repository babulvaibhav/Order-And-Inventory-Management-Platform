package com.uphead.platform.audit.infrastructure;

import com.uphead.platform.audit.domain.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    
    Page<AuditLog> findByOrganizationId(UUID organizationId, Pageable pageable);
    
    Page<AuditLog> findByOrganizationIdAndEntity(UUID organizationId, String entity, Pageable pageable);
    
    Page<AuditLog> findByOrganizationIdAndAction(UUID organizationId, String action, Pageable pageable);
    
    @Query("SELECT a FROM AuditLog a WHERE a.organizationId = :organizationId AND " +
           "a.timestamp BETWEEN :startDate AND :endDate")
    Page<AuditLog> findByOrganizationIdAndTimestampBetween(
        @Param("organizationId") UUID organizationId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        Pageable pageable
    );
}
