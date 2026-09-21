package com.uphead.platform.role.infrastructure;

import com.uphead.platform.role.domain.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    List<Permission> findByCodeIn(Iterable<String> codes);

    Optional<Permission> findByCode(String code);

    List<Permission> findAllByOrderByCategoryAscCodeAsc();
}
