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
 * Test D: keep the proven historical CameraX engine untouched and add only
 * the agreed on-screen controls around it.
 *
 * Important: START goes through the same MainActivity.NativeBridge path that
 * worked in diagnostic C/B. No second CameraX Preview and no context preview.
 */
public class MainActivityOverlay extends MainActivityV25 {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);
    private static final float CONTROL_ALPHA = 0.35f;

    private Button startButton;
    private Button torchButton;
    private SeekBar zoomSeek;
    private TextView zoomLabel;

    private NativeBridge scannerBridge;
    private boolean zoomTouching = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        scannerBridge = new NativeBridge();
        startButton = findViewById(R.id.cameraStartOverlay);
        torchButton = findViewById(R.id.cameraTorchOverlay);
        zoomSeek = findViewById(R.id.zoomOverlaySeek);
        zoomLabel = findViewById(R.id.zoomOverlayLabel);

        setupOverlayControls();
        renderState(scannerBridge.getState());
    }

    private void setupOverlayControls() {
        startButton.setAlpha(CONTROL_ALPHA);
        torchButton.setAlpha(CONTROL_ALPHA);

        startButton.setOnClickListener(v -> {
            JSONObject state = parseState(scannerBridge.getState());
            boolean running = state.optBoolean("running", false);

            if (running) {
                // Exact old stop path; hide only the visual preview afterwards.
                scannerBridge.stopScanner();
                scannerBridge.setPreviewVisible(false);
            } else {
                // Exact sequence confirmed by diagnostic C/B:
                // show PreviewView first, then call the historical startScanner().
                scannerBridge.setPreviewVisible(true);
                scannerBridge.startScanner();
            }
        });

        torchButton.setOnClickListener(v -> {
            JSONObject state = parseState(scannerBridge.getState());
            if (!state.optBoolean("running", false)) return;
            scannerBridge.setTorch(!state.optBoolean("torch", false));
        });

        zoomSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (!fromUser) return;
                JSONObject state = parseState(scannerBridge.getState());
                if (!state.optBoolean("running", false)) return;
                scannerBridge.setZoom(progress / 1000.0);
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

    @Override
    public void onState(String stateJson) {
        super.onState(stateJson);
        runOnUiThread(() -> renderState(stateJson));
    }

    private void renderState(String stateJson) {
        JSONObject state = parseState(stateJson);
        boolean running = state.optBoolean("running", false);
        boolean torch = state.optBoolean("torch", false);

        startButton.setText(running ? "STOP" : "START");
        startButton.setBackgroundTintList(
                ColorStateList.valueOf(running ? ACTIVE_GREEN : INACTIVE_RED)
        );
        startButton.setAlpha(CONTROL_ALPHA);

        torchButton.setText("🔦");
        torchButton.setBackgroundTintList(
                ColorStateList.valueOf(torch ? ACTIVE_GREEN : INACTIVE_RED)
        );
        torchButton.setAlpha(CONTROL_ALPHA);
        torchButton.setEnabled(running && state.optBoolean("flashAvailable", false));

        double zoom = state.optDouble("zoom", 1.0);
        zoomLabel.setText(String.format(Locale.US, "%.1f×", zoom));

        zoomSeek.setEnabled(running);
        if (!zoomTouching) {
            double linear = state.optDouble("linearZoom", 0.0);
            linear = Math.max(0.0, Math.min(1.0, linear));
            zoomSeek.setProgress((int) Math.round(linear * 1000.0));
        }
    }

    private JSONObject parseState(String json) {
        try {
            return new JSONObject(json == null ? "{}" : json);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }
}
