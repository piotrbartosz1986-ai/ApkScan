package com.bricolab.scannerbridge;

import android.graphics.Color;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.MotionEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
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
    private static final String PREFS_NAME_LOCAL = "brico-scanner-bridge";
    private static final String PREF_CONFIG_OVERRIDE_LOCAL = "scanner-config-override";
    private static final String PREF_OVERLAY_CALIBRATION_LOCAL = "overlay-calibration-v1";

    private WebView controlWebView;
    private Button scanButton;
    private Button torchButton;
    private SeekBar zoomSeek;
    private TextView zoomLabel;
    private boolean zoomTouching = false;
    private boolean pendingTorchAfterStart = false;
    private boolean applyingStoredConfig = false;

    private int scanTransparencyPct = 25;
    private int torchTransparencyPct = 25;

    private final Runnable releaseZoomTouchRunnable = () -> {
        zoomTouching = false;
        refreshControls(readState());
    };

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
        applyOverlayCalibrationObject(loadOverlayCalibration());
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
            // Trzymaj blokadę synchronizacji także od ACTION_DOWN. Bez tego szybkie
            // callbacki ZoomState potrafiły cofnąć suwak do starszej pozycji i dawały
            // wrażenie skakania zamiast płynnego przesuwania.
            zoomSeek.setOnTouchListener((view, event) -> {
                int action = event.getActionMasked();
                if (action == MotionEvent.ACTION_DOWN) {
                    zoomSeek.removeCallbacks(releaseZoomTouchRunnable);
                    zoomTouching = true;
                } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                    zoomSeek.removeCallbacks(releaseZoomTouchRunnable);
                    zoomSeek.postDelayed(releaseZoomTouchRunnable, 180L);
                }
                return false;
            });

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
                    seekBar.removeCallbacks(releaseZoomTouchRunnable);
                    zoomTouching = true;
                }

                @Override
                public void onStopTrackingTouch(SeekBar seekBar) {
                    // CameraX wysyła jeszcze kilka stanów po puszczeniu palca.
                    // Krótki bufor nie pozwala tym starszym stanom przestawić kropki.
                    seekBar.removeCallbacks(releaseZoomTouchRunnable);
                    seekBar.postDelayed(releaseZoomTouchRunnable, 180L);
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
            applyControlStyle(scanButton, active ? ACTIVE_GREEN : INACTIVE_RED, scanTransparencyPct);
        }

        if (torchButton != null) {
            torchButton.setText("🔦");
            applyControlStyle(torchButton, torch ? ACTIVE_GREEN : INACTIVE_RED, torchTransparencyPct);
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

    private void applyControlStyle(Button button, int solidColor, int transparencyPct) {
        if (button == null) return;

        int alpha = alphaFromTransparency(transparencyPct);
        int fill = Color.argb(
                alpha,
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

    private JSONObject defaultOverlayCalibration() {
        JSONObject root = new JSONObject();
        try {
            JSONObject scan = new JSONObject();
            scan.put("left", 3);
            scan.put("bottom", 3);
            scan.put("width", 64);
            scan.put("height", 24);
            scan.put("transparency", 25);
            root.put("scan", scan);

            JSONObject torch = new JSONObject();
            torch.put("left", 70);
            torch.put("bottom", 3);
            torch.put("width", 32);
            torch.put("height", 24);
            torch.put("transparency", 25);
            root.put("torch", torch);

            JSONObject zoom = new JSONObject();
            zoom.put("right", -48);
            zoom.put("y", 0);
            zoom.put("length", 171);
            zoom.put("touchWidth", 58);
            zoom.put("transparency", 10);
            zoom.put("trackWidth", 8);
            zoom.put("trackColor", "#36927F");
            zoom.put("thumbColor", "#FFFFFF");
            zoom.put("thumbSize", 22);
            root.put("zoom", zoom);

            JSONObject label = new JSONObject();
            label.put("right", 25);
            label.put("bottom", 3);
            label.put("width", 46);
            label.put("height", 26);
            label.put("transparency", 10);
            root.put("zoomLabel", label);
        } catch (Exception ignored) {
        }
        return root;
    }

    private JSONObject normalizeOverlayCalibration(JSONObject raw) {
        JSONObject out = new JSONObject();
        if (raw == null) raw = new JSONObject();

        try {
            JSONObject s = raw.optJSONObject("scan");
            if (s == null) s = new JSONObject();
            JSONObject scan = new JSONObject();
            scan.put("left", intValue(s, "left", 3, -40, 320));
            scan.put("bottom", intValue(s, "bottom", 3, -40, 160));
            scan.put("width", intValue(s, "width", 64, 30, 180));
            scan.put("height", intValue(s, "height", 24, 24, 100));
            scan.put("transparency", intValue(s, "transparency", 25, 0, 95));
            out.put("scan", scan);

            JSONObject t = raw.optJSONObject("torch");
            if (t == null) t = new JSONObject();
            JSONObject torch = new JSONObject();
            torch.put("left", intValue(t, "left", 70, -40, 340));
            torch.put("bottom", intValue(t, "bottom", 3, -40, 160));
            torch.put("width", intValue(t, "width", 32, 30, 160));
            torch.put("height", intValue(t, "height", 24, 24, 100));
            torch.put("transparency", intValue(t, "transparency", 25, 0, 95));
            out.put("torch", torch);

            JSONObject z = raw.optJSONObject("zoom");
            if (z == null) z = new JSONObject();
            JSONObject zoom = new JSONObject();
            zoom.put("right", intValue(z, "right", -48, -140, 120));
            zoom.put("y", intValue(z, "y", 0, -140, 140));
            zoom.put("length", intValue(z, "length", 171, 70, 280));
            zoom.put("touchWidth", intValue(z, "touchWidth", 58, 28, 110));
            zoom.put("transparency", intValue(z, "transparency", 10, 0, 95));
            zoom.put("trackWidth", intValue(z, "trackWidth", 8, 1, 14));
            zoom.put("trackColor", colorValue(z, "trackColor", "#36927F"));
            zoom.put("thumbColor", colorValue(z, "thumbColor", "#FFFFFF"));
            zoom.put("thumbSize", intValue(z, "thumbSize", 22, 10, 52));
            out.put("zoom", zoom);

            JSONObject l = raw.optJSONObject("zoomLabel");
            if (l == null) l = new JSONObject();
            JSONObject label = new JSONObject();
            label.put("right", intValue(l, "right", 25, -40, 160));
            label.put("bottom", intValue(l, "bottom", 3, -40, 160));
            label.put("width", intValue(l, "width", 46, 28, 100));
            label.put("height", intValue(l, "height", 26, 18, 60));
            label.put("transparency", intValue(l, "transparency", 10, 0, 95));
            out.put("zoomLabel", label);
        } catch (Exception ignored) {
            return defaultOverlayCalibration();
        }
        return out;
    }

    private JSONObject loadOverlayCalibration() {
        String saved = getSharedPreferences(PREFS_NAME_LOCAL, MODE_PRIVATE)
                .getString(PREF_OVERLAY_CALIBRATION_LOCAL, null);
        if (saved == null || saved.trim().isEmpty()) return defaultOverlayCalibration();
        try {
            return normalizeOverlayCalibration(new JSONObject(saved));
        } catch (Exception ignored) {
            return defaultOverlayCalibration();
        }
    }

    private void applyOverlayCalibrationJson(String json, boolean persist) {
        JSONObject raw;
        try {
            raw = new JSONObject(json == null ? "{}" : json);
        } catch (Exception ignored) {
            raw = new JSONObject();
        }

        final JSONObject normalized = normalizeOverlayCalibration(raw);
        if (persist) {
            getSharedPreferences(PREFS_NAME_LOCAL, MODE_PRIVATE)
                    .edit()
                    .putString(PREF_OVERLAY_CALIBRATION_LOCAL, normalized.toString())
                    .apply();
        }

        runOnUiThread(() -> {
            applyOverlayCalibrationObject(normalized);
            refreshControls(readState());
        });
    }

    private void resetOverlayCalibrationPersistent() {
        getSharedPreferences(PREFS_NAME_LOCAL, MODE_PRIVATE)
                .edit()
                .remove(PREF_OVERLAY_CALIBRATION_LOCAL)
                .apply();
        final JSONObject defaults = defaultOverlayCalibration();
        runOnUiThread(() -> {
            applyOverlayCalibrationObject(defaults);
            refreshControls(readState());
        });
    }

    private void applyOverlayCalibrationObject(JSONObject root) {
        if (root == null) root = defaultOverlayCalibration();

        JSONObject scan = root.optJSONObject("scan");
        JSONObject torch = root.optJSONObject("torch");
        JSONObject zoom = root.optJSONObject("zoom");
        JSONObject label = root.optJSONObject("zoomLabel");

        if (scan != null && scanButton != null) {
            scanTransparencyPct = scan.optInt("transparency", 25);
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) scanButton.getLayoutParams();
            lp.width = dpInt(scan.optInt("width", 64));
            lp.height = dpInt(scan.optInt("height", 24));
            lp.leftMargin = Math.round(dp(scan.optInt("left", 3)));
            lp.bottomMargin = Math.round(dp(scan.optInt("bottom", 3)));
            lp.gravity = Gravity.BOTTOM | Gravity.START;
            scanButton.setLayoutParams(lp);
        }

        if (torch != null && torchButton != null) {
            torchTransparencyPct = torch.optInt("transparency", 25);
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) torchButton.getLayoutParams();
            lp.width = dpInt(torch.optInt("width", 32));
            lp.height = dpInt(torch.optInt("height", 24));
            lp.leftMargin = Math.round(dp(torch.optInt("left", 70)));
            lp.bottomMargin = Math.round(dp(torch.optInt("bottom", 3)));
            lp.gravity = Gravity.BOTTOM | Gravity.START;
            torchButton.setLayoutParams(lp);
        }

        if (zoom != null && zoomSeek != null) {
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) zoomSeek.getLayoutParams();
            lp.width = dpInt(zoom.optInt("length", 171));
            lp.height = dpInt(zoom.optInt("touchWidth", 58));
            lp.rightMargin = Math.round(dp(zoom.optInt("right", -48)));
            lp.gravity = Gravity.CENTER_VERTICAL | Gravity.END;
            zoomSeek.setLayoutParams(lp);
            zoomSeek.setTranslationY(dp(zoom.optInt("y", 0)));
            zoomSeek.setAlpha(1f - clampInt(zoom.optInt("transparency", 10), 0, 95) / 100f);
            applyZoomDrawable(
                    zoom.optInt("trackWidth", 8),
                    zoom.optString("trackColor", "#36927F"),
                    zoom.optString("thumbColor", "#FFFFFF"),
                    zoom.optInt("thumbSize", 22)
            );
        }

        if (label != null && zoomLabel != null) {
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) zoomLabel.getLayoutParams();
            lp.width = dpInt(label.optInt("width", 46));
            lp.height = dpInt(label.optInt("height", 26));
            lp.rightMargin = Math.round(dp(label.optInt("right", 25)));
            lp.bottomMargin = Math.round(dp(label.optInt("bottom", 3)));
            lp.gravity = Gravity.BOTTOM | Gravity.END;
            zoomLabel.setLayoutParams(lp);
            zoomLabel.setAlpha(1f - clampInt(label.optInt("transparency", 10), 0, 95) / 100f);
        }
    }

    private void applyZoomDrawable(int trackWidthDp, String trackColorValue, String thumbColorValue, int thumbSizeDp) {
        if (zoomSeek == null) return;

        int trackColor = parseColorSafe(trackColorValue, Color.rgb(54, 146, 127));
        int thumbColor = parseColorSafe(thumbColorValue, Color.WHITE);
        int trackHeight = dpInt(clampInt(trackWidthDp, 1, 14));

        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.RECTANGLE);
        background.setColor(Color.argb(85, Color.red(trackColor), Color.green(trackColor), Color.blue(trackColor)));
        background.setCornerRadius(trackHeight / 2f);

        GradientDrawable progress = new GradientDrawable();
        progress.setShape(GradientDrawable.RECTANGLE);
        progress.setColor(trackColor);
        progress.setCornerRadius(trackHeight / 2f);

        ClipDrawable clippedProgress = new ClipDrawable(progress, Gravity.START, ClipDrawable.HORIZONTAL);
        LayerDrawable layers = new LayerDrawable(new Drawable[]{background, clippedProgress});
        layers.setId(0, android.R.id.background);
        layers.setId(1, android.R.id.progress);
        layers.setLayerHeight(0, trackHeight);
        layers.setLayerHeight(1, trackHeight);
        layers.setLayerGravity(0, Gravity.CENTER_VERTICAL);
        layers.setLayerGravity(1, Gravity.CENTER_VERTICAL);
        zoomSeek.setProgressDrawable(layers);

        GradientDrawable thumb = new GradientDrawable();
        thumb.setShape(GradientDrawable.OVAL);
        thumb.setColor(thumbColor);
        int thumbSize = dpInt(clampInt(thumbSizeDp, 10, 52));
        thumb.setSize(thumbSize, thumbSize);
        thumb.setStroke(Math.max(1, Math.round(dp(1f))), Color.argb(180, 45, 45, 45));
        zoomSeek.setThumb(thumb);
    }

    private int intValue(JSONObject object, String key, int fallback, int min, int max) {
        return clampInt(object == null ? fallback : object.optInt(key, fallback), min, max);
    }

    private String colorValue(JSONObject object, String key, String fallback) {
        String value = object == null ? fallback : object.optString(key, fallback).trim();
        try {
            Color.parseColor(value);
            return value.toUpperCase(Locale.US);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private int parseColorSafe(String value, int fallback) {
        try {
            return Color.parseColor(value);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private int alphaFromTransparency(int transparencyPct) {
        int safe = clampInt(transparencyPct, 0, 95);
        return Math.round(255f * (1f - safe / 100f));
    }

    private static int clampInt(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private int dpInt(float value) {
        return Math.max(1, Math.round(dp(value)));
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

        @JavascriptInterface
        public String getOverlayCalibration() {
            return loadOverlayCalibration().toString();
        }

        @JavascriptInterface
        public void applyOverlayCalibration(String json) {
            applyOverlayCalibrationJson(json, true);
        }

        @JavascriptInterface
        public void resetOverlayCalibration() {
            resetOverlayCalibrationPersistent();
        }
    }
}
