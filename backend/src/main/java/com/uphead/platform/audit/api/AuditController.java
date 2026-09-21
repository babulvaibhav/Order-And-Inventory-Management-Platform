package com.uphead.platform.audit.api;

import com.uphead.platform.audit.application.AuditLogResponse;
import com.uphead.platform.audit.application.AuditService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/v1/audit-logs")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('audit.read')")
    public ResponseEntity<Page<AuditLogResponse>> getAuditLogs(
            @RequestParam(required = false) String entity,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            Pageable pageable) {
        
        Page<AuditLogResponse> response;
        if (startDate != null && endDate != null) {
            response = auditService.getAuditLogsByDateRange(startDate, endDate, pageable);
        } else if (entity != null) {
            response = auditService.getAuditLogsByEntity(entity, pageable);
        } else if (action != null) {
            response = auditService.getAuditLogsByAction(action, pageable);
        } else {
            response = auditService.getAuditLogs(pageable);
        }
        
        return ResponseEntity.ok(response);
    }
}
