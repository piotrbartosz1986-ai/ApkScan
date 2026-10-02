package com.bricolab.scannerbridge;

import android.app.Activity;
import android.app.Application;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AUTH LATEST application layer. It does not change the proven scanner/camera core.
 * Legacy JavaScript upload calls are transparently routed through the logged-in
 * BricoLab account, so the newest scanner UI and converter extensions stay intact.
 */
public class BricoAuthApplication extends Application implements Application.ActivityLifecycleCallbacks {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private BricoAuthClient authClient;
    private WebView currentWebView;
    private Activity currentWebViewActivity;

    @Override
    public void onCreate() {
        super.onCreate();
        authClient = new BricoAuthClient(this);
        registerActivityLifecycleCallbacks(this);
    }

    BricoAuthClient authClient() { return authClient; }

    private void installBridges(Activity activity) {
        WebView webView = activity.findViewById(R.id.webView);
        if (webView == null) return;
        currentWebView = webView;
        currentWebViewActivity = activity;
        webView.addJavascriptInterface(new UploadBridge(webView), "BricoUpload");
        webView.addJavascriptInterface(new AuthBridge(activity, webView), "BricoAuth");
    }

    private String mappedEndpoint(String endpoint) throws Exception {
        if (endpoint == null || endpoint.trim().isEmpty()) throw new IllegalArgumentException("Brak adresu serwera");
        URL url = new URL(endpoint.trim());
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IllegalArgumentException("HTTPS required");
        String path = url.getPath() == null ? "" : url.getPath();

        if (path.endsWith("/api/upload.php") || path.endsWith("/BricoLab/api/scanner_upload_v5.php")) {
            return "https://bricolab.pl/BricoLab/api/scanner_upload_v5.php";
        }
        if (path.endsWith("/BricoLab/api/scanner_converters.php") || path.endsWith("/BricoLab/api/scanner_converters_v2.php")) {
            return "https://bricolab.pl/BricoLab/api/scanner_converters_v2.php";
        }
        if (path.endsWith("/BricoLab/api/scanner_converters_status.php") || path.endsWith("/BricoLab/api/scanner_converters_status_v2.php")) {
            return "https://bricolab.pl/BricoLab/api/scanner_converters_status_v2.php";
        }
        if (path.endsWith("/BricoLab/api/scanner_product_lookup.php") || path.endsWith("/BricoLab/api/scanner_product_lookup_v2.php") || path.endsWith("/BricoLab/api/scanner_product_lookup_v3.php")) {
            return "https://bricolab.pl/BricoLab/api/scanner_product_lookup_v3.php";
        }
        throw new IllegalArgumentException("Niedozwolony endpoint Skanera");
    }

    private void sendUploadResult(WebView webView, JSONObject result) {
        webView.post(() -> {
            try {
                webView.evaluateJavascript(
                        "window.onNativeUploadResult && window.onNativeUploadResult(" + result.toString() + ");",
                        null
                );
            } catch (Exception ignored) {}
        });
    }

    private void sendAuthResult(WebView webView, JSONObject result) {
        webView.post(() -> {
            try {
                webView.evaluateJavascript(
                        "window.onBricoAuthResult && window.onBricoAuthResult(" + result.toString() + ");",
                        null
                );
            } catch (Exception ignored) {}
        });
    }

    private void returnToLogin(Activity activity) {
        if (activity == null || activity.isFinishing()) return;
        Intent intent = new Intent(activity, CameraPermissionGateAuthLatestActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
        activity.overridePendingTransition(0, 0);
        activity.finish();
    }

    private void performAuthorizedUpload(WebView webView, String endpoint, String payloadJson) {
        try {
            String mapped = mappedEndpoint(endpoint);
            BricoAuthClient.HttpResult response = authClient.authorizedPost(mapped, payloadJson);
            JSONObject result = new JSONObject();
            result.put("httpCode", response.code);
            result.put("transport", "bricolab-user-auth-latest");
            if (response.json != null) result.put("server", response.json);
            else if (!response.body.isEmpty()) result.put("body", response.body);

            boolean ok = response.code >= 200 && response.code < 300
                    && response.json != null && response.json.optBoolean("ok", false);
            result.put("ok", ok);
            if (!ok) {
                result.put("error", response.json != null
                        ? response.json.optString("error", "HTTP " + response.code)
                        : "HTTP " + response.code);
            }
            sendUploadResult(webView, result);
        } catch (Exception error) {
            JSONObject result = new JSONObject();
            try {
                result.put("ok", false);
                result.put("transport", "bricolab-user-auth-latest");
                result.put("error", error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()));
            } catch (Exception ignored) {}
            sendUploadResult(webView, result);
        }
    }

    private final class UploadBridge {
        private final WebView webView;
        UploadBridge(WebView webView) { this.webView = webView; }

        @JavascriptInterface
        public void uploadJson(String endpoint, String ignoredLegacyToken, String payloadJson) {
            executor.execute(() -> performAuthorizedUpload(webView, endpoint, payloadJson));
        }

        @JavascriptInterface
        public void uploadJsonAuth(String endpoint, String payloadJson) {
            executor.execute(() -> performAuthorizedUpload(webView, endpoint, payloadJson));
        }

        @JavascriptInterface
        public String getTransport() { return "native-java-bricolab-auth-latest"; }
    }

    private final class AuthBridge {
        private final Activity activity;
        private final WebView webView;
        AuthBridge(Activity activity, WebView webView) {
            this.activity = activity;
            this.webView = webView;
        }

        @JavascriptInterface public String getState() { return authClient == null ? "{}" : authClient.stateJson(); }
        @JavascriptInterface public String getDeviceId() { return authClient == null ? "" : authClient.getDeviceId(); }

        @JavascriptInterface
        public void login(String login, String password) {
            executor.execute(() -> {
                JSONObject result = new JSONObject();
                try {
                    JSONObject state = authClient.login(login, password);
                    result.put("ok", true); result.put("action", "login"); result.put("state", state);
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
            executor.execute(() -> {
                JSONObject result = new JSONObject();
                try {
                    JSONObject state = authClient.verify();
                    result.put("ok", true); result.put("action", "verify"); result.put("state", state);
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
            executor.execute(() -> {
                JSONObject result = new JSONObject();
                try {
                    JSONObject state = authClient.logout();
                    result.put("ok", true); result.put("action", "logout"); result.put("state", state);
                } catch (Exception error) {
                    putAuthError(result, "logout", 0, "logout_error");
                }
                sendAuthResult(webView, result);
                webView.post(() -> returnToLogin(activity));
            });
        }

        private void putAuthError(JSONObject result, String action, int httpCode, String code) {
            try {
                result.put("ok", false); result.put("action", action); result.put("httpCode", httpCode);
                result.put("error", code == null ? "auth_error" : code);
                result.put("state", authClient == null ? new JSONObject() : authClient.stateObject());
            } catch (Exception ignored) {}
        }
    }

    @Override public void onActivityCreated(Activity activity, Bundle state) { installBridges(activity); }
    @Override public void onActivityStarted(Activity activity) {}
    @Override public void onActivityResumed(Activity activity) {}
    @Override public void onActivityPaused(Activity activity) {}
    @Override public void onActivityStopped(Activity activity) {}
    @Override public void onActivitySaveInstanceState(Activity activity, Bundle state) {}
    @Override public void onActivityDestroyed(Activity activity) {
        if (activity != currentWebViewActivity) return;
        WebView webView = currentWebView;
        currentWebView = null;
        currentWebViewActivity = null;
        if (webView != null) {
            try { webView.removeJavascriptInterface("BricoUpload"); } catch (Exception ignored) {}
            try { webView.removeJavascriptInterface("BricoAuth"); } catch (Exception ignored) {}
        }
    }

    @Override
    public void onTerminate() {
        executor.shutdownNow();
        unregisterActivityLifecycleCallbacks(this);
        super.onTerminate();
    }
}
