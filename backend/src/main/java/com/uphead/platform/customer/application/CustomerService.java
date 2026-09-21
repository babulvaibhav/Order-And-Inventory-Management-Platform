package com.uphead.platform.customer.application;

import com.uphead.platform.audit.application.AuditService;
import com.uphead.platform.common.exception.ResourceConflictException;
import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.customer.domain.Customer;
import com.uphead.platform.customer.infrastructure.CustomerRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final AuditService auditService;

    public CustomerService(CustomerRepository customerRepository, AuditService auditService) {
        this.customerRepository = customerRepository;
        this.auditService = auditService;
    }

    @Transactional
    public CustomerResponse createCustomer(CustomerRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        if (request.email() != null && customerRepository.findByEmailAndOrganizationId(request.email(), organizationId).isPresent()) {
            throw new ResourceConflictException("Customer with email " + request.email() + " already exists");
        }

        Customer customer = new Customer(
            organizationId,
            request.name(),
            request.email(),
            request.phone(),
            request.address()
        );

        Customer saved = customerRepository.save(customer);
        CustomerResponse response = CustomerResponse.from(saved);
        auditService.createAuditLog("CUSTOMER_CREATED", "Customer", saved.getId(), null, response);
        return response;
    }

    @Transactional
    public CustomerResponse updateCustomer(UUID id, CustomerRequest request) {
        UUID organizationId = TenantContextHolder.getOrganizationId();

        Customer customer = customerRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        boolean emailChanged = request.email() != null && !request.email().equals(customer.getEmail());
        if (emailChanged && customerRepository.findByEmailAndOrganizationId(request.email(), organizationId).isPresent()) {
            throw new ResourceConflictException("Customer with email " + request.email() + " already exists");
        }

        CustomerResponse before = CustomerResponse.from(customer);
        customer.setName(request.name());
        customer.setEmail(request.email());
        customer.setPhone(request.phone());
        customer.setAddress(request.address());

        Customer saved = customerRepository.save(customer);
        CustomerResponse response = CustomerResponse.from(saved);
        auditService.createAuditLog("CUSTOMER_UPDATED", "Customer", saved.getId(), before, response);
        return response;
    }

    public CustomerResponse getCustomer(UUID id) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        Customer customer = customerRepository.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        return CustomerResponse.from(customer);
    }

    public Page<CustomerResponse> getCustomers(Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return customerRepository.findByOrganizationId(organizationId, pageable)
            .map(CustomerResponse::from);
    }

    public Page<CustomerResponse> searchCustomers(String search, Pageable pageable) {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        
        return customerRepository.findByOrganizationIdAndSearch(organizationId, search, pageable)
            .map(CustomerResponse::from);
    }
}
