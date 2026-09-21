package com.uphead.platform.product.infrastructure;

import com.uphead.platform.product.domain.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    
    Optional<Product> findByIdAndOrganizationId(UUID id, UUID organizationId);
    
    Page<Product> findByOrganizationId(UUID organizationId, Pageable pageable);
    
    @Query("SELECT p FROM Product p WHERE p.organizationId = :organizationId AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.sku) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Product> findByOrganizationIdAndSearch(
        @Param("organizationId") UUID organizationId,
        @Param("search") String search,
        Pageable pageable
    );
    
    Page<Product> findByOrganizationIdAndStatus(UUID organizationId, Product.Status status, Pageable pageable);
    
    boolean existsByOrganizationIdAndSku(UUID organizationId, String sku);
    
    long countByOrganizationId(UUID organizationId);
}
