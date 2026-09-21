package com.uphead.platform.user.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.common.exception.AccessDeniedBusinessException;
import com.uphead.platform.common.exception.ResourceConflictException;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.exception.ValidationException;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.role.domain.Role;
import com.uphead.platform.role.infrastructure.RoleRepository;
import com.uphead.platform.user.domain.User;
import com.uphead.platform.user.infrastructure.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserService(UserRepository userRepository, RoleRepository roleRepository,
                        PasswordEncoder passwordEncoder, AuditService auditService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional
    public UserResponse createUser(UserRequest request) {
        return createUserInOrganization(TenantContextHolder.getOrganizationId(), request);
    }

    /**
     * Used by the Platform Owner to add a user directly to an organization it doesn't itself
     * belong to (a platform-owner caller has no organizationId of its own, so it can't reach the
     * tenant-scoped {@link #createUser}). Without this, creating an organization's first Admin at
     * {@code POST /organizations} was the *only* way any user could ever be added to it — there
     * was no recovery path if that admin's credentials were lost, and no way to add a second user
     * before that admin ever signed in. See {@code OrganizationController} for the endpoint.
     */
    @Transactional
    public UserResponse createUserForOrganization(UUID organizationId, UserRequest request) {
        return createUserInOrganization(organizationId, request);
    }

    private UserResponse createUserInOrganization(UUID organizationId, UserRequest request) {
        // UserRequest.password isn't @NotBlank (see its Javadoc — the same DTO is reused for
        // update, where a blank password means "leave it unchanged"), so create must check this
        // itself: a genuinely new user always needs a password.
        if (request.password() == null || request.password().isBlank()) {
            throw new ValidationException("Password is required");
        }

        if (userRepository.existsByEmail(request.email())) {
            throw new ResourceConflictException("A user with email " + request.email() + " already exists");
        }
        Role role = requireOwnOrgRole(request.roleId(), organizationId);

        User user = new User(
            organizationId,
            request.email(),
            passwordEncoder.encode(request.password()),
            request.name(),
            role.getId()
        );

        User savedUser = userRepository.save(user);
        UserResponse response = UserResponse.from(savedUser, role.getName());
        auditService.createAuditLog(organizationId, "USER_CREATED", "User", savedUser.getId(), null, response);
        return response;
    }

    public UserResponse getUser(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        User user = userRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toResponse(user);
    }

    public Page<UserResponse> getUsers(Pageable pageable) {
        return getUsersForOrganization(TenantContextHolder.getOrganizationId(), pageable);
    }

    /** Used by the Platform Owner to see who already exists in an organization before adding more. */
    public Page<UserResponse> getUsersForOrganization(UUID organizationId, Pageable pageable) {
        return userRepository.findByOrganizationId(organizationId, pageable)
            .map(this::toResponse);
    }

    @Transactional
    public UserResponse updateUser(UUID id, UserRequest request) {
        return updateUserInOrganization(TenantContextHolder.getOrganizationId(), id, request);
    }

    /** Used by the Platform Owner — e.g. to reset a forgotten password or change a role for a user in an organization it doesn't belong to. */
    @Transactional
    public UserResponse updateUserForOrganization(UUID organizationId, UUID id, UserRequest request) {
        return updateUserInOrganization(organizationId, id, request);
    }

    private UserResponse updateUserInOrganization(UUID organizationId, UUID id, UserRequest request) {
        User user = userRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!user.getEmail().equals(request.email()) && userRepository.existsByEmail(request.email())) {
            throw new ResourceConflictException("A user with email " + request.email() + " already exists");
        }
        Role role = requireOwnOrgRole(request.roleId(), organizationId);

        UserResponse before = toResponse(user);

        user.setEmail(request.email());
        if (request.password() != null && !request.password().isEmpty()) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }
        user.setName(request.name());
        user.setRoleId(role.getId());

        User updatedUser = userRepository.save(user);
        UserResponse after = UserResponse.from(updatedUser, role.getName());
        auditService.createAuditLog(organizationId, "USER_UPDATED", "User", updatedUser.getId(), before, after);
        return after;
    }

    @Transactional
    public void deleteUser(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        // Without this, an Admin (or anyone holding user.manage) could deactivate their own only
        // account and lock the organization out of user management entirely.
        if (id.equals(TenantContextHolder.getUserId())) {
            throw new AccessDeniedBusinessException("You cannot deactivate your own account");
        }

        User user = userRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UserResponse before = toResponse(user);
        user.setActive(false);
        userRepository.save(user);
        auditService.createAuditLog("USER_DEACTIVATED", "User", id, before, null);
    }

    public UserResponse getCurrentUser(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toResponse(user);
    }

    private Role requireOwnOrgRole(UUID roleId, UUID organizationId) {
        return roleRepository.findByIdAndOrganizationId(roleId, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Role not found in this organization"));
    }

    private UserResponse toResponse(User user) {
        String roleName = roleRepository.findById(user.getRoleId()).map(Role::getName).orElse(null);
        return UserResponse.from(user, roleName);
    }
}
