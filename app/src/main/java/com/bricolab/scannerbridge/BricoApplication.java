package com.bricolab.scannerbridge;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BricoApplication extends Application implements Application.ActivityLifecycleCallbacks {

    private final ExecutorService uploadExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService authExecutor = Executors.newSingleThreadExecutor();
    private WebView currentWebView;
    private BricoAuthClient authClient;

    @Override
    public void onCreate() {
        super.onCreate();
        authClient = new BricoAuthClient(this);
        registerActivityLifecycleCallbacks(this);
    }

    boolean canUseScanner() {
        return authClient != null && authClient.canUseScanner();
    }

    boolean canEditScanner() {
        return authClient != null && authClient.canEditScanner();
    }

    String authStateJson() {
        return authClient == null ? "{}" : authClient.stateJson();
    }

    private void installBridges(Activity activity) {
        WebView webView = activity.findViewById(R.id.webView);
        if (webView == null) return;

        currentWebView = webView;
        webView.addJavascriptInterface(new UploadBridge(webView), "BricoUpload");
        webView.addJavascriptInterface(new AuthBridge(webView), "BricoAuth");
    }

    private boolean isAllowedEndpoint(URL url) {
        if (!"https".equalsIgnoreCase(url.getProtocol())) return false;

        String host = url.getHost();
        return "gahbowq.cluster129.hosting.ovh.net".equalsIgnoreCase(host)
                || "files.bricolab.pl".equalsIgnoreCase(host);
    }

    private String readResponse(InputStream input) throws Exception {
        if (input == null) return "";

        try (InputStream in = input;
             BufferedReader reader = new BufferedReader(
                     new InputStreamReader(in, StandardCharsets.UTF_8))) {

            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append('\n');
            }
            return output.toString().trim();
        }
    }

    private void sendResult(WebView webView, JSONObject result) {
        webView.post(() -> {
            try {
                webView.evaluateJavascript(
                        "window.onNativeUploadResult && window.onNativeUploadResult(" +
                                result.toString() +
                                ");",
                        null
                );
            } catch (Exception ignored) {
            }
        });
    }

    private void sendAuthResult(WebView webView, JSONObject result) {
        webView.post(() -> {
            try {
                webView.evaluateJavascript(
                        "window.onBricoAuthResult && window.onBricoAuthResult(" +
                                result.toString() +
                                ");",
                        null
                );
            } catch (Exception ignored) {
            }
        });
    }

    /** Legacy transport kept intact for instant rollback to the old static-token flow. */
    private void performLegacyUpload(WebView webView, String endpoint, String token, String payloadJson) {
        HttpURLConnection connection = null;

        try {
            if (endpoint == null || endpoint.trim().isEmpty()) {
                throw new IllegalArgumentException("Brak adresu serwera");
            }
            if (token == null || token.trim().isEmpty()) {
                throw new IllegalArgumentException("Brak klucza wysyłania");
            }
            if (payloadJson == null || payloadJson.trim().isEmpty()) {
                throw new IllegalArgumentException("Brak danych do wysłania");
            }

            URL url = new URL(endpoint.trim());
            if (!isAllowedEndpoint(url)) {
                throw new IllegalArgumentException("Niedozwolony adres serwera");
            }

            byte[] payload = payloadJson.getBytes(StandardCharsets.UTF_8);

            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(15000);
            connection.setUseCaches(false);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + token.trim());
            connection.setRequestProperty("User-Agent", "BricoScannerBridge/legacy");
            connection.setFixedLengthStreamingMode(payload.length);

            try (OutputStream output = connection.getOutputStream()) {
                output.write(payload);
                output.flush();
            }

            int httpCode = connection.getResponseCode();
            InputStream responseStream = httpCode >= 200 && httpCode < 400
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            String body = readResponse(responseStream);

            JSONObject result = uploadResult(httpCode, body, "native-java-legacy");
            sendResult(webView, result);
        } catch (Exception error) {
            sendResult(webView, errorResult("native-java-legacy", error));
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void performAuthorizedUpload(WebView webView, String endpoint, String payloadJson) {
        try {
            if (endpoint == null || endpoint.trim().isEmpty()) {
                throw new IllegalArgumentException("Brak adresu serwera");
            }
            if (payloadJson == null || payloadJson.trim().isEmpty()) {
                throw new IllegalArgumentException("Brak danych do wysłania");
            }
            URL url = new URL(endpoint.trim());
            if (!isAllowedEndpoint(url)) {
                throw new IllegalArgumentException("Niedozwolony adres serwera");
            }
            if (authClient == null) throw new IllegalStateException("Brak klienta logowania BricoLab");

            BricoAuthClient.HttpResult response = authClient.authorizedPost(endpoint.trim(), payloadJson);
            JSONObject result = new JSONObject();
            result.put("httpCode", response.code);
            result.put("transport", "bricolab-user-auth");
            if (response.json != null) result.put("server", response.json);
            else if (!response.body.isEmpty()) result.put("body", response.body);

            boolean ok = response.code >= 200 && response.code < 300
                    && response.json != null
                    && response.json.optBoolean("ok", false);
            result.put("ok", ok);
            if (!ok) {
                String message = response.json != null
                        ? response.json.optString("error", "HTTP " + response.code)
                        : "HTTP " + response.code;
                result.put("error", message);
            }
            sendResult(webView, result);
        } catch (Exception error) {
            sendResult(webView, errorResult("bricolab-user-auth", error));
        }
    }

    private JSONObject uploadResult(int httpCode, String body, String transport) throws Exception {
        JSONObject result = new JSONObject();
        result.put("httpCode", httpCode);
        result.put("transport", transport);

        JSONObject server = null;
        if (body != null && !body.isEmpty()) {
            try {
                server = new JSONObject(body);
                result.put("server", server);
            } catch (Exception ignored) {
                result.put("body", body);
            }
        }

        boolean httpOk = httpCode >= 200 && httpCode < 300;
        boolean serverOk = server == null || server.optBoolean("ok", false);
        boolean ok = httpOk && serverOk;
        result.put("ok", ok);

        if (!ok) {
            String error = server != null
                    ? server.optString("error", "HTTP " + httpCode)
                    : "HTTP " + httpCode;
            result.put("error", error);
        }
        return result;
    }

    private JSONObject errorResult(String transport, Exception error) {
        JSONObject result = new JSONObject();
        try {
            result.put("ok", false);
            result.put("transport", transport);
            result.put("error", error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()));
        } catch (Exception ignored) {
        }
        return result;
    }

    private final class UploadBridge {
        private final WebView webView;

        UploadBridge(WebView webView) {
            this.webView = webView;
        }

        /** Old static-token method. Intentionally retained during the test stage. */
        @JavascriptInterface
        public void uploadJson(String endpoint, String token, String payloadJson) {
            uploadExecutor.execute(() -> performLegacyUpload(webView, endpoint, token, payloadJson));
        }

        /** New method: the access token never enters JavaScript. */
        @JavascriptInterface
        public void uploadJsonAuth(String endpoint, String payloadJson) {
            uploadExecutor.execute(() -> performAuthorizedUpload(webView, endpoint, payloadJson));
        }

        @JavascriptInterface
        public String getTransport() {
            return "native-java-auth-v1";
        }
    }

    private final class AuthBridge {
        private final WebView webView;

        AuthBridge(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public String getState() {
            return authClient == null ? "{}" : authClient.stateJson();
        }

        @JavascriptInterface
        public String getDeviceId() {
            return authClient == null ? "" : authClient.getDeviceId();
        }

        @JavascriptInterface
        public void login(String login, String password) {
            authExecutor.execute(() -> {
                JSONObject result = new JSONObject();
                try {
                    JSONObject state = authClient.login(login, password);
                    result.put("ok", true);
                    result.put("action", "login");
                    result.put("state", state);
                } catch (BricoAuthClient.AuthException error) {
                    putAuthError(result, "login", error.httpCode, error.errorCode);
                } catch (Exception error) {
                    putAuthError(result, "login", 0, "network_error: " + String.valueOf(error.getMessage()));
                }
                sendAuthResult(webView, result);
            });
        }

        @JavascriptInterface
        public void verify() {
            authExecutor.execute(() -> {
                JSONObject result = new JSONObject();
                try {
                    JSONObject state = authClient.verify();
                    result.put("ok", true);
                    result.put("action", "verify");
                    result.put("state", state);
                } catch (BricoAuthClient.AuthException error) {
                    putAuthError(result, "verify", error.httpCode, error.errorCode);
                } catch (Exception error) {
                    if (authClient != null) authClient.markUnverified();
                    putAuthError(result, "verify", 0, "network_error: " + String.valueOf(error.getMessage()));
                }
                sendAuthResult(webView, result);
            });
        }

        @JavascriptInterface
        public void logout() {
            authExecutor.execute(() -> {
                JSONObject result = new JSONObject();
                try {
                    JSONObject state = authClient.logout();
                    result.put("ok", true);
                    result.put("action", "logout");
                    result.put("state", state);
                } catch (Exception error) {
                    putAuthError(result, "logout", 0, "logout_error");
                }
                sendAuthResult(webView, result);
            });
        }

        private void putAuthError(JSONObject result, String action, int httpCode, String code) {
            try {
                result.put("ok", false);
                result.put("action", action);
                result.put("httpCode", httpCode);
                result.put("error", code == null ? "auth_error" : code);
                result.put("state", authClient == null ? new JSONObject() : authClient.stateObject());
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
        installBridges(activity);
    }

    @Override public void onActivityStarted(Activity activity) { }
    @Override public void onActivityResumed(Activity activity) { }
    @Override public void onActivityPaused(Activity activity) { }
    @Override public void onActivityStopped(Activity activity) { }
    @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) { }

    @Override
    public void onActivityDestroyed(Activity activity) {
        if (currentWebView != null) {
            try { currentWebView.removeJavascriptInterface("BricoUpload"); } catch (Exception ignored) { }
            try { currentWebView.removeJavascriptInterface("BricoAuth"); } catch (Exception ignored) { }
            currentWebView = null;
        }
    }

    @Override
    public void onTerminate() {
        uploadExecutor.shutdownNow();
        authExecutor.shutdownNow();
        unregisterActivityLifecycleCallbacks(this);
        super.onTerminate();
    }
}
