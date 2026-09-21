package com.uphead.platform.notification.application.strategy;

import com.uphead.platform.notification.application.Event;

import java.util.Map;

/** Small helper shared by the strategies: Event.data() round-trips through JSON as a plain Map. */
final class EventPayload {

    private EventPayload() {
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> asMap(Event event) {
        return event.data() instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    static String field(Event event, String key) {
        Object value = asMap(event).get(key);
        return value != null ? String.valueOf(value) : "unknown";
    }
}
