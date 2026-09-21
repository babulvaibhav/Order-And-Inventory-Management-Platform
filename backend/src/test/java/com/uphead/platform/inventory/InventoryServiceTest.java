package com.uphead.platform.inventory;

import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.inventory.application.InventoryAdjustRequest;
import com.uphead.platform.inventory.application.InventoryRequest;
import com.uphead.platform.inventory.application.InventoryResponse;
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

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

// Previously a plain @SpringBootTest with no @ActiveProfiles and no Testcontainers, so it ran
// against whatever database application.yml pointed at — its @AfterEach then called unscoped
// deleteAll() on every table it touched, which wipes real dev data (including the seeded platform
// owner and demo org) if run against a populated local database. Now isolated the same way
// ConcurrentInventoryReservationTest already is: an ephemeral, throwaway Postgres container.
// See KNOWN_LIMITATIONS.md "Addressed in this pass".
@SpringBootTest
@Testcontainers
class InventoryServiceTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private InventoryRepository inventoryRepository;

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
    private UUID productId;
    private UUID warehouseId;

    @BeforeEach
    void setUp() {
        // Unique per test: rows from earlier tests stay in the (throwaway) container, since audit
        // logs and notifications reference the organization and it can't simply be deleted.
        String suffix = UUID.randomUUID().toString();

        Organization organization = new Organization("Test Org " + suffix);
        organization = organizationRepository.save(organization);
        organizationId = organization.getId();

        Role role = roleRepository.save(new Role(organizationId, "Admin", true));

        User user = new User(organizationId, "test-" + suffix + "@example.com", "password", "Test User", role.getId());
        user = userRepository.save(user);
        userId = user.getId();

        Product product = new Product(organizationId, "SKU-001", "Test Product", "Description", BigDecimal.valueOf(100.00));
        product = productRepository.save(product);
        productId = product.getId();

        Warehouse warehouse = new Warehouse(organizationId, "Test Warehouse", "Test Address");
        warehouse = warehouseRepository.save(warehouse);
        warehouseId = warehouse.getId();

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
    void testCreateInventory() {
        InventoryRequest request = new InventoryRequest(warehouseId, productId, 50);
        InventoryResponse response = inventoryService.createInventory(request);

        assertNotNull(response.id());
        assertEquals(50, response.availableQuantity());
        assertEquals(0, response.reservedQuantity());
    }

    @Test
    void testAdjustInventory() {
        // Create initial inventory
        InventoryRequest createRequest = new InventoryRequest(warehouseId, productId, 50);
        InventoryResponse created = inventoryService.createInventory(createRequest);

        // Add 10 units
        InventoryAdjustRequest adjustRequest = new InventoryAdjustRequest(created.id(), 10, "Stock addition");
        InventoryResponse adjusted = inventoryService.adjustInventory(adjustRequest);

        assertEquals(60, adjusted.availableQuantity());
    }

    @Test
    void testReserveInventory() {
        // Create inventory with 10 units
        InventoryRequest createRequest = new InventoryRequest(warehouseId, productId, 10);
        InventoryResponse created = inventoryService.createInventory(createRequest);

        // Reserve 5 units
        inventoryService.reserveInventory(created.id(), 5);

        Inventory updated = inventoryRepository.findById(created.id()).orElseThrow();
        assertEquals(5, updated.getAvailableQuantity());
        assertEquals(5, updated.getReservedQuantity());
    }

    @Test
    void testReleaseInventory() {
        // Create inventory with 10 units
        InventoryRequest createRequest = new InventoryRequest(warehouseId, productId, 10);
        InventoryResponse created = inventoryService.createInventory(createRequest);

        // Reserve 5 units
        inventoryService.reserveInventory(created.id(), 5);

        // Release 3 units
        inventoryService.releaseInventory(created.id(), 3);

        Inventory updated = inventoryRepository.findById(created.id()).orElseThrow();
        assertEquals(8, updated.getAvailableQuantity());
        assertEquals(2, updated.getReservedQuantity());
    }
}
