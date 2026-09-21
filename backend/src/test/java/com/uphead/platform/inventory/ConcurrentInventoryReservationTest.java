package com.uphead.platform.inventory;

import com.uphead.platform.common.tenant.TenantContext;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.inventory.application.InventoryService;
import com.uphead.platform.inventory.domain.Inventory;
import com.uphead.platform.inventory.infrastructure.InventoryRepository;
import com.uphead.platform.organization.domain.Organization;
import com.uphead.platform.organization.infrastructure.OrganizationRepository;
import com.uphead.platform.product.domain.Product;
import com.uphead.platform.product.infrastructure.ProductRepository;
import com.uphead.platform.role.domain.Role;
import com.uphead.platform.role.infrastructure.RoleRepository;
import com.uphead.platform.user.domain.User;
import com.uphead.platform.user.infrastructure.UserRepository;
import com.uphead.platform.warehouse.domain.Warehouse;
import com.uphead.platform.warehouse.infrastructure.WarehouseRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Testcontainers
class ConcurrentInventoryReservationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    private UUID organizationId;
    private UUID userId;
    private UUID inventoryId;

    @BeforeEach
    void setUp() {
        // Unique per test: rows from earlier tests stay in the (throwaway) container, since
        // notifications written from low-stock events reference the organization, so it can't
        // simply be deleted afterwards.
        String suffix = UUID.randomUUID().toString();

        // Create test organization
        Organization organization = new Organization("Test Org " + suffix);
        organization = organizationRepository.save(organization);
        organizationId = organization.getId();

        // Create a role (its actual permission set doesn't matter here — TenantContext is set directly below)
        Role role = roleRepository.save(new Role(organizationId, "Admin", true));

        // Create test user
        User user = new User(organizationId, "test-" + suffix + "@example.com", "password", "Test User", role.getId());
        user = userRepository.save(user);
        userId = user.getId();

        // Create test product
        Product product = new Product(organizationId, "SKU-001", "Test Product", "Description", java.math.BigDecimal.valueOf(100.00));
        product = productRepository.save(product);

        // Create test warehouse
        Warehouse warehouse = new Warehouse(organizationId, "Test Warehouse", "Test Address");
        warehouse = warehouseRepository.save(warehouse);

        // Create inventory with 10 units
        Inventory inventory = new Inventory(organizationId, warehouse.getId(), product.getId(), 10, 0);
        inventory = inventoryRepository.save(inventory);
        inventoryId = inventory.getId();

        // Set tenant context
        TenantContextHolder.setContext(
            new com.uphead.platform.common.tenant.TenantContext(
                userId,
                organizationId,
                java.util.Set.of("inventory.update")
            )
        );
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void testConcurrentInventoryReservation() throws InterruptedException {
        // GIVEN: Initial inventory = 10
        Inventory initialInventory = inventoryRepository.findById(inventoryId).orElseThrow();
        assertEquals(10, initialInventory.getAvailableQuantity());

        // WHEN: 100 concurrent threads attempt to reserve 1 unit each
        int numberOfThreads = 100;
        ExecutorService executorService = Executors.newFixedThreadPool(numberOfThreads);
        CountDownLatch latch = new CountDownLatch(numberOfThreads);
        AtomicInteger successfulReservations = new AtomicInteger(0);
        AtomicInteger failedReservations = new AtomicInteger(0);

        // TenantContextHolder is a plain ThreadLocal, so the context set in setUp() only exists on
        // the main thread. Each worker needs its own copy — the same thing the JWT filter does for
        // every real request thread. Without this, organizationId is null on the workers and every
        // reservation fails the organization_id check.
        TenantContext tenantContext = TenantContextHolder.getContext();

        for (int i = 0; i < numberOfThreads; i++) {
            executorService.submit(() -> {
                TenantContextHolder.setContext(tenantContext);
                try {
                    inventoryService.reserveInventory(inventoryId, 1);
                    successfulReservations.incrementAndGet();
                } catch (Exception e) {
                    failedReservations.incrementAndGet();
                } finally {
                    TenantContextHolder.clear();
                    latch.countDown();
                }
            });
        }

        // Wait for all threads to complete
        assertTrue(latch.await(30, TimeUnit.SECONDS));
        executorService.shutdown();

        // THEN: Only 10 requests should succeed, 90 should fail
        assertTrue(successfulReservations.get() <= 10, 
            "Successful reservations should not exceed available inventory");
        assertEquals(90, failedReservations.get(), 
            "Expected 90 failed reservations due to insufficient inventory");

        // THEN: Final available quantity should be 0
        Inventory finalInventory = inventoryRepository.findById(inventoryId).orElseThrow();
        assertEquals(0, finalInventory.getAvailableQuantity(), 
            "Available quantity should be 0 after all reservations");
        assertEquals(10, finalInventory.getReservedQuantity(), 
            "Reserved quantity should be 10 (the number of successful reservations)");

        // THEN: No overselling occurred
        assertTrue(finalInventory.getAvailableQuantity() >= 0, 
            "Available quantity should never be negative");
    }

    @Test
    void testInventoryReservationWithInsufficientStock() {
        // GIVEN: Inventory with 10 units
        Inventory inventory = inventoryRepository.findById(inventoryId).orElseThrow();
        assertEquals(10, inventory.getAvailableQuantity());

        // WHEN: Attempt to reserve 11 units
        assertThrows(Exception.class, () -> {
            inventoryService.reserveInventory(inventoryId, 11);
        });

        // THEN: Inventory should remain unchanged
        Inventory unchangedInventory = inventoryRepository.findById(inventoryId).orElseThrow();
        assertEquals(10, unchangedInventory.getAvailableQuantity());
        assertEquals(0, unchangedInventory.getReservedQuantity());
    }
}
