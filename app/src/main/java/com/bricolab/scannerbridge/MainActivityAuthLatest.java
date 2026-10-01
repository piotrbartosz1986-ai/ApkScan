package com.bricolab.scannerbridge;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
 * AUTH LATEST keeps the proven MainActivityV36 camera/scanner core, but enforces
 * the converter-capable UI branch. MainActivity still contains the historical
 * main-branch loader, so this activity actively verifies the loaded document and
 * restores the AUTH/converters UI if the old loader wins a startup race.
 */
public class MainActivityAuthLatest extends MainActivityV36 {
    private static final String WEB_BASE =
            "https://raw.githubusercontent.com/piotrbartosz1986-ai/ApkScan/mobile-auth-v2-correct-base/web/";

    private final ExecutorService authUiLoader = Executors.newSingleThreadExecutor();
    private final Handler authUiHandler = new Handler(Looper.getMainLooper());
    private WebView authWebView;
    private boolean destroyed = false;
    private boolean loadingPinnedUi = false;
    private long lastPinnedLoadAt = 0L;

    private final Runnable uiWatchdog = new Runnable() {
        @Override
        public void run() {
            if (destroyed || authWebView == null) return;
            try {
                authWebView.evaluateJavascript(
                        "(function(){return window.__BRICO_AUTH_LATEST_UI===true;})()",
                        value -> {
                            if (destroyed) return;
                            boolean correct = "true".equalsIgnoreCase(String.valueOf(value));
                            if (!correct && System.currentTimeMillis() - lastPinnedLoadAt > 1400L) {
                                loadPinnedUi();
                            }
                        }
                );
            } catch (Exception ignored) {
                loadPinnedUi();
            }
            authUiHandler.postDelayed(this, 1200L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        authWebView = findViewById(R.id.webView);

        // Load our intended UI immediately, then keep checking briefly/periodically.
        loadPinnedUi();
        authUiHandler.postDelayed(uiWatchdog, 900L);
    }

    private void loadPinnedUi() {
        if (destroyed || loadingPinnedUi || authWebView == null) return;
        loadingPinnedUi = true;
        lastPinnedLoadAt = System.currentTimeMillis();

        authUiLoader.execute(() -> {
            try {
                String html = fetchText(WEB_BASE + "index.html");
                String config = fetchText(WEB_BASE + "scanner-config.json");
                runOnUiThread(() -> {
                    if (destroyed || authWebView == null) return;
                    try { new PersistentNativeBridge().applyConfig(config); } catch (Exception ignored) {}
                    authWebView.loadDataWithBaseURL(WEB_BASE, html, "text/html", "UTF-8", null);
                });
            } catch (Exception ignored) {
                // The inherited cache/fallback remains available. Watchdog retries.
            } finally {
                loadingPinnedUi = false;
            }
        });
    }

    private String fetchText(String address) throws Exception {
        String separator = address.contains("?") ? "&" : "?";
        URL url = new URL(address + separator + "_=" + System.currentTimeMillis());
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
        destroyed = true;
        authUiHandler.removeCallbacks(uiWatchdog);
        authUiLoader.shutdownNow();
        authWebView = null;
        super.onDestroy();
    }
}
