package com.uphead.platform.order.infrastructure;

import com.uphead.platform.order.domain.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    Optional<Order> findByIdAndOrganizationId(UUID id, UUID organizationId);

    /**
     * Atomic compare-and-swap on status — only succeeds if the row is still in
     * {@code expectedStatus}. Guards against two concurrent requests (e.g. two PENDING->CANCELLED
     * calls for the same order) both passing a plain read-then-write status check and both
     * running the same side effects (a double inventory release). affectedRows == 0 means the
     * order was already transitioned by someone else since it was read.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Order o SET o.status = :newStatus " +
           "WHERE o.id = :id AND o.organizationId = :organizationId AND o.status = :expectedStatus")
    int updateStatusIfCurrent(
        @Param("id") UUID id,
        @Param("organizationId") UUID organizationId,
        @Param("expectedStatus") Order.Status expectedStatus,
        @Param("newStatus") Order.Status newStatus
    );
    
    Page<Order> findByOrganizationId(UUID organizationId, Pageable pageable);
    
    Page<Order> findByOrganizationIdAndStatus(UUID organizationId, Order.Status status, Pageable pageable);
    
    @Query("SELECT o FROM Order o WHERE o.organizationId = :organizationId AND " +
           "o.customerId IN (SELECT c.id FROM Customer c WHERE " +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Order> findByOrganizationIdAndCustomerSearch(
        @Param("organizationId") UUID organizationId,
        @Param("search") String search,
        Pageable pageable
    );
    
    long countByOrganizationIdAndStatus(UUID organizationId, Order.Status status);
    
    List<Order> findTop5ByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);
}
