package com.uphead.platform.common.util;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Runs a side effect after the enclosing transaction commits, rather than immediately at the call
 * site inside it. Used for cache eviction: evicting a cache entry mid-transaction (before commit)
 * leaves a window where a concurrent read can repopulate the cache with the pre-change value,
 * which then sits there for the rest of the cache's TTL. Deferring the evict to after commit closes
 * that window. If no transaction is active, the action just runs immediately.
 * See KNOWN_LIMITATIONS.md "Addressed in this pass" (role-permission cache eviction) and
 * DashboardCacheEvictor (same class of bug).
 */
public final class TransactionUtils {

    private TransactionUtils() {
    }

    public static void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
