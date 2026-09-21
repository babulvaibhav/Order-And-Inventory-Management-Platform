package com.uphead.platform.order.api;

import com.uphead.platform.order.application.*;
import com.uphead.platform.order.domain.Order;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('order.create')")
    public ResponseEntity<OrderResponse> createOrder(@Valid @RequestBody OrderRequest request) {
        OrderResponse response = orderService.createOrder(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('order.read')")
    public ResponseEntity<OrderResponse> getOrder(@PathVariable UUID id) {
        OrderResponse response = orderService.getOrder(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('order.read')")
    public ResponseEntity<Page<OrderResponse>> getOrders(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Order.Status status,
            Pageable pageable) {
        
        Page<OrderResponse> response;
        if (search != null && !search.isEmpty()) {
            response = orderService.searchOrders(search, pageable);
        } else if (status != null) {
            response = orderService.getOrdersByStatus(status, pageable);
        } else {
            response = orderService.getOrders(pageable);
        }
        
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('order.create') or hasAuthority('order.cancel')")
    // The service enforces order.cancel specifically for CANCELLED and order.create for every
    // other transition — a single static annotation can't branch on the request body's target status.
    public ResponseEntity<OrderResponse> updateOrderStatus(
            @PathVariable UUID id,
            @Valid @RequestBody OrderStatusUpdateRequest request) {
        OrderResponse response = orderService.updateOrderStatus(id, request.status());
        return ResponseEntity.ok(response);
    }
}
