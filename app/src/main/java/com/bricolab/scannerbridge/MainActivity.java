package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity implements ScannerEngine.Listener {

    private static final int CAMERA_PERMISSION_REQUEST = 7001;

    private static final String REMOTE_BASE =
            "https://raw.githubusercontent.com/piotrbartosz1986-ai/ApkScan/main/web/";

    private static final String REMOTE_UI_URL = REMOTE_BASE + "index.html";
    private static final String REMOTE_CONFIG_URL = REMOTE_BASE + "scanner-config.json";

    private static final String CACHE_UI = "bridge-ui-cache.html";
    private static final String CACHE_CONFIG = "bridge-config-cache.json";
    private static final String PREFS_NAME = "brico-scanner-bridge";
    private static final String PREF_VOLUME_SCAN = "volume-buttons-scan";

    private WebView webView;
    private FrameLayout cameraContainer;
    private PreviewView previewView;

    private ScannerEngine scannerEngine;
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService fileExecutor = Executors.newSingleThreadExecutor();

    private volatile String currentConfigJson = new ScannerConfig().toJson();
    private volatile boolean uiReady = false;
    private volatile String uiSource = "starting";
    private volatile boolean volumeButtonsScanEnabled = true;
    private boolean pendingStartAfterPermission = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        volumeButtonsScanEnabled = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getBoolean(PREF_VOLUME_SCAN, true);

        webView = findViewById(R.id.webView);
        cameraContainer = findViewById(R.id.cameraContainer);
        previewView = findViewById(R.id.previewView);

        cameraContainer.setVisibility(View.GONE);

        scannerEngine = new ScannerEngine(this, previewView, this);

        configureWebView();
        loadRemoteConfig(false);
        loadRemoteUi();
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                uiReady = true;
                pushConfigToWeb();
                pushStateToWeb(scannerEngine.stateJson());
                pushNativeInfoToWeb();
            }
        });

        webView.addJavascriptInterface(new NativeBridge(), "NativeScanner");
    }

    private void loadRemoteUi() {
        uiReady = false;

        networkExecutor.execute(() -> {
            String html = null;
            String source = "remote";

            try {
                html = fetchText(REMOTE_UI_URL);
                writeCache(CACHE_UI, html);
            } catch (Exception remoteError) {
                try {
                    html = readCache(CACHE_UI);
                    source = "cache";
                } catch (Exception cacheError) {
                    try {
                        html = readAsset("web/index.html");
                        source = "apk_fallback";
                    } catch (Exception assetError) {
                        source = "error";
                    }
                }
            }

            final String finalHtml = html;
            final String finalSource = source;

            runOnUiThread(() -> {
                uiSource = finalSource;

                if (finalHtml == null || finalHtml.trim().isEmpty()) {
                    webView.loadData(
                            "<html><body style='background:#0b0d10;color:white;font-family:sans-serif;padding:20px'>" +
                                    "Nie udało się załadować interfejsu Brico Scanner Bridge.</body></html>",
                            "text/html",
                            "UTF-8"
                    );
                    return;
                }

                webView.loadDataWithBaseURL(
                        REMOTE_BASE,
                        finalHtml,
                        "text/html",
                        "UTF-8",
                        null
                );
            });
        });
    }

    private void loadRemoteConfig(boolean restartIfRunning) {
        networkExecutor.execute(() -> {
            String json = null;
            String source = "remote";

            try {
                json = fetchText(REMOTE_CONFIG_URL);
                writeCache(CACHE_CONFIG, json);
            } catch (Exception remoteError) {
                try {
                    json = readCache(CACHE_CONFIG);
                    source = "cache";
                } catch (Exception cacheError) {
                    try {
                        json = readAsset("web/scanner-config.json");
                        source = "apk_fallback";
                    } catch (Exception assetError) {
                        json = new ScannerConfig().toJson();
                        source = "defaults";
                    }
                }
            }

            ScannerConfig config = ScannerConfig.fromJson(json);
            String normalized = config.toJson();
            final String finalSource = source;

            runOnUiThread(() -> {
                boolean wasRunning = scannerEngine.isRunning();

                if (restartIfRunning && wasRunning) {
                    scannerEngine.stop();
                }

                scannerEngine.applyConfig(config);
                currentConfigJson = normalized;

                if (restartIfRunning && wasRunning) {
                    scannerEngine.start();
                }

                pushConfigToWeb(finalSource);
            });
        });
    }

    private String fetchText(String address) throws Exception {
        String separator = address.contains("?") ? "&" : "?";
        URL url = new URL(address + separator + "_=" + System.currentTimeMillis());

        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "BricoScannerBridge/2.2");

        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) {
            connection.disconnect();
            throw new IllegalStateException("HTTP " + code);
        }

        try (InputStream input = connection.getInputStream();
             BufferedReader reader = new BufferedReader(
                     new InputStreamReader(input, StandardCharsets.UTF_8))) {

            StringBuilder output = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null) {
                output.append(line).append('\n');
            }

            return output.toString();
        } finally {
            connection.disconnect();
        }
    }

    private void writeCache(String name, String content) throws Exception {
        File target = new File(getFilesDir(), name);
        try (FileOutputStream output = new FileOutputStream(target)) {
            output.write(content.getBytes(StandardCharsets.UTF_8));
        }
    }

    private String readCache(String name) throws Exception {
        File source = new File(getFilesDir(), name);
        if (!source.exists()) throw new IllegalStateException("cache missing");

        try (InputStream input = new FileInputStream(source)) {
            return readStream(input);
        }
    }

    private String readAsset(String name) throws Exception {
        try (InputStream input = getAssets().open(name)) {
            return readStream(input);
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

    private void requestScannerStart() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            scannerEngine.start();
            return;
        }

        pendingStartAfterPermission = true;
        ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.CAMERA},
                CAMERA_PERMISSION_REQUEST
        );
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        boolean volumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
                keyCode == KeyEvent.KEYCODE_VOLUME_DOWN;

        if (volumeButtonsScanEnabled && volumeKey) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                String keyName = keyCode == KeyEvent.KEYCODE_VOLUME_UP ? "VOLUME_UP" : "VOLUME_DOWN";
                handleHardwareScanButton(keyName);
            }
            return true;
        }

        return super.dispatchKeyEvent(event);
    }

    private void handleHardwareScanButton(String keyName) {
        if (uiReady) {
            evaluateJs(
                    "window.onNativeHardwareScanButton && window.onNativeHardwareScanButton(" +
                            JSONObject.quote(keyName) +
                            ");"
            );
            return;
        }

        if (!scannerEngine.isRunning()) {
            requestScannerStart();
        } else if (scannerEngine.isPaused()) {
            scannerEngine.setPaused(false);
        } else {
            scannerEngine.focusCenter(true);
        }
    }

    private void setVolumeButtonsScanEnabled(boolean enabled) {
        volumeButtonsScanEnabled = enabled;
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putBoolean(PREF_VOLUME_SCAN, enabled)
                .apply();
        pushNativeInfoToWeb();
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != CAMERA_PERMISSION_REQUEST) return;

        if (grantResults.length > 0 &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED) {

            if (pendingStartAfterPermission) {
                pendingStartAfterPermission = false;
                scannerEngine.start();
            }
        } else {
            pendingStartAfterPermission = false;
            Toast.makeText(
                    this,
                    "Bez zgody na aparat skaner nie może działać.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    @Override
    public void onBarcode(String code, String format, long timestamp) {
        try {
            JSONObject object = new JSONObject();
            object.put("code", code);
            object.put("format", format);
            object.put("timestamp", timestamp);

            evaluateJs(
                    "window.onNativeBarcode && window.onNativeBarcode(" +
                            object +
                            ");"
            );
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onState(String stateJson) {
        pushStateToWeb(stateJson);
    }

    private void pushStateToWeb(String stateJson) {
        if (!uiReady) return;
        evaluateJs(
                "window.onNativeScannerState && window.onNativeScannerState(" +
                        stateJson +
                        ");"
        );
    }

    private void pushConfigToWeb() {
        pushConfigToWeb("current");
    }

    private void pushConfigToWeb(String source) {
        if (!uiReady) return;

        try {
            JSONObject config = new JSONObject(currentConfigJson);
            config.put("source", source);

            evaluateJs(
                    "window.onNativeConfig && window.onNativeConfig(" +
                            config +
                            ");"
            );
        } catch (Exception ignored) {
        }
    }

    private void pushNativeInfoToWeb() {
        if (!uiReady) return;
        evaluateJs(
                "window.onNativeInfo && window.onNativeInfo(" +
                        nativeInfoJson() +
                        ");"
        );
    }

    private void evaluateJs(String javascript) {
        if (!uiReady) return;
        runOnUiThread(() -> webView.evaluateJavascript(javascript, null));
    }

    private String nativeInfoJson() {
        try {
            JSONObject object = new JSONObject();
            object.put("bridgeVersion", "2.2");
            object.put("appVersion", BuildConfig.VERSION_NAME);
            object.put("uiSource", uiSource);
            object.put("remoteBase", REMOTE_BASE);
            object.put("volumeButtonsScanEnabled", volumeButtonsScanEnabled);
            return object.toString();
        } catch (Exception ignored) {
            return "{}";
        }
    }

    private void saveBase64File(String requestedName, String mimeType, String base64Data) {
        fileExecutor.execute(() -> {
            String safeName = sanitizeFileName(requestedName);
            String mime = (mimeType == null || mimeType.trim().isEmpty())
                    ? "application/octet-stream"
                    : mimeType.trim();

            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                String savedAs;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/BricoLab");
                    values.put(MediaStore.Downloads.IS_PENDING, 1);

                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("Nie udało się utworzyć pliku");

                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new IllegalStateException("Brak strumienia zapisu");
                        out.write(bytes);
                    }

                    ContentValues done = new ContentValues();
                    done.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(uri, done, null, null);
                    savedAs = "Pobrane/BricoLab/" + safeName;
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getFilesDir();
                    File target = new File(dir, safeName);
                    try (FileOutputStream out = new FileOutputStream(target)) {
                        out.write(bytes);
                    }
                    savedAs = target.getAbsolutePath();
                }

                final String finalSavedAs = savedAs;
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Zapisano: " + finalSavedAs, Toast.LENGTH_LONG).show();
                    try {
                        JSONObject payload = new JSONObject();
                        payload.put("ok", true);
                        payload.put("file", finalSavedAs);
                        evaluateJs("window.onNativeFileSaved && window.onNativeFileSaved(" + payload + ");");
                    } catch (Exception ignored) {
                    }
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Błąd zapisu pliku: " + error.getMessage(), Toast.LENGTH_LONG).show();
                    try {
                        JSONObject payload = new JSONObject();
                        payload.put("ok", false);
                        payload.put("error", String.valueOf(error.getMessage()));
                        evaluateJs("window.onNativeFileSaved && window.onNativeFileSaved(" + payload + ");");
                    } catch (Exception ignored) {
                    }
                });
            }
        });
    }

    private String sanitizeFileName(String name) {
        String value = name == null ? "bricolab-export.dat" : name.trim();
        if (value.isEmpty()) value = "bricolab-export.dat";
        value = value.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (value.length() > 120) value = value.substring(0, 120);
        return value;
    }

    public class NativeBridge {

        @JavascriptInterface
        public void startScanner() {
            runOnUiThread(MainActivity.this::requestScannerStart);
        }

        @JavascriptInterface
        public void stopScanner() {
            runOnUiThread(scannerEngine::stop);
        }

        @JavascriptInterface
        public void setPaused(boolean paused) {
            runOnUiThread(() -> scannerEngine.setPaused(paused));
        }

        @JavascriptInterface
        public void focus() {
            runOnUiThread(() -> scannerEngine.focusCenter(true));
        }

        @JavascriptInterface
        public void setTorch(boolean enabled) {
            runOnUiThread(() -> scannerEngine.setTorch(enabled));
        }

        @JavascriptInterface
        public void setZoom(double linearZoom) {
            runOnUiThread(() -> scannerEngine.setLinearZoom((float) linearZoom));
        }

        @JavascriptInterface
        public void setPreviewVisible(boolean visible) {
            runOnUiThread(() ->
                    cameraContainer.setVisibility(visible ? View.VISIBLE : View.GONE)
            );
        }

        @JavascriptInterface
        public void setVolumeButtonsEnabled(boolean enabled) {
            runOnUiThread(() -> setVolumeButtonsScanEnabled(enabled));
        }

        @JavascriptInterface
        public boolean getVolumeButtonsEnabled() {
            return volumeButtonsScanEnabled;
        }

        @JavascriptInterface
        public void reloadConfig() {
            loadRemoteConfig(true);
        }

        @JavascriptInterface
        public void reloadUi() {
            loadRemoteUi();
        }

        @JavascriptInterface
        public void saveFile(String fileName, String mimeType, String base64Data) {
            saveBase64File(fileName, mimeType, base64Data);
        }

        @JavascriptInterface
        public String getConfig() {
            return currentConfigJson;
        }

        @JavascriptInterface
        public String getState() {
            return scannerEngine.stateJson();
        }

        @JavascriptInterface
        public String getNativeInfo() {
            return nativeInfoJson();
        }
    }

    @Override
    protected void onDestroy() {
        uiReady = false;

        if (scannerEngine != null) {
            scannerEngine.destroy();
        }

        networkExecutor.shutdownNow();
        fileExecutor.shutdownNow();

        if (webView != null) {
            webView.removeJavascriptInterface("NativeScanner");
            webView.destroy();
        }

        super.onDestroy();
    }
}
