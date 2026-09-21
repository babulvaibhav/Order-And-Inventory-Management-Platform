package com.uphead.platform.outbox.infrastructure;

import com.uphead.platform.outbox.domain.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    /**
     * The next batch of unpublished events, oldest first. {@code FOR UPDATE SKIP LOCKED} in the
     * native SQL itself (not a JPA @Lock — that's illegal on a native query, and would be
     * redundant here anyway) means multiple backend instances can run the relay concurrently
     * without double-publishing or blocking each other on the same rows — each instance simply
     * takes whatever isn't already locked by another instance's in-flight batch.
     */
    @Query(value = "SELECT * FROM outbox_events WHERE status = 'PENDING' " +
                   "ORDER BY created_at ASC LIMIT :batchSize FOR UPDATE SKIP LOCKED",
           nativeQuery = true)
    List<OutboxEvent> lockNextBatch(@Param("batchSize") int batchSize);
}
