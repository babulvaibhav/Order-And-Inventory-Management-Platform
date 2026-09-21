package com.uphead.platform.common.exception;

/**
 * For business-rule validation that Bean Validation annotations on a DTO can't express (e.g. "a
 * password is required on create but not on update", where both share one request record). Maps
 * to 400 VALIDATION_ERROR, the same code a {@code @Valid} failure produces.
 */
public class ValidationException extends RuntimeException {
    public ValidationException(String message) {
        super(message);
    }
}
