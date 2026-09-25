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
    private WebView currentWebView;

    @Override
    public void onCreate() {
        super.onCreate();
        registerActivityLifecycleCallbacks(this);
    }

    private void installUploadBridge(Activity activity) {
        WebView webView = activity.findViewById(R.id.webView);
        if (webView == null) return;

        currentWebView = webView;
        webView.addJavascriptInterface(new UploadBridge(webView), "BricoUpload");
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

    private void performUpload(WebView webView, String endpoint, String token, String payloadJson) {
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
            connection.setRequestProperty("User-Agent", "BricoScannerBridge/2.5");
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

            JSONObject result = new JSONObject();
            result.put("httpCode", httpCode);
            result.put("transport", "native-java");

            JSONObject server = null;
            if (!body.isEmpty()) {
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

            sendResult(webView, result);
        } catch (Exception error) {
            try {
                JSONObject result = new JSONObject();
                result.put("ok", false);
                result.put("transport", "native-java");
                result.put("error", error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()));
                sendResult(webView, result);
            } catch (Exception ignored) {
            }
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private final class UploadBridge {
        private final WebView webView;

        UploadBridge(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public void uploadJson(String endpoint, String token, String payloadJson) {
            uploadExecutor.execute(() -> performUpload(webView, endpoint, token, payloadJson));
        }

        @JavascriptInterface
        public String getTransport() {
            return "native-java-2.5";
        }
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
        installUploadBridge(activity);
    }

    @Override public void onActivityStarted(Activity activity) { }
    @Override public void onActivityResumed(Activity activity) { }
    @Override public void onActivityPaused(Activity activity) { }
    @Override public void onActivityStopped(Activity activity) { }
    @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) { }

    @Override
    public void onActivityDestroyed(Activity activity) {
        if (currentWebView != null) {
            try {
                currentWebView.removeJavascriptInterface("BricoUpload");
            } catch (Exception ignored) {
            }
            currentWebView = null;
        }
    }

    @Override
    public void onTerminate() {
        uploadExecutor.shutdownNow();
        unregisterActivityLifecycleCallbacks(this);
        super.onTerminate();
    }
}
