package com.uphead.platform.common.security;

import com.uphead.platform.common.tenant.TenantContext;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.organization.domain.Organization;
import com.uphead.platform.organization.infrastructure.OrganizationRepository;
import com.uphead.platform.role.application.RolePermissionService;
import com.uphead.platform.user.domain.User;
import com.uphead.platform.user.infrastructure.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Resolves the authenticated principal's permissions from the database on every request
 * (via {@link RolePermissionService}, cached per role) rather than trusting a snapshot baked
 * into the JWT at login time — this is what makes a role-permission edit or an organization
 * suspension take effect immediately for every already-signed-in user of that role/org.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final RolePermissionService rolePermissionService;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, UserRepository userRepository,
                                    OrganizationRepository organizationRepository,
                                    RolePermissionService rolePermissionService) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.rolePermissionService = rolePermissionService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            if (jwtUtil.validateToken(token) && !jwtUtil.isRefreshToken(token)) {
                UUID userId = jwtUtil.getUserIdFromToken(token);
                UUID organizationId = jwtUtil.getOrganizationIdFromToken(token);

                boolean organizationOk = organizationId == null || organizationRepository.findById(organizationId)
                    .map(org -> org.getStatus() == Organization.Status.ACTIVE)
                    .orElse(false);

                if (organizationOk) {
                    // Resolve permissions from the user's *current* roleId, not the token's — the
                    // user row is already loaded here, so this costs nothing extra and makes a
                    // role *reassignment* (not just a permission edit on the same role) take effect
                    // immediately too, instead of waiting for the access token to expire. See
                    // KNOWN_LIMITATIONS.md "Addressed in this pass".
                    userRepository.findById(userId)
                        .filter(User::getActive)
                        .ifPresent(user -> authenticate(request, user, organizationId, user.getRoleId()));
                }
            }
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            TenantContextHolder.clear();
        }
    }

    private void authenticate(HttpServletRequest request, User user, UUID organizationId, UUID roleId) {
        Set<String> permissions = rolePermissionService.getPermissions(roleId);

        Set<SimpleGrantedAuthority> authorities = permissions.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(user, null, authorities);
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);

        TenantContextHolder.setContext(TenantContext.of(user.getId(), organizationId, permissions));
    }
}
