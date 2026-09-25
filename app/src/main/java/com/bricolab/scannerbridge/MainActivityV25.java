package com.bricolab.scannerbridge;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class MainActivityV25 extends MainActivity {

    private static final String OVH_ACCOUNT_HOST = "gahbowq.cluster129.hosting.ovh.net";
    private static final String OVH_TLS_HOST = "cluster129.hosting.ovh.net";

    private WebView uploadWebView;
    private final ExecutorService uploadExecutor = Executors.newSingleThreadExecutor();
    private final OkHttpClient uploadClient = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build();

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
        try {
            String transportEndpoint = endpoint;
            boolean ovhTechnicalEndpoint = endpoint.startsWith("https://" + OVH_ACCOUNT_HOST + "/")
                    || endpoint.startsWith("https://" + OVH_TLS_HOST + "/");

            if (endpoint.startsWith("https://" + OVH_ACCOUNT_HOST + "/")) {
                transportEndpoint = "https://" + OVH_TLS_HOST
                        + endpoint.substring(("https://" + OVH_ACCOUNT_HOST).length());
            }

            // OVH shared hosting may remove the Authorization header before PHP.
            // Send the scoped token redundantly through a custom header and inside
            // the encrypted JSON body. The server removes _auth before saving data.
            JSONObject payload = new JSONObject(payloadJson);
            payload.put("_auth", token);

            MediaType jsonType = MediaType.get("application/json; charset=utf-8");
            RequestBody body = RequestBody.create(payload.toString(), jsonType);

            Request.Builder requestBuilder = new Request.Builder()
                    .url(transportEndpoint)
                    .post(body)
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + token)
                    .header("X-Brico-Token", token)
                    .header("User-Agent", "BricoScannerBridge/2.7");

            // OVH Starter exposes the account by HTTP Host, while the technical
            // account subdomain presents a certificate only for cluster129.hosting.ovh.net.
            // Connect with the certificate-valid hostname and use the hosting account
            // hostname only for HTTP routing.
            if (ovhTechnicalEndpoint) {
                requestBuilder.header("Host", OVH_ACCOUNT_HOST);
            }

            try (Response response = uploadClient.newCall(requestBuilder.build()).execute()) {
                int httpCode = response.code();
                ResponseBody responseBody = response.body();
                String responseText = responseBody == null ? "" : responseBody.string().trim();

                JSONObject result = new JSONObject();
                result.put("httpCode", httpCode);
                result.put("transportHost", ovhTechnicalEndpoint ? OVH_TLS_HOST : "direct");
                result.put("routingHost", ovhTechnicalEndpoint ? OVH_ACCOUNT_HOST : "direct");

                JSONObject server = null;
                if (!responseText.isEmpty()) {
                    try {
                        server = new JSONObject(responseText);
                        result.put("server", server);
                    } catch (Exception ignored) {
                        result.put("body", responseText);
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
                        } else if (responseText.isEmpty()) {
                            errorMessage = "Serwer zwrócił pustą odpowiedź";
                        } else {
                            errorMessage = "Nieprawidłowa odpowiedź serwera";
                        }
                    }
                    result.put("error", errorMessage);
                }

                sendUploadResult(result);
            }
        } catch (Exception error) {
            JSONObject result = errorResult(error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()));
            sendUploadResult(result);
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
