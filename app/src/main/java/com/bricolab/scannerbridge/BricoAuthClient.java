package com.bricolab.scannerbridge;

import android.content.Context;
import android.os.Build;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * BricoLab mobile authentication client.
 *
 * Passwords are sent only to the login endpoint and are never persisted.
 * The refresh token is encrypted by SecureTokenStore (Android Keystore).
 * The short-lived access token is kept only in process memory.
 */
final class BricoAuthClient {

    private static final String BASE = "https://bricolab.pl/BricoLab/api/mobile-auth/";
    private static final String LOGIN_URL = BASE + "login.php";
    private static final String REFRESH_URL = BASE + "refresh.php";
    private static final String ME_URL = BASE + "me.php";
    private static final String LOGOUT_URL = BASE + "logout.php";

    private static final long ACCESS_SAFETY_MS = 30_000L;

    private final SecureTokenStore store;
    private final String deviceName;

    private volatile String accessToken = "";
    private volatile long accessExpiresAtMs = 0L;
    private volatile boolean verified = false;
    private volatile String permission = "none";
    private volatile JSONObject user = null;

    BricoAuthClient(Context context) {
        store = new SecureTokenStore(context);
        deviceName = (Build.MANUFACTURER + " " + Build.MODEL).trim();
        restoreCachedUser();
    }

    String getDeviceId() {
        return store.getDeviceId();
    }

    boolean canUseScanner() {
        return verified && ("view".equals(permission) || "edit".equals(permission));
    }

    boolean canEditScanner() {
        return verified && "edit".equals(permission);
    }

    synchronized JSONObject stateObject() {
        JSONObject state = new JSONObject();
        try {
            state.put("savedSession", !store.loadRefreshToken().isEmpty());
            state.put("verified", verified);
            state.put("loggedIn", canUseScanner());
            state.put("permission", permission);
            state.put("deviceId", getDeviceId());
            if (user != null) state.put("user", new JSONObject(user.toString()));
        } catch (Exception ignored) {
        }
        return state;
    }

    synchronized String stateJson() {
        return stateObject().toString();
    }

    synchronized JSONObject login(String login, String password) throws Exception {
        JSONObject body = baseDevicePayload();
        body.put("login", login == null ? "" : login.trim());
        body.put("password", password == null ? "" : password);

        HttpResult response = request(LOGIN_URL, "POST", "", body.toString());
        requireOk(response);
        applyAuthResponse(response.json);
        return stateObject();
    }

    synchronized JSONObject verify() throws Exception {
        ensureAccessToken();
        HttpResult response = request(ME_URL, "GET", accessToken, null);
        if (response.code == 401) {
            refreshInternal();
            response = request(ME_URL, "GET", accessToken, null);
        }
        requireOk(response);
        JSONObject nextUser = response.json.optJSONObject("user");
        if (nextUser == null) throw new AuthException(response.code, "invalid_user_response");
        applyUser(nextUser);
        verified = true;
        return stateObject();
    }

    synchronized JSONObject logout() {
        String refresh = store.loadRefreshToken();
        try {
            if (!refresh.isEmpty()) {
                JSONObject body = baseDevicePayload();
                body.put("refreshToken", refresh);
                request(LOGOUT_URL, "POST", "", body.toString());
            }
        } catch (Exception ignored) {
        }
        clearLocal();
        return stateObject();
    }

    synchronized HttpResult authorizedPost(String endpoint, String payloadJson) throws Exception {
        ensureAccessToken();
        HttpResult response = request(endpoint, "POST", accessToken, payloadJson);
        if (response.code == 401) {
            refreshInternal();
            response = request(endpoint, "POST", accessToken, payloadJson);
        }
        if (response.code == 401 || response.code == 403 || response.code == 428) {
            verified = false;
            if (response.json != null && "scanner_forbidden".equals(response.json.optString("error"))) {
                permission = "none";
                saveCachedUser();
            }
        }
        return response;
    }

    synchronized void markUnverified() {
        verified = false;
    }

    private void ensureAccessToken() throws Exception {
        long now = System.currentTimeMillis();
        if (!accessToken.isEmpty() && accessExpiresAtMs - ACCESS_SAFETY_MS > now) return;
        refreshInternal();
    }

    private void refreshInternal() throws Exception {
        String refresh = store.loadRefreshToken();
        if (refresh.isEmpty()) {
            clearMemoryOnly();
            throw new AuthException(401, "no_saved_session");
        }

        JSONObject body = baseDevicePayload();
        body.put("refreshToken", refresh);
        HttpResult response = request(REFRESH_URL, "POST", "", body.toString());
        try {
            requireOk(response);
        } catch (AuthException error) {
            if (response.code == 401 || response.code == 403 || response.code == 428) clearLocal();
            throw error;
        }
        applyAuthResponse(response.json);
    }

    private JSONObject baseDevicePayload() throws Exception {
        JSONObject body = new JSONObject();
        body.put("deviceId", getDeviceId());
        body.put("deviceName", deviceName);
        body.put("appVersion", BuildConfig.VERSION_NAME);
        return body;
    }

    private void applyAuthResponse(JSONObject response) throws Exception {
        String nextAccess = response.optString("accessToken", "").trim();
        String nextRefresh = response.optString("refreshToken", "").trim();
        long expiresAtSeconds = response.optLong("accessExpiresAt", 0L);
        JSONObject nextUser = response.optJSONObject("user");

        if (nextAccess.isEmpty() || nextRefresh.isEmpty() || expiresAtSeconds <= 0 || nextUser == null) {
            throw new AuthException(500, "invalid_auth_response");
        }

        store.saveRefreshToken(nextRefresh);
        accessToken = nextAccess;
        accessExpiresAtMs = expiresAtSeconds * 1000L;
        applyUser(nextUser);
        verified = true;
    }

    private void applyUser(JSONObject nextUser) {
        try {
            user = new JSONObject(nextUser.toString());
        } catch (Exception ignored) {
            user = nextUser;
        }
        String nextPermission = nextUser.optString("permission", "none").toLowerCase();
        permission = ("view".equals(nextPermission) || "edit".equals(nextPermission))
                ? nextPermission
                : "none";
        saveCachedUser();
    }

    private void restoreCachedUser() {
        String cached = store.loadUserJson();
        if (cached == null || cached.trim().isEmpty()) return;
        try {
            JSONObject object = new JSONObject(cached);
            user = object;
            String level = object.optString("permission", "none").toLowerCase();
            permission = ("view".equals(level) || "edit".equals(level)) ? level : "none";
        } catch (Exception ignored) {
            store.saveUserJson("");
        }
        verified = false;
    }

    private void saveCachedUser() {
        store.saveUserJson(user == null ? "" : user.toString());
    }

    private void clearMemoryOnly() {
        accessToken = "";
        accessExpiresAtMs = 0L;
        verified = false;
    }

    private void clearLocal() {
        clearMemoryOnly();
        permission = "none";
        user = null;
        store.clearAuth();
    }

    private void requireOk(HttpResult response) throws AuthException {
        String error = response.json == null ? "HTTP " + response.code : response.json.optString("error", "HTTP " + response.code);
        boolean ok = response.code >= 200 && response.code < 300
                && response.json != null
                && response.json.optBoolean("ok", false);
        if (!ok) throw new AuthException(response.code, error);
    }

    private HttpResult request(String address, String method, String bearer, String body) throws Exception {
        URL url = new URL(address);
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IllegalArgumentException("HTTPS required");
        String host = url.getHost();
        if (!"bricolab.pl".equalsIgnoreCase(host)) {
            throw new IllegalArgumentException("Niedozwolony host");
        }

        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Cache-Control", "no-store");
        connection.setRequestProperty("User-Agent", "BricoScannerAuth/" + BuildConfig.VERSION_NAME);
        if (bearer != null && !bearer.trim().isEmpty()) {
            connection.setRequestProperty("Authorization", "Bearer " + bearer.trim());
        }

        if (body != null) {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
                output.flush();
            }
        }

        int code = connection.getResponseCode();
        InputStream input = code >= 200 && code < 400 ? connection.getInputStream() : connection.getErrorStream();
        String text = readResponse(input);
        connection.disconnect();

        JSONObject json = null;
        if (!text.isEmpty()) {
            try { json = new JSONObject(text); } catch (Exception ignored) { }
        }
        return new HttpResult(code, json, text);
    }

    private String readResponse(InputStream input) throws Exception {
        if (input == null) return "";
        try (InputStream in = input;
             BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) output.append(line).append('\n');
            return output.toString().trim();
        }
    }

    static final class HttpResult {
        final int code;
        final JSONObject json;
        final String body;

        HttpResult(int code, JSONObject json, String body) {
            this.code = code;
            this.json = json;
            this.body = body == null ? "" : body;
        }
    }

    static final class AuthException extends Exception {
        final int httpCode;
        final String errorCode;

        AuthException(int httpCode, String errorCode) {
            super(errorCode);
            this.httpCode = httpCode;
            this.errorCode = errorCode == null ? "auth_error" : errorCode;
        }
    }
}
