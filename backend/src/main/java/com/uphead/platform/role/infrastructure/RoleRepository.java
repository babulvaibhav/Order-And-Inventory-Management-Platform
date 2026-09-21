package com.uphead.platform.role.infrastructure;

import com.uphead.platform.role.domain.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByIdAndOrganizationId(UUID id, UUID organizationId);

    List<Role> findByOrganizationId(UUID organizationId);

    Optional<Role> findByOrganizationIdAndName(UUID organizationId, String name);

    boolean existsByOrganizationIdAndName(UUID organizationId, String name);

    /** The single global platform-level role (organization_id IS NULL). */
    Optional<Role> findByOrganizationIdIsNullAndName(String name);

    long countByIdInAndOrganizationId(Iterable<UUID> ids, UUID organizationId);
}
