package com.bricolab.scannerbridge;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.UUID;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Minimal Android Keystore-backed storage for the long-lived refresh token.
 * Access tokens stay only in memory inside BricoAuthClient.
 */
final class SecureTokenStore {

    private static final String PREFS = "brico-mobile-auth";
    private static final String KEY_ALIAS = "bricolab_scanner_refresh_v1";
    private static final String KEY_REFRESH = "refresh_enc";
    private static final String KEY_DEVICE_ID = "device_id";
    private static final String KEY_USER_JSON = "user_json";

    private final SharedPreferences prefs;

    SecureTokenStore(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    synchronized String getDeviceId() {
        String value = prefs.getString(KEY_DEVICE_ID, "");
        if (value != null && !value.trim().isEmpty()) return value;
        value = "android-" + UUID.randomUUID().toString();
        prefs.edit().putString(KEY_DEVICE_ID, value).apply();
        return value;
    }

    synchronized void saveRefreshToken(String token) throws Exception {
        if (token == null || token.trim().isEmpty()) {
            prefs.edit().remove(KEY_REFRESH).apply();
            return;
        }

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        String packed = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                + "."
                + Base64.encodeToString(encrypted, Base64.NO_WRAP);
        prefs.edit().putString(KEY_REFRESH, packed).apply();
    }

    synchronized String loadRefreshToken() {
        String packed = prefs.getString(KEY_REFRESH, "");
        if (packed == null || packed.trim().isEmpty()) return "";

        try {
            String[] parts = packed.split("\\.", 2);
            if (parts.length != 2) throw new IllegalStateException("invalid token blob");
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception error) {
            prefs.edit().remove(KEY_REFRESH).apply();
            return "";
        }
    }

    synchronized void saveUserJson(String json) {
        prefs.edit().putString(KEY_USER_JSON, json == null ? "" : json).apply();
    }

    synchronized String loadUserJson() {
        String value = prefs.getString(KEY_USER_JSON, "");
        return value == null ? "" : value;
    }

    synchronized void clearAuth() {
        prefs.edit().remove(KEY_REFRESH).remove(KEY_USER_JSON).apply();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        java.security.Key key = keyStore.getKey(KEY_ALIAS, null);
        if (key instanceof SecretKey) return (SecretKey) key;

        KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                "AndroidKeyStore"
        );
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }
}
