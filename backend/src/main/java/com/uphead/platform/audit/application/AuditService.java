package com.uphead.platform.audit.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.uphead.platform.audit.domain.AuditLog;
import com.uphead.platform.audit.infrastructure.AuditLogRepository;
import com.uphead.platform.common.tenant.TenantContextHolder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void createAuditLog(String action, String entity, UUID entityId,
                             Object oldValue, Object newValue) {
        createAuditLog(TenantContextHolder.getOrganizationId(), action, entity, entityId, oldValue, newValue);
    }

    /**
     * Used by platform-owner actions (e.g. creating/updating an organization), where the caller has
     * no organizationId of their own — the entry is attributed to the affected organization instead.
     */
    @Transactional
    public void createAuditLog(UUID organizationId, String action, String entity, UUID entityId,
                             Object oldValue, Object newValue) {
        createAuditLog(organizationId, TenantContextHolder.getUserId(), action, entity, entityId, oldValue, newValue);
    }

    /**
     * Fully explicit form, for the one case where neither the organizationId nor the userId comes
     * from {@link TenantContextHolder}: login/logout run before any JWT exists, so no tenant
     * context has been set yet by the time {@code AuthService} needs to write the audit entry.
     */
    @Transactional
    public void createAuditLog(UUID organizationId, UUID userId, String action, String entity, UUID entityId,
                             Object oldValue, Object newValue) {
        JsonNode oldJson = oldValue != null ? objectMapper.valueToTree(oldValue) : NullNode.getInstance();
        JsonNode newJson = newValue != null ? objectMapper.valueToTree(newValue) : NullNode.getInstance();

        AuditLog auditLog = new AuditLog(organizationId, userId, action, entity, entityId, oldJson, newJson);
        auditLogRepository.save(auditLog);
    }

    public Page<AuditLogResponse> getAuditLogs(Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return auditLogRepository.findByOrganizationId(organizationId, pageable)
            .map(AuditLogResponse::from);
    }

    public Page<AuditLogResponse> getAuditLogsByEntity(String entity, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return auditLogRepository.findByOrganizationIdAndEntity(organizationId, entity, pageable)
            .map(AuditLogResponse::from);
    }

    public Page<AuditLogResponse> getAuditLogsByAction(String action, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return auditLogRepository.findByOrganizationIdAndAction(organizationId, action, pageable)
            .map(AuditLogResponse::from);
    }

    public Page<AuditLogResponse> getAuditLogsByDateRange(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return auditLogRepository.findByOrganizationIdAndTimestampBetween(organizationId, startDate, endDate, pageable)
            .map(AuditLogResponse::from);
    }
}
