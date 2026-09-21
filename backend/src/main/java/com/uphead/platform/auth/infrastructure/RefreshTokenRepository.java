package com.uphead.platform.auth.infrastructure;

import com.uphead.platform.auth.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    
    Optional<RefreshToken> findByToken(String token);
    
    Optional<RefreshToken> findByUserIdAndToken(UUID userId, String token);
    
    void deleteByToken(String token);
    
    void deleteByUserId(UUID userId);
}
