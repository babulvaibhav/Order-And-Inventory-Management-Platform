package com.uphead.platform.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleResourceNotFound(
            ResourceNotFoundException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "RESOURCE_NOT_FOUND",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(InsufficientInventoryException.class)
    public ResponseEntity<ApiErrorResponse> handleInsufficientInventory(
            InsufficientInventoryException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "INSUFFICIENT_INVENTORY",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(TenantAccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleTenantAccessDenied(
            TenantAccessDeniedException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "TENANT_ACCESS_DENIED",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(InvalidStatusTransitionException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidStatusTransition(
            InvalidStatusTransitionException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "INVALID_STATUS_TRANSITION",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(RefreshTokenInvalidException.class)
    public ResponseEntity<ApiErrorResponse> handleRefreshTokenInvalid(
            RefreshTokenInvalidException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "AUTH_REFRESH_TOKEN_INVALID",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(OrganizationSuspendedException.class)
    public ResponseEntity<ApiErrorResponse> handleOrganizationSuspended(
            OrganizationSuspendedException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "ORG_SUSPENDED",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(
            ValidationException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "VALIDATION_ERROR",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(ResourceConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleResourceConflict(
            ResourceConflictException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "RESOURCE_CONFLICT",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiErrorResponse> handleBadCredentials(
            BadCredentialsException ex,
            HttpServletRequest request) {
        ApiErrorResponse response = ApiErrorResponse.of(
            "AUTH_INVALID_CREDENTIALS",
            "Invalid email or password",
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(
            AccessDeniedException ex,
            HttpServletRequest request) {
        // AccessDeniedBusinessException (a request-content-dependent check a static @PreAuthorize
        // can't express, e.g. "you can't deactivate your own account") carries a specific,
        // safe-to-show message. A raw @PreAuthorize failure doesn't carry one worth exposing, so it
        // keeps the generic message it always had. See KNOWN_LIMITATIONS.md "Addressed in this pass".
        String message = ex instanceof AccessDeniedBusinessException
            ? ex.getMessage()
            : "You do not have permission to access this resource";
        ApiErrorResponse response = ApiErrorResponse.of(
            "ACCESS_DENIED",
            message,
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining(", "));
        
        ApiErrorResponse response = ApiErrorResponse.of(
            "VALIDATION_ERROR",
            message,
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
            ConstraintViolationException ex,
            HttpServletRequest request) {
        String message = ex.getConstraintViolations().stream()
            .map(ConstraintViolation::getMessage)
            .collect(Collectors.joining(", "));
        
        ApiErrorResponse response = ApiErrorResponse.of(
            "VALIDATION_ERROR",
            message,
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiErrorResponse> handleRuntimeException(
            RuntimeException ex,
            HttpServletRequest request) {
        logger.error("Unhandled exception on {} {}", request.getMethod(), request.getRequestURI(), ex);
        ApiErrorResponse response = ApiErrorResponse.of(
            "INTERNAL_ERROR",
            ex.getMessage(),
            getRequestId(request)
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    private String getRequestId(HttpServletRequest request) {
        return request.getHeader("X-Request-ID");
    }
}
