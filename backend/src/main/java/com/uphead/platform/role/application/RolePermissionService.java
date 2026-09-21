package com.uphead.platform.role.application;

import com.uphead.platform.common.util.TransactionUtils;
import com.uphead.platform.role.domain.Permission;
import com.uphead.platform.role.infrastructure.RoleRepository;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Resolves a role's permission codes, cached (same Redis-backed {@code @Cacheable} mechanism as
 * the dashboard cache) so authorization stays fast without baking permissions into the JWT.
 * <p>
 * This is what makes role-permission edits take effect immediately: the JWT authentication filter
 * calls {@link #getPermissions(UUID)} on every request instead of trusting a value stored in the
 * token at login time. Any endpoint that changes a role's permission set must
 * evict this cache entry via {@link #evict(UUID)}.
 */
@Service
public class RolePermissionService {

    private final RoleRepository roleRepository;
    private final CacheManager cacheManager;

    public RolePermissionService(RoleRepository roleRepository, CacheManager cacheManager) {
        this.roleRepository = roleRepository;
        this.cacheManager = cacheManager;
    }

    @Cacheable(cacheNames = "role-permissions", key = "#roleId")
    public Set<String> getPermissions(UUID roleId) {
        return roleRepository.findById(roleId)
            .map(role -> role.getPermissions().stream().map(Permission::getCode).collect(Collectors.toSet()))
            .orElseGet(Set::of);
    }

    /**
     * Deferred to after the caller's transaction commits (not a declarative {@code @CacheEvict},
     * which would run synchronously mid-transaction): evicting before commit leaves a window where
     * a concurrent request re-populates the cache with the about-to-be-stale permission set, which
     * then sits there for the rest of the cache's TTL. See KNOWN_LIMITATIONS.md "Addressed in this
     * pass".
     */
    public void evict(UUID roleId) {
        TransactionUtils.runAfterCommit(() -> {
            Cache cache = cacheManager.getCache("role-permissions");
            if (cache != null) {
                cache.evict(roleId);
            }
        });
    }
}
