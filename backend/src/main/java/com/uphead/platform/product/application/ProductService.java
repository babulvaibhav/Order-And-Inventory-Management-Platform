package com.uphead.platform.product.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.common.exception.ResourceConflictException;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.dashboard.application.DashboardCacheEvictor;
import com.uphead.platform.product.domain.Product;
import com.uphead.platform.product.infrastructure.ProductRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final AuditService auditService;
    private final DashboardCacheEvictor dashboardCacheEvictor;

    public ProductService(ProductRepository productRepository, AuditService auditService,
                           DashboardCacheEvictor dashboardCacheEvictor) {
        this.productRepository = productRepository;
        this.auditService = auditService;
        this.dashboardCacheEvictor = dashboardCacheEvictor;
    }

    @Transactional
    public ProductResponse createProduct(ProductRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        if (productRepository.existsByOrganizationIdAndSku(organizationId, request.sku())) {
            throw new ResourceConflictException("Product with SKU " + request.sku() + " already exists in this organization");
        }

        Product product = new Product(
            organizationId,
            request.sku(),
            request.name(),
            request.description(),
            request.price()
        );

        if (request.status() != null) {
            product.setStatus(request.status());
        }

        Product saved = productRepository.save(product);
        ProductResponse response = ProductResponse.from(saved);
        auditService.createAuditLog("PRODUCT_CREATED", "Product", saved.getId(), null, response);
        dashboardCacheEvictor.evict(organizationId);
        return response;
    }

    @Transactional
    public ProductResponse updateProduct(UUID id, ProductRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Product product = productRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        if (!product.getSku().equals(request.sku()) &&
            productRepository.existsByOrganizationIdAndSku(organizationId, request.sku())) {
            throw new ResourceConflictException("Product with SKU " + request.sku() + " already exists in this organization");
        }

        ProductResponse before = ProductResponse.from(product);
        product.setSku(request.sku());
        product.setName(request.name());
        product.setDescription(request.description());
        product.setPrice(request.price());

        if (request.status() != null) {
            product.setStatus(request.status());
        }

        Product saved = productRepository.save(product);
        ProductResponse response = ProductResponse.from(saved);
        auditService.createAuditLog("PRODUCT_UPDATED", "Product", saved.getId(), before, response);
        dashboardCacheEvictor.evict(organizationId);
        return response;
    }

    @Transactional
    public void disableProduct(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Product product = productRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        ProductResponse before = ProductResponse.from(product);
        product.setStatus(Product.Status.DISABLED);
        Product saved = productRepository.save(product);
        auditService.createAuditLog("PRODUCT_DISABLED", "Product", id, before, ProductResponse.from(saved));
        dashboardCacheEvictor.evict(organizationId);
    }

    public ProductResponse getProduct(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        Product product = productRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        
        return ProductResponse.from(product);
    }

    public Page<ProductResponse> getProducts(Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return productRepository.findByOrganizationId(organizationId, pageable)
            .map(ProductResponse::from);
    }

    public Page<ProductResponse> searchProducts(String search, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return productRepository.findByOrganizationIdAndSearch(organizationId, search, pageable)
            .map(ProductResponse::from);
    }

    public Page<ProductResponse> getProductsByStatus(Product.Status status, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return productRepository.findByOrganizationIdAndStatus(organizationId, status, pageable)
            .map(ProductResponse::from);
    }
}
