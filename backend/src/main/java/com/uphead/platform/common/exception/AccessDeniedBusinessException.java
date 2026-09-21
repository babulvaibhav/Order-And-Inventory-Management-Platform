package com.uphead.platform.common.exception;

import org.springframework.security.access.AccessDeniedException;

/**
 * Authorization checks that depend on request content (e.g. the target status of an order
 * transition) can't be expressed as a single static {@code @PreAuthorize}. Services throw this
 * instead; it extends Spring Security's own AccessDeniedException so it is handled identically
 * (403 ACCESS_DENIED) by the existing exception handler.
 */
public class AccessDeniedBusinessException extends AccessDeniedException {
    public AccessDeniedBusinessException(String message) {
        super(message);
    }
}
