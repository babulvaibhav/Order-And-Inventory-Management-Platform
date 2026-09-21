package com.uphead.platform.common.tenant;

import java.util.Set;
import java.util.UUID;

public class TenantContextHolder {
    
    private static final ThreadLocal<TenantContext> CONTEXT = new ThreadLocal<>();
    
    public static void setContext(TenantContext context) {
        CONTEXT.set(context);
    }
    
    public static TenantContext getContext() {
        return CONTEXT.get();
    }
    
    public static UUID getUserId() {
        TenantContext context = CONTEXT.get();
        return context != null ? context.userId() : null;
    }
    
    public static UUID getOrganizationId() {
        TenantContext context = CONTEXT.get();
        return context != null ? context.organizationId() : null;
    }
    
    public static Set<String> getPermissions() {
        TenantContext context = CONTEXT.get();
        return context != null ? context.permissions() : null;
    }
    
    public static boolean hasPermission(String permission) {
        TenantContext context = CONTEXT.get();
        return context != null && context.permissions().contains(permission);
    }
    
    public static void clear() {
        CONTEXT.remove();
    }
}
