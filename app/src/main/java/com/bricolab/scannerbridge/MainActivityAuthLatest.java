package com.bricolab.scannerbridge;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AUTH LATEST keeps the proven scanner/camera core but pins the complete scanner
 * UI inside the APK. No runtime UI download from raw.githubusercontent.com is
 * required. This prevents the "Ładowanie Skanera AUTH LATEST…" screen from
 * hanging when GitHub/raw networking is slow or blocked on the phone.
 */
public class MainActivityAuthLatest extends MainActivityV36 {
    private static final String LOCAL_BASE_URL = "https://bricolab.local/";

    private final ExecutorService localUiLoader = Executors.newSingleThreadExecutor();
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
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
                            if (!correct && System.currentTimeMillis() - lastPinnedLoadAt > 700L) {
                                loadPinnedUi();
                            }
                        }
                );
            } catch (Exception ignored) {
                loadPinnedUi();
            }
            uiHandler.postDelayed(this, 700L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        authWebView = findViewById(R.id.webView);

        // Give BricoAuthApplication a moment to install JavaScript bridges first,
        // then load the complete bundled UI. The watchdog also replaces any late
        // inherited remote-main UI load with this pinned AUTH/converter UI.
        uiHandler.postDelayed(this::loadPinnedUi, 120L);
        uiHandler.postDelayed(uiWatchdog, 650L);
    }

    private void loadPinnedUi() {
        if (destroyed || loadingPinnedUi || authWebView == null) return;
        loadingPinnedUi = true;
        lastPinnedLoadAt = System.currentTimeMillis();

        localUiLoader.execute(() -> {
            try {
                String html = readAssetText("web/index.html");
                String config = readAssetText("web/scanner-config.json");
                runOnUiThread(() -> {
                    if (destroyed || authWebView == null) return;
                    try { new PersistentNativeBridge().applyConfig(config); } catch (Exception ignored) {}
                    authWebView.loadDataWithBaseURL(
                            LOCAL_BASE_URL,
                            html,
                            "text/html",
                            "UTF-8",
                            null
                    );
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    if (destroyed || authWebView == null) return;
                    String message = String.valueOf(error.getMessage())
                            .replace("&", "&amp;")
                            .replace("<", "&lt;")
                            .replace(">", "&gt;");
                    authWebView.loadData(
                            "<html><body style='background:#0b0d10;color:#fff;font-family:sans-serif;padding:20px'>" +
                                    "Błąd lokalnego interfejsu Skanera: " + message + "</body></html>",
                            "text/html",
                            "UTF-8"
                    );
                });
            } finally {
                loadingPinnedUi = false;
            }
        });
    }

    private String readAssetText(String path) throws Exception {
        try (InputStream input = getAssets().open(path);
             BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            StringBuilder out = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) out.append(line).append('\n');
            return out.toString();
        }
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        uiHandler.removeCallbacks(uiWatchdog);
        localUiLoader.shutdownNow();
        authWebView = null;
        super.onDestroy();
    }
}
