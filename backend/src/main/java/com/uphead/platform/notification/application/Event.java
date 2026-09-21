package com.uphead.platform.notification.application;

import java.util.UUID;

public record Event(
    String type,
    UUID organizationId,
    UUID userId,
    Object data
) {
}
