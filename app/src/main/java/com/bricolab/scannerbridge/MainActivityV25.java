package com.bricolab.scannerbridge;

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

public class MainActivityV25 extends MainActivity {

    private WebView uploadWebView;
    private final ExecutorService uploadExecutor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        uploadWebView = findViewById(R.id.webView);
        uploadWebView.addJavascriptInterface(new BricoUploadBridge(), "BricoUpload");
    }

    public class BricoUploadBridge {

        @JavascriptInterface
        public void uploadJson(String endpoint, String token, String payloadJson) {
            final String safeEndpoint = endpoint == null ? "" : endpoint.trim();
            final String safeToken = token == null ? "" : token.trim();
            final String safePayload = payloadJson == null ? "" : payloadJson.trim();

            if (!safeEndpoint.startsWith("https://")) {
                sendUploadResult(errorResult("Adres wysyłania musi zaczynać się od https://"));
                return;
            }

            if (safeToken.isEmpty()) {
                sendUploadResult(errorResult("Brak klucza wysyłania"));
                return;
            }

            if (safePayload.isEmpty()) {
                sendUploadResult(errorResult("Pusty JSON do wysłania"));
                return;
            }

            try {
                new JSONObject(safePayload);
            } catch (Exception error) {
                sendUploadResult(errorResult("Nieprawidłowy JSON: " + error.getMessage()));
                return;
            }

            uploadExecutor.execute(() -> performUpload(safeEndpoint, safeToken, safePayload));
        }
    }

    private void performUpload(String endpoint, String token, String payloadJson) {
        HttpURLConnection connection = null;

        try {
            URL url = new URL(endpoint);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("User-Agent", "BricoScannerBridge/2.5");

            byte[] data = payloadJson.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(data.length);

            try (OutputStream output = connection.getOutputStream()) {
                output.write(data);
                output.flush();
            }

            int httpCode = connection.getResponseCode();
            InputStream stream = httpCode >= 200 && httpCode < 400
                    ? connection.getInputStream()
                    : connection.getErrorStream();

            String body = stream == null ? "" : readStream(stream).trim();

            JSONObject result = new JSONObject();
            result.put("httpCode", httpCode);

            JSONObject server = null;
            if (!body.isEmpty()) {
                try {
                    server = new JSONObject(body);
                    result.put("server", server);
                } catch (Exception ignored) {
                    result.put("body", body);
                }
            }

            boolean serverOk = server != null && server.optBoolean("ok", false);
            boolean ok = httpCode >= 200 && httpCode < 300 && serverOk;
            result.put("ok", ok);

            if (!ok) {
                String errorMessage = null;
                if (server != null) {
                    errorMessage = server.optString("error", "").trim();
                }
                if (errorMessage == null || errorMessage.isEmpty()) {
                    if (httpCode < 200 || httpCode >= 300) {
                        errorMessage = "HTTP " + httpCode;
                    } else if (body.isEmpty()) {
                        errorMessage = "Serwer zwrócił pustą odpowiedź";
                    } else {
                        errorMessage = "Nieprawidłowa odpowiedź serwera";
                    }
                }
                result.put("error", errorMessage);
            }

            sendUploadResult(result);
        } catch (Exception error) {
            JSONObject result = errorResult(error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()));
            sendUploadResult(result);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private String readStream(InputStream input) throws Exception {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8))) {
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append('\n');
            }
            return output.toString();
        }
    }

    private JSONObject errorResult(String message) {
        JSONObject result = new JSONObject();
        try {
            result.put("ok", false);
            result.put("error", message == null ? "Nieznany błąd" : message);
        } catch (Exception ignored) {
        }
        return result;
    }

    private void sendUploadResult(JSONObject result) {
        WebView view = uploadWebView;
        if (view == null) return;

        final String javascript =
                "window.onNativeUploadResult && window.onNativeUploadResult(" + result.toString() + ");";

        view.post(() -> {
            if (uploadWebView != null) {
                uploadWebView.evaluateJavascript(javascript, null);
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (uploadWebView != null) {
            uploadWebView.removeJavascriptInterface("BricoUpload");
        }
        uploadExecutor.shutdownNow();
        uploadWebView = null;
        super.onDestroy();
    }
}
