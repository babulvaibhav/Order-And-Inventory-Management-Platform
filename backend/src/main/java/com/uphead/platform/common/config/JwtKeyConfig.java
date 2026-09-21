package com.uphead.platform.common.config;

import java.io.File;
import java.nio.file.Path;
import java.security.KeyPair;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.uphead.platform.common.security.RSAKeyUtil;

import jakarta.annotation.PostConstruct;

@Configuration
public class JwtKeyConfig {

    private static final String PRIVATE_KEY_PEM_FILE_NAME = "jwt_private_key.pem";

    @Value("${jwt.keystore-path:./keys}")
    private String keystorePath;

    @Value("${jwt.key-passphrase:changeit}")
    private String passphrase;

    @PostConstruct
    public void init() throws Exception {
        // Create keystore directory if it doesn't exist
        Path keyDir = Path.of(keystorePath);
        if (!keyDir.toFile().exists()) {
            keyDir.toFile().mkdirs();
        }

        // Generate key pair if it doesn't exist
        Path keyFilePath = Path.of(keystorePath + File.separator + PRIVATE_KEY_PEM_FILE_NAME);
        if (!keyFilePath.toFile().exists()) {
            System.out.println("Generating JWT RSA Key Pair...");
            RSAKeyUtil.generateAndSaveKeyPair(keyFilePath, passphrase);
            System.out.println("JWT RSA Key Pair generated successfully.");
        }
    }

    @Bean
    public KeyPair jwtKeyPair() throws Exception {
        Path keyFilePath = Path.of(keystorePath + File.separator + PRIVATE_KEY_PEM_FILE_NAME);
        return RSAKeyUtil.loadRSAKeyPairFromLocal(keyFilePath, passphrase);
    }
}
