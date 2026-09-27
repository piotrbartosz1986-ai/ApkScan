package com.bricolab.scannerbridge;

import android.graphics.Color;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.camera.view.PreviewView;

import org.json.JSONObject;

import java.lang.reflect.Field;

/**
 * Stable camera bridge with the approved compact overlay controls.
 */
public class MainActivityV34 extends MainActivityV25 {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);
    private static final int ZOOM_GREEN = Color.rgb(54, 146, 127); // #36927F

    // Approved values: background only is transparent. Text/icon/border stay fully opaque.
    private static final int CONTROL_BG_ALPHA = 64; // 25%
    private static final int ZOOM_LABEL_BG_ALPHA = 26; // 10%

    private boolean previewVisible = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        PreviewView preview = findViewById(R.id.previewView);
        if (preview != null) {
            preview.setImplementationMode(PreviewView.ImplementationMode.PERFORMANCE);
        }

        WebView webView = findViewById(R.id.webView);
        if (webView != null) {
            webView.removeJavascriptInterface("NativeScanner");
            webView.addJavascriptInterface(new StableNativeBridge(), "NativeScanner");
        }

        applyApprovedOverlayStyle();
        paintButtons();
    }

    public class StableNativeBridge extends NativeBridge {

        @Override
        @JavascriptInterface
        public void startScanner() {
            runOnUiThread(() -> {
                FrameLayout container = findViewById(R.id.cameraContainer);
                if (container != null) container.setVisibility(View.VISIBLE);
                previewVisible = true;
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
            applyApprovedOverlayStyle();
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

    private void applyApprovedOverlayStyle() {
        applyZoomStyle();
        applyZoomLabelStyle();
    }

    private void applyZoomStyle() {
        SeekBar seek = findViewById(R.id.zoomSeek);
        if (seek == null) return;

        int thumbPx = dp(22);
        GradientDrawable thumb = new GradientDrawable();
        thumb.setShape(GradientDrawable.OVAL);
        thumb.setColor(Color.WHITE);
        thumb.setStroke(dp(1), Color.rgb(20, 24, 29));
        thumb.setSize(thumbPx, thumbPx);
        seek.setThumb(thumb);
        seek.setThumbOffset(thumbPx / 2);
        seek.setAlpha(1f);

        GradientDrawable trackBg = new GradientDrawable();
        trackBg.setShape(GradientDrawable.RECTANGLE);
        trackBg.setCornerRadius(dp(4));
        trackBg.setColor(ZOOM_GREEN);

        GradientDrawable trackProgress = new GradientDrawable();
        trackProgress.setShape(GradientDrawable.RECTANGLE);
        trackProgress.setCornerRadius(dp(4));
        trackProgress.setColor(ZOOM_GREEN);

        ClipDrawable clippedProgress = new ClipDrawable(trackProgress, Gravity.START, ClipDrawable.HORIZONTAL);
        LayerDrawable layers = new LayerDrawable(new android.graphics.drawable.Drawable[]{trackBg, clippedProgress});
        layers.setId(0, android.R.id.background);
        layers.setId(1, android.R.id.progress);
        layers.setLayerHeight(0, dp(8));
        layers.setLayerHeight(1, dp(8));
        layers.setLayerGravity(0, Gravity.CENTER_VERTICAL);
        layers.setLayerGravity(1, Gravity.CENTER_VERTICAL);
        seek.setProgressDrawable(layers);
    }

    private void applyZoomLabelStyle() {
        TextView label = findViewById(R.id.zoomLabel);
        if (label == null) return;
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(dp(4));
        bg.setColor(Color.argb(ZOOM_LABEL_BG_ALPHA, 0, 0, 0));
        bg.setStroke(dp(1), Color.WHITE);
        label.setBackground(bg);
        label.setTextColor(Color.WHITE);
        label.setAlpha(1f);
    }

    private void paintButtons() {
        ScannerEngine engine = scannerEngine();
        Button start = findViewById(R.id.cameraScanToggle);
        Button torch = findViewById(R.id.cameraTorchToggle);
        if (engine == null) return;

        boolean active = engine.isRunning() && !engine.isPaused();
        boolean torchOn = engine.isTorchOn();

        if (start != null) {
            int color = active ? ACTIVE_GREEN : INACTIVE_RED;
            start.setText(active ? "STOP" : "START");
            start.setTextColor(Color.WHITE);
            start.setAlpha(1f);
            start.setBackground(controlBackground(color));
        }
        if (torch != null) {
            int color = torchOn ? ACTIVE_GREEN : INACTIVE_RED;
            torch.setText("🔦");
            torch.setTextColor(Color.WHITE);
            torch.setAlpha(1f);
            torch.setBackground(controlBackground(color));
        }
    }

    private GradientDrawable controlBackground(int color) {
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(dp(4));
        bg.setColor(Color.argb(CONTROL_BG_ALPHA, Color.red(color), Color.green(color), Color.blue(color)));
        bg.setStroke(dp(1), color);
        return bg;
    }

    private int dp(int value) {
        return Math.max(1, Math.round(value * getResources().getDisplayMetrics().density));
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
