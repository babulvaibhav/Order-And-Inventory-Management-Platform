package com.uphead.platform.auth.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.auth.domain.RefreshToken;
import com.uphead.platform.auth.infrastructure.RefreshTokenRepository;
import com.uphead.platform.common.exception.OrganizationSuspendedException;
import com.uphead.platform.common.exception.RefreshTokenInvalidException;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.security.JwtUtil;
import com.uphead.platform.organization.domain.Organization;
import com.uphead.platform.organization.infrastructure.OrganizationRepository;
import com.uphead.platform.role.application.RolePermissionService;
import com.uphead.platform.role.domain.Role;
import com.uphead.platform.role.infrastructure.RoleRepository;
import com.uphead.platform.user.domain.User;
import com.uphead.platform.user.infrastructure.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final OrganizationRepository organizationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtUtil jwtUtil;
    private final RolePermissionService rolePermissionService;
    private final AuthenticationManager authenticationManager;
    private final AuditService auditService;

    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                        OrganizationRepository organizationRepository,
                        RefreshTokenRepository refreshTokenRepository,
                        JwtUtil jwtUtil, RolePermissionService rolePermissionService,
                        AuthenticationManager authenticationManager, AuditService auditService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.organizationRepository = organizationRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtUtil = jwtUtil;
        this.rolePermissionService = rolePermissionService;
        this.authenticationManager = authenticationManager;
        this.auditService = auditService;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();

        User user = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        requireOrganizationActive(user.getOrganizationId());

        Role role = roleRepository.findById(user.getRoleId())
            .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        // AGENTS.md §18 explicitly lists login as something to audit; this previously wasn't
        // wired up at all (see KNOWN_LIMITATIONS.md "Addressed in this pass"). No tenant context
        // exists yet at this point (that's set up per-request by JwtAuthenticationFilter from an
        // existing token, and there isn't one during login), so both IDs are passed explicitly.
        // audit_logs.organization_id is NOT NULL, so the platform-owner user (no organization) has
        // no row to attribute this to and is skipped rather than logged against a fake tenant.
        if (user.getOrganizationId() != null) {
            auditService.createAuditLog(user.getOrganizationId(), user.getId(), "USER_LOGIN", "User", user.getId(), null, null);
        }

        return issueSession(user, role);
    }

    @Transactional
    public LoginResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(request.refreshToken())
            .orElseThrow(() -> new RefreshTokenInvalidException("Invalid refresh token"));

        if (refreshToken.isExpired() || refreshToken.isRevoked()) {
            throw new RefreshTokenInvalidException("Refresh token is expired or revoked");
        }

        User user = userRepository.findById(refreshToken.getUserId())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new RefreshTokenInvalidException("User account is deactivated");
        }

        requireOrganizationActive(user.getOrganizationId());

        Role role = roleRepository.findById(user.getRoleId())
            .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        Set<String> permissions = rolePermissionService.getPermissions(role.getId());
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getOrganizationId(), role.getId(), role.getName());

        return new LoginResponse(
            user.getId(), user.getEmail(), user.getName(), role.getId(), role.getName(),
            user.isPlatformOwner(), user.getOrganizationId(), permissions,
            accessToken, request.refreshToken()
        );
    }

    @Transactional
    public void logout(String refreshToken) {
        RefreshToken token = refreshTokenRepository.findByToken(refreshToken)
            .orElseThrow(() -> new RefreshTokenInvalidException("Invalid refresh token"));

        token.setRevokedAt(LocalDateTime.now());
        refreshTokenRepository.save(token);

        userRepository.findById(token.getUserId()).ifPresent(user -> {
            if (user.getOrganizationId() != null) {
                auditService.createAuditLog(user.getOrganizationId(), user.getId(), "USER_LOGOUT", "User", user.getId(), null, null);
            }
        });
    }

    private void requireOrganizationActive(UUID organizationId) {
        if (organizationId == null) {
            return; // platform-owner user, not scoped to an organization
        }
        Organization organization = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
        if (organization.getStatus() != Organization.Status.ACTIVE) {
            throw new OrganizationSuspendedException("This organization has been suspended");
        }
    }

    private LoginResponse issueSession(User user, Role role) {
        Set<String> permissions = rolePermissionService.getPermissions(role.getId());

        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getOrganizationId(), role.getId(), role.getName());
        String refreshTokenString = jwtUtil.generateRefreshToken(user.getId());

        refreshTokenRepository.save(new RefreshToken(user.getId(), refreshTokenString, LocalDateTime.now().plusDays(7)));

        return new LoginResponse(
            user.getId(), user.getEmail(), user.getName(), role.getId(), role.getName(),
            user.isPlatformOwner(), user.getOrganizationId(), permissions,
            accessToken, refreshTokenString
        );
    }
}
