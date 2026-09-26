package com.bricolab.scannerbridge;

import android.content.res.ColorStateList;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.Locale;

/**
 * Native camera controls layered over the proven v2.7 CameraX core.
 * Important: this class does NOT replace ScannerEngine and does NOT add a
 * second Preview. CameraX is still started through the old NativeBridge path.
 */
public class MainActivityV36 extends MainActivityV25 {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);

    private Button scanButton;
    private Button torchButton;
    private SeekBar zoomSeek;
    private TextView zoomLabel;
    private boolean zoomTouching = false;
    private boolean pendingTorchAfterStart = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        scanButton = findViewById(R.id.cameraScanToggle);
        torchButton = findViewById(R.id.cameraTorchToggle);
        zoomSeek = findViewById(R.id.zoomSeek);
        zoomLabel = findViewById(R.id.zoomLabel);

        installCameraControls();
        refreshControls(readState());
    }

    private void installCameraControls() {
        if (scanButton != null) {
            scanButton.setOnClickListener(v -> {
                JSONObject state = readState();
                boolean running = state.optBoolean("running", false);

                if (running) {
                    pendingTorchAfterStart = false;
                    new NativeBridge().stopScanner();
                    new NativeBridge().setPreviewVisible(false);
                } else {
                    // Do NOT expose PreviewView before Android has granted CAMERA.
                    // The old requestScannerStart() path asks for the system permission;
                    // preview becomes visible only after ScannerEngine reports started.
                    new NativeBridge().startScanner();
                }
            });
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
                    new NativeBridge().startScanner();
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

    @Override
    public void onState(String stateJson) {
        super.onState(stateJson);

        runOnUiThread(() -> {
            try {
                JSONObject state = new JSONObject(stateJson);
                String event = state.optString("event", "");

                if ("started".equals(event) || "already_running".equals(event)) {
                    // Same CameraX core as the working test C, but reveal the
                    // Preview only after native start has succeeded.
                    new NativeBridge().setPreviewVisible(true);

                    if (pendingTorchAfterStart) {
                        pendingTorchAfterStart = false;
                        new NativeBridge().setTorch(true);
                    }
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
            // Keep it tappable while stopped: one tap starts CameraX and then
            // enables the torch. Once running, flash availability is respected.
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
