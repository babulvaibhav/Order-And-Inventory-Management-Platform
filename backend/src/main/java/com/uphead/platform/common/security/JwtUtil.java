package com.uphead.platform.common.security;

import io.jsonwebtoken.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.KeyPair;
import java.security.interfaces.RSAPublicKey;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtUtil {

    @Value("${spring.security.jwt.expiration}")
    private Long expiration;

    @Value("${spring.security.jwt.refresh-expiration}")
    private Long refreshExpiration;

    private final KeyPair jwtKeyPair;

    public JwtUtil(KeyPair jwtKeyPair) {
        if (jwtKeyPair == null || jwtKeyPair.getPrivate() == null || jwtKeyPair.getPublic() == null) {
            throw new IllegalStateException("RSA KeyPair is required but not available");
        }
        this.jwtKeyPair = jwtKeyPair;
    }

    /**
     * Access token claims deliberately carry no permission list: permissions are resolved from the
     * database per request (via RolePermissionService, cached) so a role-permission edit takes
     * effect on the very next request instead of only after the token is refreshed.
     *
     * @param organizationId null for the platform-owner role, which is not scoped to one organization
     */
    public String generateAccessToken(UUID userId, UUID organizationId, UUID roleId, String roleName) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        JwtBuilder builder = Jwts.builder()
                .subject(userId.toString())
                .claim("roleId", roleId.toString())
                .claim("role", roleName)
                .issuedAt(now)
                .expiration(expiryDate);
        if (organizationId != null) {
            builder.claim("organizationId", organizationId.toString());
        }
        return builder.signWith(jwtKeyPair.getPrivate(), Jwts.SIG.RS256).compact();
    }

    public String generateRefreshToken(UUID userId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + refreshExpiration);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("type", "refresh")
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(jwtKeyPair.getPrivate(), Jwts.SIG.RS256)
                .compact();
    }

    public UUID getUserIdFromToken(String token) {
        Claims claims = parseClaims(token);
        return UUID.fromString(claims.getSubject());
    }

    /** Null for a platform-owner token. */
    public UUID getOrganizationIdFromToken(String token) {
        Claims claims = parseClaims(token);
        String organizationId = claims.get("organizationId", String.class);
        return organizationId != null ? UUID.fromString(organizationId) : null;
    }

    public UUID getRoleIdFromToken(String token) {
        Claims claims = parseClaims(token);
        return UUID.fromString(claims.get("roleId", String.class));
    }

    public String getRoleNameFromToken(String token) {
        Claims claims = parseClaims(token);
        return claims.get("role", String.class);
    }

    public boolean isRefreshToken(String token) {
        Claims claims = parseClaims(token);
        return "refresh".equals(claims.get("type", String.class));
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith((RSAPublicKey) jwtKeyPair.getPublic())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
