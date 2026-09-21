package com.uphead.platform.common.exception;

import java.time.LocalDateTime;
import java.util.UUID;

public record ApiErrorResponse(
    boolean success,
    Error error
) {
    public record Error(
        String code,
        String message,
        LocalDateTime timestamp,
        String requestId
    ) {
    }

    public static ApiErrorResponse of(String code, String message, String requestId) {
        return new ApiErrorResponse(
            false,
            new Error(code, message, LocalDateTime.now(), requestId)
        );
    }
}
