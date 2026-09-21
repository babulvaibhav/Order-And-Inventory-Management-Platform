package com.uphead.platform.user.application;

import jakarta.validation.constraints.*;
import java.util.UUID;

// Shared by both create and update. `password` is intentionally not @NotBlank here: create still
// requires one (enforced explicitly in UserService.createUser, since a create with no password
// would be a real bug, not a valid partial update), but update reuses this same DTO and previously
// forced every edit — even one only renaming a user — to also reset their password. See
// KNOWN_LIMITATIONS.md "Addressed in this pass". A blank/omitted password on update leaves the
// existing password hash untouched (see UserService.updateUser).
public record UserRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    String email,

    @Size(min = 8, message = "Password must be at least 8 characters")
    String password,

    @NotBlank(message = "Name is required")
    @Size(max = 200, message = "Name must not exceed 200 characters")
    String name,

    @NotNull(message = "Role is required")
    UUID roleId
) {
}
