package com.bricolab.scannerbridge;

import android.os.Bundle;
import android.webkit.WebView;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Leaves the proven MainActivityV36 camera/scanner implementation untouched and
 * only pins its WebView to the latest converter-capable UI branch.
 */
public class MainActivityAuthLatest extends MainActivityV36 {
    private static final String WEB_BASE =
            "https://raw.githubusercontent.com/piotrbartosz1986-ai/ApkScan/mobile-auth-v2-correct-base/web/";
    private final ExecutorService uiLoader = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        loadPinnedUi();
    }

    private void loadPinnedUi() {
        WebView webView = findViewById(R.id.webView);
        if (webView == null) return;
        uiLoader.execute(() -> {
            try {
                String html = fetchText(WEB_BASE + "index.html");
                String config = fetchText(WEB_BASE + "scanner-config.json");
                runOnUiThread(() -> {
                    try { new PersistentNativeBridge().applyConfig(config); } catch (Exception ignored) {}
                    webView.loadDataWithBaseURL(WEB_BASE, html, "text/html", "UTF-8", null);
                });
            } catch (Exception error) {
                // Superclass remote/cache/fallback UI remains available if GitHub is temporarily unreachable.
            }
        });
    }

    private String fetchText(String address) throws Exception {
        URL url = new URL(address + "?_=" + System.currentTimeMillis());
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(10000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "BricoScannerAuthLatest/" + BuildConfig.VERSION_NAME);
        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) {
            connection.disconnect();
            throw new IllegalStateException("HTTP " + code);
        }
        try (InputStream input = connection.getInputStream();
             BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            StringBuilder out = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) out.append(line).append('\n');
            return out.toString();
        } finally {
            connection.disconnect();
        }
    }

    @Override
    protected void onDestroy() {
        uiLoader.shutdownNow();
        super.onDestroy();
    }
}
