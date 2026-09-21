package com.uphead.platform.dashboard.application;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record DashboardSummaryResponse(
    Long totalProducts,
    Long totalWarehouses,
    Long totalAvailableInventory,
    Long pendingOrders,
    Long completedOrders,
    Long lowStockProducts,
    List<RecentOrder> recentOrders
) {
    public record RecentOrder(
        UUID id,
        String customerName,
        BigDecimal totalAmount,
        String status
    ) {
    }
}
