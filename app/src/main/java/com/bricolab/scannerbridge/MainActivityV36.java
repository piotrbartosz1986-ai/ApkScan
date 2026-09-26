package com.bricolab.scannerbridge;

import android.content.res.ColorStateList;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.Locale;

/**
 * Native controls over the proven v2.7 CameraX core.
 * START/STOP intentionally duplicates the exact working web path from test C.
 */
public class MainActivityV36 extends MainActivityV25 {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);

    private WebView controlWebView;
    private Button scanButton;
    private Button torchButton;
    private SeekBar zoomSeek;
    private TextView zoomLabel;
    private boolean zoomTouching = false;
    private boolean pendingTorchAfterStart = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        controlWebView = findViewById(R.id.webView);
        scanButton = findViewById(R.id.cameraScanToggle);
        torchButton = findViewById(R.id.cameraTorchToggle);
        zoomSeek = findViewById(R.id.zoomSeek);
        zoomLabel = findViewById(R.id.zoomLabel);

        installCameraControls();
        refreshControls(readState());
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
                    // Start through the exact same proven C path, then enable torch.
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
            scanButton.setBackgroundTintList(
                    ColorStateList.valueOf(active ? ACTIVE_GREEN : INACTIVE_RED)
            );
            scanButton.setAlpha(0.35f);
        }

        if (torchButton != null) {
            torchButton.setText("🔦");
            torchButton.setBackgroundTintList(
                    ColorStateList.valueOf(torch ? ACTIVE_GREEN : INACTIVE_RED)
            );
            torchButton.setAlpha(0.35f);
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
}
