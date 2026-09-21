package com.uphead.platform.common.exception;

/** Thrown when a refresh token is unknown, expired or revoked. Maps to 401 AUTH_REFRESH_TOKEN_INVALID. */
public class RefreshTokenInvalidException extends RuntimeException {
    public RefreshTokenInvalidException(String message) {
        super(message);
    }
}
