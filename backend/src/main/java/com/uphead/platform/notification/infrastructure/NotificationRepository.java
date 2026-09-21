package com.uphead.platform.notification.infrastructure;

import com.uphead.platform.notification.domain.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Optional<Notification> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Page<Notification> findByOrganizationId(UUID organizationId, Pageable pageable);

    Page<Notification> findByOrganizationIdAndUserId(UUID organizationId, UUID userId, Pageable pageable);

    Page<Notification> findByOrganizationIdAndUserIdAndRead(UUID organizationId, UUID userId, Boolean read, Pageable pageable);

    /** Unread notifications for this recipient: addressed to them directly, or organization-wide (userId IS NULL). */
    @Query("SELECT n FROM Notification n WHERE n.organizationId = :organizationId " +
           "AND (n.userId = :userId OR n.userId IS NULL) AND n.read = false ORDER BY n.timestamp DESC")
    List<Notification> findUnreadForRecipient(@Param("organizationId") UUID organizationId, @Param("userId") UUID userId);
}
