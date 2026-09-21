package com.uphead.platform.common.exception;

/** Thrown for duplicate/conflicting resources (e.g. a SKU or email already used). Maps to 409 RESOURCE_CONFLICT. */
public class ResourceConflictException extends RuntimeException {
    public ResourceConflictException(String message) {
        super(message);
    }
}
