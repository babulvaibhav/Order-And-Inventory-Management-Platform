package com.uphead.platform.organization.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.common.exception.ResourceConflictException;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.security.PermissionCodes;
import com.uphead.platform.organization.domain.Organization;
import com.uphead.platform.organization.infrastructure.OrganizationRepository;
import com.uphead.platform.role.application.RoleService;
import com.uphead.platform.role.domain.Role;
import com.uphead.platform.user.domain.User;
import com.uphead.platform.user.infrastructure.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Platform-level organization lifecycle — reachable only by the Platform Owner role.
 * Deliberately not tenant-scoped by TenantContextHolder: it operates across organizations,
 * gated purely by the organization.* permissions.
 */
@Service
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final RoleService roleService;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public OrganizationService(OrganizationRepository organizationRepository, UserRepository userRepository,
                                RoleService roleService, PasswordEncoder passwordEncoder,
                                AuditService auditService) {
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.roleService = roleService;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional
    public OrganizationResponse createOrganization(CreateOrganizationRequest request) {
        if (organizationRepository.existsByName(request.organizationName())) {
            throw new ResourceConflictException("An organization named \"" + request.organizationName() + "\" already exists");
        }
        if (userRepository.existsByEmail(request.adminEmail())) {
            throw new ResourceConflictException("A user with email " + request.adminEmail() + " already exists");
        }

        Organization organization = organizationRepository.save(new Organization(request.organizationName()));

        roleService.createSystemRole(organization.getId(), PermissionCodes.ROLE_NAME_MANAGER, PermissionCodes.DEFAULT_MANAGER);
        roleService.createSystemRole(organization.getId(), PermissionCodes.ROLE_NAME_STAFF, PermissionCodes.DEFAULT_STAFF);
        Role adminRole = roleService.createSystemRole(organization.getId(), PermissionCodes.ROLE_NAME_ADMIN, PermissionCodes.DEFAULT_ADMIN);

        User admin = new User(
            organization.getId(),
            request.adminEmail(),
            passwordEncoder.encode(request.adminPassword()),
            request.adminName(),
            adminRole.getId()
        );
        userRepository.save(admin);

        auditService.createAuditLog(organization.getId(), "ORGANIZATION_CREATED", "Organization", organization.getId(), null, OrganizationResponse.from(organization));
        return OrganizationResponse.from(organization);
    }

    public Page<OrganizationResponse> listOrganizations(String search, Pageable pageable) {
        Page<Organization> page = (search != null && !search.isBlank())
            ? organizationRepository.searchByName(search, pageable)
            : organizationRepository.findAll(pageable);
        return page.map(OrganizationResponse::from);
    }

    public OrganizationResponse getOrganization(UUID id) {
        Organization organization = organizationRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
        return OrganizationResponse.from(organization);
    }

    @Transactional
    public OrganizationResponse updateOrganization(UUID id, UpdateOrganizationRequest request) {
        Organization organization = organizationRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        if (!organization.getName().equals(request.name()) && organizationRepository.existsByName(request.name())) {
            throw new ResourceConflictException("An organization named \"" + request.name() + "\" already exists");
        }

        OrganizationResponse before = OrganizationResponse.from(organization);
        organization.setName(request.name());
        organization.setStatus(request.status());
        Organization saved = organizationRepository.save(organization);

        auditService.createAuditLog(saved.getId(), "ORGANIZATION_UPDATED", "Organization", saved.getId(), before, OrganizationResponse.from(saved));
        return OrganizationResponse.from(saved);
    }
}
