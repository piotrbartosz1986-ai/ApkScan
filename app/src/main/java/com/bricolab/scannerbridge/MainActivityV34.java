package com.bricolab.scannerbridge;

import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.SeekBar;

import androidx.camera.view.PreviewView;

import org.json.JSONObject;

import java.lang.reflect.Field;

/**
 * v3.2.3 camera bridge.
 *
 * START/STOP overlay buttons are deliberately NOT overridden here.
 * They use MainActivity's original direct requestScannerStart() path.
 * The settings checkbox uses the same NativeBridge.startScanner() path.
 */
public class MainActivityV34 extends MainActivityV25 {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);

    private boolean previewVisible = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        PreviewView preview = findViewById(R.id.previewView);
        if (preview != null) {
            // Exact implementation mode used by the earlier working preview build.
            preview.setImplementationMode(PreviewView.ImplementationMode.PERFORMANCE);
        }

        WebView webView = findViewById(R.id.webView);
        if (webView != null) {
            webView.removeJavascriptInterface("NativeScanner");
            webView.addJavascriptInterface(new StableNativeBridge(), "NativeScanner");
        }

        applyZoomThumbStyle();
        paintButtons();
    }

    /**
     * Same base bridge as the old working version. Only preview visibility,
     * full stop and one-tap torch startup are adjusted.
     */
    public class StableNativeBridge extends NativeBridge {

        @Override
        @JavascriptInterface
        public void startScanner() {
            runOnUiThread(() -> {
                FrameLayout container = findViewById(R.id.cameraContainer);
                if (container != null) container.setVisibility(View.VISIBLE);
                previewVisible = true;
                // Calls MainActivity.NativeBridge.startScanner(), which in turn
                // calls the original requestScannerStart().
                StableNativeBridge.super.startScanner();
            });
        }

        @Override
        @JavascriptInterface
        public void stopScanner() {
            runOnUiThread(() -> {
                ScannerEngine engine = scannerEngine();
                if (engine != null) engine.stop();
            });
        }

        @Override
        @JavascriptInterface
        public void setPreviewVisible(boolean visible) {
            runOnUiThread(() -> {
                previewVisible = visible;
                FrameLayout container = findViewById(R.id.cameraContainer);
                ScannerEngine engine = scannerEngine();

                if (visible) {
                    if (container != null) container.setVisibility(View.VISIBLE);
                    // Reproduce the old checkbox model, but also start the camera
                    // so this checkbox is a real independent recovery path.
                    StableNativeBridge.super.startScanner();
                } else {
                    if (engine != null) engine.stop();
                    if (container != null) container.setVisibility(View.GONE);
                }
            });
        }

        @JavascriptInterface
        public boolean isPreviewVisible() {
            return previewVisible;
        }

        @Override
        @JavascriptInterface
        public void setTorch(boolean enabled) {
            runOnUiThread(() -> {
                ScannerEngine engine = scannerEngine();
                if (engine != null && engine.isRunning()) {
                    engine.setTorch(enabled);
                    return;
                }
                if (enabled) {
                    FrameLayout container = findViewById(R.id.cameraContainer);
                    if (container != null) container.setVisibility(View.VISIBLE);
                    previewVisible = true;
                    StableNativeBridge.super.startScanner();
                    armTorchAfterStart(0);
                }
            });
        }
    }

    private void armTorchAfterStart(int attempt) {
        if (attempt > 15) return;
        getWindow().getDecorView().postDelayed(() -> {
            ScannerEngine engine = scannerEngine();
            if (engine == null) return;
            if (engine.isRunning()) {
                engine.setTorch(true);
            } else {
                armTorchAfterStart(attempt + 1);
            }
        }, attempt == 0 ? 300L : 160L);
    }

    @Override
    public void onState(String stateJson) {
        super.onState(stateJson);
        runOnUiThread(() -> {
            paintButtons();
            applyZoomThumbStyle();
        });
    }

    @Override
    void onNativeZoomState(float hardwareZoom, float digitalZoom, float combinedZoom) {
        super.onNativeZoomState(hardwareZoom, digitalZoom, combinedZoom);

        ScannerEngine engine = scannerEngine();
        FrameLayout contextBox = findViewById(R.id.contextPreviewBox);
        if (engine == null || contextBox == null) return;

        ScannerConfig config = engine.getConfig();
        float totalZoom = hardwareZoom * digitalZoom;
        boolean supported = false;
        try {
            supported = new JSONObject(engine.stateJson()).optBoolean("contextPreviewSupported", false);
        } catch (Exception ignored) {
        }

        boolean show = previewVisible && config.contextPreview && supported
                && totalZoom >= config.contextPreviewFromZoom;
        contextBox.setVisibility(show ? View.VISIBLE : View.GONE);
    }

    private void applyZoomThumbStyle() {
        ScannerEngine engine = scannerEngine();
        SeekBar seek = findViewById(R.id.zoomSeek);
        if (engine == null || seek == null) return;

        int dp = Math.max(16, Math.min(56, engine.getConfig().zoomThumbDp));
        int px = Math.max(1, Math.round(dp * getResources().getDisplayMetrics().density));
        GradientDrawable thumb = new GradientDrawable();
        thumb.setShape(GradientDrawable.OVAL);
        thumb.setColor(Color.WHITE);
        thumb.setStroke(Math.max(1, px / 12), Color.argb(180, 20, 24, 29));
        thumb.setSize(px, px);
        seek.setThumb(thumb);
        seek.setThumbOffset(px / 2);
    }

    private void paintButtons() {
        ScannerEngine engine = scannerEngine();
        Button start = findViewById(R.id.cameraScanToggle);
        Button torch = findViewById(R.id.cameraTorchToggle);
        if (engine == null) return;

        boolean active = engine.isRunning() && !engine.isPaused();
        boolean torchOn = engine.isTorchOn();

        if (start != null) {
            start.setText(active ? "STOP" : "START");
            start.setBackgroundTintList(ColorStateList.valueOf(active ? ACTIVE_GREEN : INACTIVE_RED));
            start.setAlpha(0.35f);
        }
        if (torch != null) {
            torch.setText("🔦");
            torch.setBackgroundTintList(ColorStateList.valueOf(torchOn ? ACTIVE_GREEN : INACTIVE_RED));
            torch.setAlpha(0.35f);
        }
    }

    private ScannerEngine scannerEngine() {
        try {
            Field field = MainActivity.class.getDeclaredField("scannerEngine");
            field.setAccessible(true);
            return (ScannerEngine) field.get(this);
        } catch (Exception ignored) {
            return null;
        }
    }
}
