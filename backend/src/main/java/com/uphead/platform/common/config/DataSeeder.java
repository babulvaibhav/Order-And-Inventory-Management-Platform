package com.uphead.platform.common.config;

import com.uphead.platform.common.security.PermissionCodes;
import com.uphead.platform.organization.domain.Organization;
import com.uphead.platform.organization.infrastructure.OrganizationRepository;
import com.uphead.platform.role.application.RoleService;
import com.uphead.platform.role.domain.Role;
import com.uphead.platform.role.infrastructure.RoleRepository;
import com.uphead.platform.user.domain.User;
import com.uphead.platform.user.infrastructure.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataSeeder.class);

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RoleService roleService;
    private final PasswordEncoder passwordEncoder;

    private static final String DEFAULT_ORG_NAME = "Uphead Consulting Firm";
    private static final String DEFAULT_ADMIN_EMAIL = "admin@uphead.com";
    private static final String DEFAULT_ADMIN_PASSWORD = "adminPassword";
    private static final String DEFAULT_ADMIN_NAME = "Admin User";

    private static final String PLATFORM_OWNER_EMAIL = "owner@uphead.com";
    private static final String PLATFORM_OWNER_PASSWORD = "ownerPassword";
    private static final String PLATFORM_OWNER_USER_NAME = "Platform Owner";

    public DataSeeder(
            OrganizationRepository organizationRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            RoleService roleService,
            PasswordEncoder passwordEncoder
    ) {
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.roleService = roleService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        seedPlatformOwner();
        Organization organization = seedOrganization();
        seedAdminUser(organization);
    }

    private void seedPlatformOwner() {
        Role platformRole = roleRepository.findByOrganizationIdIsNullAndName(PermissionCodes.ROLE_NAME_PLATFORM_OWNER)
            .orElseGet(() -> {
                logger.info("Creating platform-level role: {}", PermissionCodes.ROLE_NAME_PLATFORM_OWNER);
                return roleService.createSystemRole(null, PermissionCodes.ROLE_NAME_PLATFORM_OWNER, PermissionCodes.PLATFORM_OWNER);
            });

        if (userRepository.findByEmail(PLATFORM_OWNER_EMAIL).isEmpty()) {
            logger.info("Creating default platform owner user: {}", PLATFORM_OWNER_EMAIL);
            User owner = new User(
                null,
                PLATFORM_OWNER_EMAIL,
                passwordEncoder.encode(PLATFORM_OWNER_PASSWORD),
                PLATFORM_OWNER_USER_NAME,
                platformRole.getId()
            );
            owner.setActive(true);
            userRepository.save(owner);
        } else {
            logger.info("Default platform owner user already exists: {}", PLATFORM_OWNER_EMAIL);
        }
    }

    private Organization seedOrganization() {
        Optional<Organization> existingOrg = organizationRepository.findByName(DEFAULT_ORG_NAME);
        if (existingOrg.isPresent()) {
            logger.info("Default organization already exists: {}", DEFAULT_ORG_NAME);
            return existingOrg.get();
        }

        logger.info("Creating default organization: {}", DEFAULT_ORG_NAME);
        Organization organization = organizationRepository.save(new Organization(DEFAULT_ORG_NAME));

        roleService.createSystemRole(organization.getId(), PermissionCodes.ROLE_NAME_ADMIN, PermissionCodes.DEFAULT_ADMIN);
        roleService.createSystemRole(organization.getId(), PermissionCodes.ROLE_NAME_MANAGER, PermissionCodes.DEFAULT_MANAGER);
        roleService.createSystemRole(organization.getId(), PermissionCodes.ROLE_NAME_STAFF, PermissionCodes.DEFAULT_STAFF);

        logger.info("Default organization and its Admin/Manager/Staff roles created successfully");
        return organization;
    }

    private void seedAdminUser(Organization organization) {
        if (userRepository.findByEmail(DEFAULT_ADMIN_EMAIL).isPresent()) {
            logger.info("Default admin user already exists: {}", DEFAULT_ADMIN_EMAIL);
            return;
        }

        Role adminRole = roleRepository.findByOrganizationIdAndName(organization.getId(), PermissionCodes.ROLE_NAME_ADMIN)
            .orElseThrow(() -> new IllegalStateException("Default organization is missing its Admin role"));

        logger.info("Creating default admin user: {}", DEFAULT_ADMIN_EMAIL);
        User adminUser = new User(
            organization.getId(),
            DEFAULT_ADMIN_EMAIL,
            passwordEncoder.encode(DEFAULT_ADMIN_PASSWORD),
            DEFAULT_ADMIN_NAME,
            adminRole.getId()
        );
        adminUser.setActive(true);
        userRepository.save(adminUser);
        logger.info("Default admin user created successfully");
    }
}
