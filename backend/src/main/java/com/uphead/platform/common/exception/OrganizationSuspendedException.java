package com.uphead.platform.common.exception;

/** Thrown when a user's organization is suspended. Maps to 403 ORG_SUSPENDED. */
public class OrganizationSuspendedException extends RuntimeException {
    public OrganizationSuspendedException(String message) {
        super(message);
    }
}
