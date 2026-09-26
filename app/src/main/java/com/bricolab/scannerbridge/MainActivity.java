package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
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
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.SeekBar;
import android.widget.TextView;
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
import java.util.Locale;
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
    private static final String PREF_CONFIG_OVERRIDE = "scanner-config-override";

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);
    private static final int OVERLAY_DARK = Color.argb(190, 0, 0, 0);

    private WebView webView;
    private FrameLayout cameraContainer;
    private PreviewView previewView;
    private PreviewView contextPreviewView;
    private FrameLayout contextPreviewBox;
    private ContextGuideView contextGuide;
    private Button cameraScanToggle;
    private Button cameraTorchToggle;
    private TextView cameraScanState;
    private TextView zoomLabel;
    private SeekBar zoomSeek;

    private ScannerEngine scannerEngine;
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService fileExecutor = Executors.newSingleThreadExecutor();

    private volatile String currentConfigJson = new ScannerConfig().toJson();
    private volatile boolean uiReady = false;
    private volatile String uiSource = "starting";
    private volatile boolean volumeButtonsScanEnabled = true;
    private boolean pendingStartAfterPermission = false;
    private boolean zoomTouching = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        volumeButtonsScanEnabled = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getBoolean(PREF_VOLUME_SCAN, true);

        webView = findViewById(R.id.webView);
        cameraContainer = findViewById(R.id.cameraContainer);
        previewView = findViewById(R.id.previewView);
        contextPreviewView = findViewById(R.id.contextPreviewView);
        contextPreviewBox = findViewById(R.id.contextPreviewBox);
        contextGuide = findViewById(R.id.contextGuide);
        cameraScanToggle = findViewById(R.id.cameraScanToggle);
        cameraTorchToggle = findViewById(R.id.cameraTorchToggle);
        cameraScanState = findViewById(R.id.cameraScanState);
        zoomLabel = findViewById(R.id.zoomLabel);
        zoomSeek = findViewById(R.id.zoomSeek);

        cameraContainer.setVisibility(View.VISIBLE);
        contextPreviewBox.setVisibility(View.GONE);

        scannerEngine = new ScannerEngine(this, previewView, contextPreviewView, this);

        setupCameraControls();
        configureWebView();
        loadRemoteConfig(false);
        loadRemoteUi();

        requestScannerStart();
    }

    private void setupCameraControls() {
        cameraScanToggle.setOnClickListener(v -> {
            if (!scannerEngine.isRunning()) {
                requestScannerStart();
                return;
            }
            scannerEngine.setPaused(!scannerEngine.isPaused());
        });

        cameraTorchToggle.setOnClickListener(v -> {
            if (!scannerEngine.isRunning()) {
                requestScannerStart();
                return;
            }
            scannerEngine.setTorch(!scannerEngine.isTorchOn());
        });

        zoomSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser && scannerEngine != null) {
                    scannerEngine.setCombinedZoom(progress / 1000f);
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                zoomTouching = true;
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                zoomTouching = false;
            }
        });

        updateCameraControls(scannerEngine.stateJson());
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
        webView.addJavascriptInterface(new NativeUploadBridge(), "BricoUpload");
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

            String localOverride = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .getString(PREF_CONFIG_OVERRIDE, null);

            if (localOverride != null && !localOverride.trim().isEmpty()) {
                json = localOverride;
                source = "local";
            } else {
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
            }

            ScannerConfig config = ScannerConfig.fromJson(json);
            String normalized = config.toJson();
            final String finalSource = source;

            runOnUiThread(() -> {
                boolean wasRunning = scannerEngine.isRunning();
                if (wasRunning) scannerEngine.stop();

                scannerEngine.applyConfig(config);
                currentConfigJson = normalized;

                if (wasRunning) scannerEngine.start();
                pushConfigToWeb(finalSource);
            });
        });
    }

    private void applyConfigFromWeb(String json) {
        runOnUiThread(() -> {
            ScannerConfig config = ScannerConfig.fromJson(json);
            String normalized = config.toJson();
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .putString(PREF_CONFIG_OVERRIDE, normalized)
                    .apply();

            boolean wasRunning = scannerEngine.isRunning();
            if (wasRunning) scannerEngine.stop();
            scannerEngine.applyConfig(config);
            currentConfigJson = normalized;
            if (wasRunning) scannerEngine.start();
            pushConfigToWeb("local");
        });
    }

    private void clearConfigOverride() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .remove(PREF_CONFIG_OVERRIDE)
                .apply();
        loadRemoteConfig(true);
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
        connection.setRequestProperty("User-Agent", "BricoScannerBridge/3.1");

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
            while ((line = reader.readLine()) != null) output.append(line).append('\n');
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
            while ((line = reader.readLine()) != null) output.append(line).append('\n');
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

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
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
        updateCameraControls(stateJson);
        pushStateToWeb(stateJson);
    }

    private void updateCameraControls(String stateJson) {
        runOnUiThread(() -> {
            try {
                JSONObject state = new JSONObject(stateJson);
                boolean running = state.optBoolean("running", false);
                boolean paused = state.optBoolean("paused", false);
                boolean active = running && !paused;
                boolean torch = state.optBoolean("torch", false);

                int scanColor = active ? ACTIVE_GREEN : INACTIVE_RED;
                cameraScanToggle.setText(active ? "STOP" : "SKAN");
                cameraScanToggle.setBackgroundTintList(ColorStateList.valueOf(scanColor));
                cameraScanState.setText(active ? "SKANOWANIE" : "SKAN WYŁ.");
                cameraScanState.setBackgroundColor(scanColor);

                cameraTorchToggle.setText(torch ? "LATARKA ON" : "LATARKA");
                cameraTorchToggle.setBackgroundTintList(
                        ColorStateList.valueOf(torch ? ACTIVE_GREEN : OVERLAY_DARK)
                );

                double totalZoom = state.optDouble("totalZoom", 1.0);
                zoomLabel.setText(String.format(Locale.US, "%.1f×", totalZoom));

                double combined = state.optDouble("combinedZoom", 0.0);
                if (!zoomTouching) {
                    zoomSeek.setProgress((int) Math.round(Math.max(0.0, Math.min(1.0, combined)) * 1000.0));
                }
            } catch (Exception ignored) {
            }
        });
    }

    void onDigitalZoomChanged(float digitalZoom, boolean showContext) {
        runOnUiThread(() -> {
            previewView.setPivotX(previewView.getWidth() / 2f);
            previewView.setPivotY(previewView.getHeight() / 2f);
            previewView.setScaleX(digitalZoom);
            previewView.setScaleY(digitalZoom);
            contextGuide.setDigitalZoom(digitalZoom);
            contextPreviewBox.setVisibility(showContext ? View.VISIBLE : View.GONE);
        });
    }

    void onNativeZoomState(float hardwareZoom, float digitalZoom, float combinedZoom) {
        runOnUiThread(() -> {
            float total = hardwareZoom * digitalZoom;
            zoomLabel.setText(String.format(Locale.US, "%.1f×", total));
            if (!zoomTouching) {
                zoomSeek.setProgress((int) Math.round(Math.max(0f, Math.min(1f, combinedZoom)) * 1000f));
            }
        });
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
            object.put("bridgeVersion", "3.1");
            object.put("appVersion", BuildConfig.VERSION_NAME);
            object.put("uiSource", uiSource);
            object.put("remoteBase", REMOTE_BASE);
            object.put("volumeButtonsScanEnabled", volumeButtonsScanEnabled);
            object.put("nativeUpload", true);
            object.put("nativeProductFeedback", true);
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
            runOnUiThread(() -> {
                if (scannerEngine.isRunning()) scannerEngine.setPaused(true);
            });
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
        public void setZoom(double combinedZoom) {
            runOnUiThread(() -> scannerEngine.setCombinedZoom((float) combinedZoom));
        }

        @JavascriptInterface
        public void setPreviewVisible(boolean visible) {
            runOnUiThread(() -> cameraContainer.setVisibility(View.VISIBLE));
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
        public void applyConfig(String json) {
            applyConfigFromWeb(json);
        }

        @JavascriptInterface
        public void clearConfigOverride() {
            clearConfigOverride();
        }

        @JavascriptInterface
        public void productFeedback(boolean found) {
            runOnUiThread(() -> {
                if (found) scannerEngine.productFoundFeedback();
                else scannerEngine.productMissingFeedback();
            });
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

    public class NativeUploadBridge {

        @JavascriptInterface
        public void uploadJson(String endpoint, String token, String payloadJson) {
            networkExecutor.execute(() -> {
                HttpURLConnection connection = null;
                JSONObject result = new JSONObject();

                try {
                    String safeEndpoint = endpoint == null ? "" : endpoint.trim();
                    String safeToken = token == null ? "" : token.trim();
                    String safePayload = payloadJson == null ? "" : payloadJson;

                    if (!safeEndpoint.startsWith("https://")) {
                        throw new IllegalArgumentException("Adres serwera musi zaczynać się od https://");
                    }
                    if (safeToken.isEmpty()) {
                        throw new IllegalArgumentException("Brak klucza wysyłania");
                    }
                    if (safePayload.trim().isEmpty()) {
                        throw new IllegalArgumentException("Brak danych do wysłania");
                    }

                    URL url = new URL(safeEndpoint);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("POST");
                    connection.setConnectTimeout(12000);
                    connection.setReadTimeout(12000);
                    connection.setUseCaches(false);
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setRequestProperty("Authorization", "Bearer " + safeToken);
                    connection.setRequestProperty("User-Agent", "BricoScannerBridge/3.1");

                    byte[] bytes = safePayload.getBytes(StandardCharsets.UTF_8);
                    connection.setFixedLengthStreamingMode(bytes.length);
                    try (OutputStream output = connection.getOutputStream()) {
                        output.write(bytes);
                    }

                    int httpCode = connection.getResponseCode();
                    InputStream input = (httpCode >= 200 && httpCode < 400)
                            ? connection.getInputStream()
                            : connection.getErrorStream();
                    String body = input == null ? "" : readStream(input).trim();

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

                    boolean ok = httpCode >= 200 && httpCode < 300 &&
                            server != null && server.optBoolean("ok", false);
                    result.put("ok", ok);

                    if (!ok) {
                        String message = server != null
                                ? server.optString("error", "HTTP " + httpCode)
                                : "HTTP " + httpCode;
                        result.put("error", message);
                    }
                } catch (Exception error) {
                    try {
                        result.put("ok", false);
                        result.put("error", error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()));
                    } catch (Exception ignored) {
                    }
                } finally {
                    if (connection != null) connection.disconnect();
                }

                final String responseJson = result.toString();
                evaluateJs(
                        "window.onNativeUploadResult && window.onNativeUploadResult(" +
                                responseJson +
                                ");"
                );
            });
        }
    }

    @Override
    protected void onDestroy() {
        uiReady = false;

        if (scannerEngine != null) scannerEngine.destroy();

        networkExecutor.shutdownNow();
        fileExecutor.shutdownNow();

        if (webView != null) {
            webView.removeJavascriptInterface("NativeScanner");
            webView.removeJavascriptInterface("BricoUpload");
            webView.destroy();
        }

        super.onDestroy();
    }
}
