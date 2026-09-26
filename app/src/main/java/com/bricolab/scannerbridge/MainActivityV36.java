package com.bricolab.scannerbridge;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.TextView;

import org.json.JSONObject;

import java.lang.reflect.Field;
import java.util.Locale;

/**
 * Native controls over the proven v2.7 CameraX core.
 * START/STOP intentionally duplicates the exact working web path from test C.
 */
public class MainActivityV36 extends MainActivityV25 {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);
    private static final int CONTROL_FILL_ALPHA = 230; // ok. 10% przezroczystości tła
    private static final String PREFS_NAME_LOCAL = "brico-scanner-bridge";
    private static final String PREF_CONFIG_OVERRIDE_LOCAL = "scanner-config-override";

    private WebView controlWebView;
    private Button scanButton;
    private Button torchButton;
    private SeekBar zoomSeek;
    private TextView zoomLabel;
    private boolean zoomTouching = false;
    private boolean pendingTorchAfterStart = false;
    private boolean applyingStoredConfig = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        controlWebView = findViewById(R.id.webView);
        scanButton = findViewById(R.id.cameraScanToggle);
        torchButton = findViewById(R.id.cameraTorchToggle);
        zoomSeek = findViewById(R.id.zoomSeek);
        zoomLabel = findViewById(R.id.zoomLabel);

        if (controlWebView != null) {
            controlWebView.removeJavascriptInterface("NativeScanner");
            controlWebView.addJavascriptInterface(new PersistentNativeBridge(), "NativeScanner");
        }

        installCameraControls();
        refreshControls(readState());
        restoreConfigOverrideIfNeeded();
    }

    private void installCameraControls() {
        if (scanButton != null) {
            scanButton.setOnClickListener(v -> triggerProvenCameraToggle());
        }

        if (torchButton != null) {
            torchButton.setOnClickListener(v -> {
                JSONObject state = readState();
                boolean running = state.optBoolean("running", false);
                boolean torch = state.optBoolean("torch", false);

                if (running) {
                    new NativeBridge().setTorch(!torch);
                } else {
                    pendingTorchAfterStart = true;
                    triggerProvenCameraToggle();
                }
            });
        }

        if (zoomSeek != null) {
            zoomSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
                @Override
                public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                    if (!fromUser) return;
                    JSONObject state = readState();
                    if (!state.optBoolean("running", false)) return;
                    new NativeBridge().setZoom(progress / 1000.0);
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
        }
    }

    private void triggerProvenCameraToggle() {
        WebView view = controlWebView;
        if (view == null) return;
        view.evaluateJavascript(
                "window.bricoGoodCameraToggle && window.bricoGoodCameraToggle();",
                null
        );
    }

    @Override
    public void onState(String stateJson) {
        super.onState(stateJson);

        runOnUiThread(() -> {
            try {
                JSONObject state = new JSONObject(stateJson);
                String event = state.optString("event", "");

                if (("started".equals(event) || "already_running".equals(event)) && pendingTorchAfterStart) {
                    pendingTorchAfterStart = false;
                    new NativeBridge().setTorch(true);
                }

                if ("config_applied".equals(event) && !applyingStoredConfig) {
                    restoreConfigOverrideIfNeeded();
                }

                refreshControls(state);
            } catch (Exception ignored) {
                refreshControls(readState());
            }
        });
    }

    private JSONObject readState() {
        try {
            String json = new NativeBridge().getState();
            return new JSONObject(json == null ? "{}" : json);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private void refreshControls(JSONObject state) {
        boolean running = state.optBoolean("running", false);
        boolean paused = state.optBoolean("paused", false);
        boolean active = running && !paused;
        boolean torch = state.optBoolean("torch", false);
        boolean flashAvailable = state.optBoolean("flashAvailable", false);

        if (scanButton != null) {
            scanButton.setText(active ? "STOP" : "START");
            applyControlStyle(scanButton, active ? ACTIVE_GREEN : INACTIVE_RED);
        }

        if (torchButton != null) {
            torchButton.setText("🔦");
            applyControlStyle(torchButton, torch ? ACTIVE_GREEN : INACTIVE_RED);
            torchButton.setEnabled(!running || flashAvailable);
        }

        double zoom = state.optDouble("zoom", 1.0);
        double linear = state.optDouble("linearZoom", 0.0);

        if (zoomLabel != null) {
            zoomLabel.setText(String.format(Locale.US, "%.1f×", zoom));
        }

        if (zoomSeek != null) {
            zoomSeek.setEnabled(running);
            if (!zoomTouching) {
                int progress = (int) Math.round(Math.max(0.0, Math.min(1.0, linear)) * 1000.0);
                zoomSeek.setProgress(progress);
            }
        }
    }

    private void applyControlStyle(Button button, int solidColor) {
        if (button == null) return;

        int fill = Color.argb(
                CONTROL_FILL_ALPHA,
                Color.red(solidColor),
                Color.green(solidColor),
                Color.blue(solidColor)
        );

        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.RECTANGLE);
        background.setColor(fill);
        background.setStroke(Math.max(1, Math.round(dp(1f))), solidColor);
        background.setCornerRadius(dp(5f));

        button.setBackground(background);
        button.setTextColor(Color.WHITE);
        button.setAlpha(1f);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }

    private ScannerEngine scannerEngineReflect() {
        try {
            Field field = MainActivity.class.getDeclaredField("scannerEngine");
            field.setAccessible(true);
            return (ScannerEngine) field.get(this);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void setCurrentConfigJsonReflect(String json) {
        try {
            Field field = MainActivity.class.getDeclaredField("currentConfigJson");
            field.setAccessible(true);
            field.set(this, json);
        } catch (Exception ignored) {
        }
    }

    private String savedConfigOverride() {
        return getSharedPreferences(PREFS_NAME_LOCAL, MODE_PRIVATE)
                .getString(PREF_CONFIG_OVERRIDE_LOCAL, null);
    }

    private void restoreConfigOverrideIfNeeded() {
        String saved = savedConfigOverride();
        if (saved == null || saved.trim().isEmpty() || applyingStoredConfig) return;

        String current = new NativeBridge().getConfig();
        String normalizedSaved = ScannerConfig.fromJson(saved).toJson();
        if (normalizedSaved.equals(current)) return;

        applyConfigOverride(normalizedSaved, false);
    }

    private void applyConfigOverride(String json, boolean persist) {
        if (json == null || json.trim().isEmpty()) return;

        runOnUiThread(() -> {
            if (applyingStoredConfig) return;
            applyingStoredConfig = true;
            try {
                ScannerConfig config = ScannerConfig.fromJson(json);
                String normalized = config.toJson();

                if (persist) {
                    getSharedPreferences(PREFS_NAME_LOCAL, MODE_PRIVATE)
                            .edit()
                            .putString(PREF_CONFIG_OVERRIDE_LOCAL, normalized)
                            .apply();
                }

                ScannerEngine engine = scannerEngineReflect();
                if (engine != null) {
                    boolean wasRunning = engine.isRunning();
                    if (wasRunning) engine.stop();
                    engine.applyConfig(config);
                    setCurrentConfigJsonReflect(normalized);
                    if (wasRunning) engine.start();
                } else {
                    setCurrentConfigJsonReflect(normalized);
                }
            } finally {
                applyingStoredConfig = false;
            }
        });
    }

    private void clearConfigOverridePersistent() {
        getSharedPreferences(PREFS_NAME_LOCAL, MODE_PRIVATE)
                .edit()
                .remove(PREF_CONFIG_OVERRIDE_LOCAL)
                .apply();
        new NativeBridge().reloadConfig();
    }

    public class PersistentNativeBridge {
        private final NativeBridge base = new NativeBridge();

        @JavascriptInterface public void startScanner() { base.startScanner(); }
        @JavascriptInterface public void stopScanner() { base.stopScanner(); }
        @JavascriptInterface public void setPaused(boolean paused) { base.setPaused(paused); }
        @JavascriptInterface public void focus() { base.focus(); }
        @JavascriptInterface public void setTorch(boolean enabled) { base.setTorch(enabled); }
        @JavascriptInterface public void setZoom(double linearZoom) { base.setZoom(linearZoom); }
        @JavascriptInterface public void setPreviewVisible(boolean visible) { base.setPreviewVisible(visible); }
        @JavascriptInterface public void setVolumeButtonsEnabled(boolean enabled) { base.setVolumeButtonsEnabled(enabled); }
        @JavascriptInterface public boolean getVolumeButtonsEnabled() { return base.getVolumeButtonsEnabled(); }
        @JavascriptInterface public void reloadConfig() { base.reloadConfig(); }
        @JavascriptInterface public void reloadUi() { base.reloadUi(); }
        @JavascriptInterface public void saveFile(String fileName, String mimeType, String base64Data) { base.saveFile(fileName, mimeType, base64Data); }
        @JavascriptInterface public String getState() { return base.getState(); }
        @JavascriptInterface public String getNativeInfo() { return base.getNativeInfo(); }

        @JavascriptInterface
        public String getConfig() {
            String saved = savedConfigOverride();
            return saved != null && !saved.trim().isEmpty() ? saved : base.getConfig();
        }

        @JavascriptInterface
        public void applyConfig(String json) {
            applyConfigOverride(json, true);
        }

        @JavascriptInterface
        public void clearConfigOverride() {
            clearConfigOverridePersistent();
        }
    }
}
