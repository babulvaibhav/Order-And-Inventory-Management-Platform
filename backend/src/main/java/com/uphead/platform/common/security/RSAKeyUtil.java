package com.uphead.platform.common.security;

import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Security;
import java.security.interfaces.RSAPrivateCrtKey;

import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.PEMEncryptedKeyPair;
import org.bouncycastle.openssl.PEMEncryptor;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.bouncycastle.openssl.jcajce.JcaPEMWriter;
import org.bouncycastle.openssl.jcajce.JcePEMDecryptorProviderBuilder;
import org.bouncycastle.openssl.jcajce.JcePEMEncryptorBuilder;
import org.bouncycastle.pkcs.PKCS8EncryptedPrivateKeyInfo;
import org.bouncycastle.pkcs.jcajce.JcePKCSPBEInputDecryptorProviderBuilder;

import java.nio.file.Path;

public class RSAKeyUtil {

    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    /**
     * Generates RSA Key Pair and saves to encrypted PEM file
     */
    public static KeyPair generateAndSaveKeyPair(Path filePath, CharSequence passphrase)
            throws NoSuchAlgorithmException, IOException {

        KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
        keyPairGenerator.initialize(2048);
        KeyPair keyPair = keyPairGenerator.generateKeyPair();

        PrivateKey privateKey = keyPair.getPrivate();

        // Encrypt and save the private key
        PrivateKeyInfo privateKeyInfo = PrivateKeyInfo.getInstance(privateKey.getEncoded());

        try (FileWriter fileWriter = new FileWriter(filePath.toFile());
                JcaPEMWriter pemWriter = new JcaPEMWriter(fileWriter)) {

            PEMEncryptor encryptor = new JcePEMEncryptorBuilder("AES-256-CBC").build(toCharArray(passphrase));
            pemWriter.writeObject(privateKeyInfo, encryptor);
            return keyPair;
        }
    }

    /**
     * Loads RSA Key Pair from encrypted PEM file
     */
    public static KeyPair loadRSAKeyPairFromLocal(Path encryptedPemFilePath, CharSequence passphrase) throws Exception {
        try (FileReader fileReader = new FileReader(encryptedPemFilePath.toFile())) {
            PEMParser pemParser = new PEMParser(fileReader);
            Object object = pemParser.readObject();
            pemParser.close();

            // Check if it's an encrypted private key
            if (object instanceof PEMEncryptedKeyPair) {
                PEMEncryptedKeyPair encryptedKeyPair = (PEMEncryptedKeyPair) object;
                var decryptorProvider = new JcePEMDecryptorProviderBuilder()
                        .build(toCharArray(passphrase));
                JcaPEMKeyConverter converter = new JcaPEMKeyConverter().setProvider("BC");
                PEMKeyPair keyPair = encryptedKeyPair.decryptKeyPair(decryptorProvider);
                return converter.getKeyPair(keyPair);
            } else if (object instanceof PKCS8EncryptedPrivateKeyInfo) {
                PKCS8EncryptedPrivateKeyInfo encryptedPrivateKeyInfo = (PKCS8EncryptedPrivateKeyInfo) object;
                PrivateKeyInfo privateKeyInfo = encryptedPrivateKeyInfo.decryptPrivateKeyInfo(
                        new JcePKCSPBEInputDecryptorProviderBuilder().build(toCharArray(passphrase)));

                JcaPEMKeyConverter converter = new JcaPEMKeyConverter().setProvider("BC");
                PrivateKey privateKey = converter.getPrivateKey(privateKeyInfo);

                PublicKey publicKey = null;

                if (privateKey instanceof RSAPrivateCrtKey) {
                    RSAPrivateCrtKey rsaPrivateCrtKey = (RSAPrivateCrtKey) privateKey;
                    publicKey = java.security.KeyFactory.getInstance("RSA")
                            .generatePublic(new java.security.spec.RSAPublicKeySpec(rsaPrivateCrtKey.getModulus(),
                                    rsaPrivateCrtKey.getPublicExponent()));
                } else {
                    throw new RuntimeException("Private Key is not RSA");
                }

                return new KeyPair(publicKey, privateKey);
            } else {
                throw new IllegalArgumentException("The PEM file " +
                        encryptedPemFilePath.getFileName() + " does not contain an encrypted key pair.");
            }
        } catch (IOException e) {
            throw new Exception("Failed to read PEM file", e);
        }
    }

    /**
     * Convert CharSequence to char[]
     */
    private static char[] toCharArray(CharSequence charSequence) {
        char[] charArray = new char[charSequence.length()];
        for (int i = 0; i < charSequence.length(); i++) {
            charArray[i] = charSequence.charAt(i);
        }
        return charArray;
    }
}
