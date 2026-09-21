package com.uphead.platform.user.infrastructure;

import com.uphead.platform.user.domain.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByIdAndOrganizationId(UUID id, UUID organizationId);
    Page<User> findByOrganizationId(UUID organizationId, Pageable pageable);
    boolean existsByEmail(String email);
    long countByRoleIdAndOrganizationId(UUID roleId, UUID organizationId);
}
