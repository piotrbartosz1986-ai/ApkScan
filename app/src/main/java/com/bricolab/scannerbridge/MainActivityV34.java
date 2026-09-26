package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.pm.PackageManager;
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

import androidx.annotation.NonNull;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.lang.reflect.Field;

/**
 * v3.2.3 - restores the old, proven camera model:
 * 1) no automatic camera is allowed to remain active after app start,
 * 2) camera starts only after an explicit user action,
 * 3) preview visibility is a real VISIBLE/GONE switch again,
 * 4) the settings preview checkbox provides a second, independent camera-start path.
 */
public class MainActivityV34 extends MainActivityV25 {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);

    private boolean explicitCameraStart = false;
    private boolean pendingTorch = false;
    private boolean previewVisible = true;

    private WebView stableWebView;
    private FrameLayout stableCameraContainer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        stableWebView = findViewById(R.id.webView);
        stableCameraContainer = findViewById(R.id.cameraContainer);

        PreviewView preview = findViewById(R.id.previewView);
        PreviewView contextPreview = findViewById(R.id.contextPreviewView);
        if (preview != null) preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        if (contextPreview != null) contextPreview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);

        // Replace NativeScanner with a bridge that restores the old preview behavior.
        if (stableWebView != null) {
            stableWebView.removeJavascriptInterface("NativeScanner");
            stableWebView.addJavascriptInterface(new StableNativeBridge(), "NativeScanner");
        }

        installStableOverlayButtons();
        applyZoomThumbStyle();
        setPreviewVisibleInternal(true, false);

        // MainActivity currently requests an automatic start. We intentionally
        // cancel any such startup. If it completes late, onState() stops it too.
        stopAutomaticStartSoon(120L);
        stopAutomaticStartSoon(450L);
        stopAutomaticStartSoon(1000L);
    }

    private void stopAutomaticStartSoon(long delayMs) {
        getWindow().getDecorView().postDelayed(() -> {
            if (explicitCameraStart) return;
            ScannerEngine engine = scannerEngine();
            if (engine != null && engine.isRunning()) engine.stop();
            paintButtons();
        }, delayMs);
    }

    private void installStableOverlayButtons() {
        Button start = findViewById(R.id.cameraScanToggle);
        Button torch = findViewById(R.id.cameraTorchToggle);

        if (start != null) {
            start.setOnClickListener(v -> {
                ScannerEngine engine = scannerEngine();
                if (engine == null) return;

                if (engine.isRunning() && !engine.isPaused()) {
                    engine.setPaused(true);
                    paintButtons();
                    return;
                }

                explicitCameraStart = true;
                pendingTorch = false;
                ensurePreviewVisible();
                stableStartScanner();
            });
        }

        if (torch != null) {
            torch.setOnClickListener(v -> {
                ScannerEngine engine = scannerEngine();
                if (engine == null) return;

                if (engine.isRunning()) {
                    if (engine.isPaused()) engine.setPaused(false);
                    engine.setTorch(!engine.isTorchOn());
                    return;
                }

                explicitCameraStart = true;
                pendingTorch = true;
                ensurePreviewVisible();
                stableStartScanner();
                retryTorch(0);
            });
        }

        paintButtons();
    }

    private void stableStartScanner() {
        ScannerEngine engine = scannerEngine();
        if (engine == null) return;

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            new NativeBridge().startScanner();
            return;
        }

        if (engine.isRunning()) {
            engine.setPaused(false);
            return;
        }

        // Old model: direct start only after explicit action, without stop/start races.
        engine.start();
    }

    private void retryTorch(int attempt) {
        if (!pendingTorch || attempt > 15) return;
        getWindow().getDecorView().postDelayed(() -> {
            ScannerEngine engine = scannerEngine();
            if (engine == null || !pendingTorch) return;
            if (engine.isRunning()) {
                engine.setTorch(true);
                pendingTorch = false;
                paintButtons();
            } else {
                retryTorch(attempt + 1);
            }
        }, attempt == 0 ? 250L : 180L);
    }

    private void ensurePreviewVisible() {
        if (!previewVisible) setPreviewVisibleInternal(true, false);
    }

    private void setPreviewVisibleInternal(boolean visible, boolean startWhenShown) {
        previewVisible = visible;
        if (stableCameraContainer != null) {
            stableCameraContainer.setVisibility(visible ? View.VISIBLE : View.GONE);
        }

        if (visible && startWhenShown) {
            explicitCameraStart = true;
            getWindow().getDecorView().post(() -> stableStartScanner());
        }
    }

    public class StableNativeBridge extends NativeBridge {
        @Override
        @JavascriptInterface
        public void startScanner() {
            runOnUiThread(() -> {
                explicitCameraStart = true;
                stableStartScanner();
            });
        }

        @Override
        @JavascriptInterface
        public void stopScanner() {
            runOnUiThread(() -> {
                ScannerEngine engine = scannerEngine();
                if (engine != null && engine.isRunning()) engine.setPaused(true);
            });
        }

        @Override
        @JavascriptInterface
        public void setPreviewVisible(boolean visible) {
            // This is intentionally the same model as the older working build:
            // real VISIBLE/GONE, not the current always-VISIBLE implementation.
            runOnUiThread(() -> setPreviewVisibleInternal(visible, visible));
        }

        @JavascriptInterface
        public boolean isPreviewVisible() {
            return previewVisible;
        }

        @JavascriptInterface
        public void restartCameraCompat() {
            runOnUiThread(() -> {
                explicitCameraStart = true;
                ensurePreviewVisible();
                ScannerEngine engine = scannerEngine();
                if (engine != null && engine.isRunning()) engine.stop();
                getWindow().getDecorView().postDelayed(MainActivityV34.this::stableStartScanner, 180L);
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != 7001) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (!granted) return;

        if (explicitCameraStart) {
            getWindow().getDecorView().postDelayed(() -> {
                stableStartScanner();
                if (pendingTorch) retryTorch(0);
            }, 120L);
        }
    }

    @Override
    public void onState(String stateJson) {
        super.onState(stateJson);

        runOnUiThread(() -> {
            try {
                JSONObject state = new JSONObject(stateJson);
                String event = state.optString("event", "");

                // Kill only the unwanted automatic start, never a user start.
                if (!explicitCameraStart && "started".equals(event)) {
                    ScannerEngine engine = scannerEngine();
                    if (engine != null) engine.stop();
                    return;
                }

                if (pendingTorch && state.optBoolean("running", false)) retryTorch(0);
            } catch (Exception ignored) {
            }
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
