package com.uphead.platform.customer.infrastructure;

import com.uphead.platform.customer.domain.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    
    Optional<Customer> findByIdAndOrganizationId(UUID id, UUID organizationId);

    // Scoped by organization — email uniqueness is per-tenant (see V4__constraints_and_indexes.sql),
    // not global. The old findByEmail(String) let one tenant's customer email block another
    // tenant from ever using the same address.
    Optional<Customer> findByEmailAndOrganizationId(String email, UUID organizationId);
    
    Page<Customer> findByOrganizationId(UUID organizationId, Pageable pageable);
    
    @Query("SELECT c FROM Customer c WHERE c.organizationId = :organizationId AND " +
           "(LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Customer> findByOrganizationIdAndSearch(
        @Param("organizationId") UUID organizationId,
        @Param("search") String search,
        Pageable pageable
    );
}
