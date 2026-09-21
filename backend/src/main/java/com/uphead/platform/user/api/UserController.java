package com.uphead.platform.user.api;

import com.uphead.platform.common.exception.ValidationException;
import com.uphead.platform.user.application.UserRequest;
import com.uphead.platform.user.application.UserResponse;
import com.uphead.platform.user.application.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('user.manage')")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('user.read')")
    public ResponseEntity<UserResponse> getUser(@PathVariable UUID id) {
        UserResponse response = userService.getUser(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('user.read')")
    public ResponseEntity<Page<UserResponse>> getUsers(Pageable pageable) {
        // Pageable#sort accepts any entity property name with no allow-list, which previously let
        // a caller sort the list by the (bcrypt-hashed, so not itself a leak, but still not an
        // intended query surface) password column. See KNOWN_LIMITATIONS.md "Addressed in this pass".
        for (Sort.Order order : pageable.getSort()) {
            if ("password".equalsIgnoreCase(order.getProperty())) {
                throw new ValidationException("Sorting by 'password' is not allowed");
            }
        }
        Page<UserResponse> response = userService.getUsers(pageable);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('user.manage')")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserRequest request) {
        UserResponse response = userService.updateUser(id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user.manage')")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.ok().build();
    }
}
