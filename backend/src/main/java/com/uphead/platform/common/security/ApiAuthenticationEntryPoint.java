package com.uphead.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uphead.platform.common.exception.ApiErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Without this, Spring Security's default behavior for an unauthenticated request (no token, a
 * malformed token, or one that fails signature/expiry validation in
 * {@link JwtAuthenticationFilter}) is a bare 403 with an empty body — not spec-correct (the
 * assignment's error-code list expects 401 + {@code AUTH_TOKEN_EXPIRED} for this case) and
 * unhelpful to a client trying to tell "not logged in" apart from "logged in but forbidden".
 * See KNOWN_LIMITATIONS.md "Addressed in this pass".
 */
@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public ApiAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException, ServletException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiErrorResponse body = ApiErrorResponse.of(
            "AUTH_TOKEN_EXPIRED",
            "Authentication is required and has either not been provided or is no longer valid",
            request.getHeader("X-Request-ID")
        );
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
