package com.bricolab.scannerbridge;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.SeekBar;

import org.json.JSONObject;

/**
 * Recovery layer over V36.
 * Keeps the proven CameraX/scanner core untouched, restores the simple smooth
 * zoom interaction, and explicitly keeps WebView input independent from native controls.
 */
public class MainActivityV37 extends MainActivityV36 {

    private WebView recoveryWebView;
    private SeekBar recoveryZoomSeek;
    private boolean recoveryZoomTouching = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        recoveryWebView = findViewById(R.id.webView);
        recoveryZoomSeek = findViewById(R.id.zoomSeek);
        Button scanButton = findViewById(R.id.cameraScanToggle);
        View scanOverlay = findViewById(R.id.scanOverlay);

        if (scanOverlay != null) {
            scanOverlay.setClickable(false);
            scanOverlay.setLongClickable(false);
            scanOverlay.setFocusable(false);
            scanOverlay.setOnTouchListener(null);
        }

        if (recoveryWebView != null) {
            recoveryWebView.setEnabled(true);
            recoveryWebView.setClickable(true);
            recoveryWebView.setLongClickable(true);
            recoveryWebView.setFocusable(true);
            recoveryWebView.setFocusableInTouchMode(true);
            recoveryWebView.setOnTouchListener(null);
        }

        // START/STOP must never depend on the WebView/JS event loop. If the UI is
        // busy or a remote extension fails, the native camera button still works.
        if (scanButton != null) {
            scanButton.setEnabled(true);
            scanButton.setClickable(true);
            scanButton.setOnClickListener(v -> nativeCameraToggle());
        }

        restoreSimpleZoomListener();
    }

    private void nativeCameraToggle() {
        try {
            NativeBridge bridge = new NativeBridge();
            String rawState = bridge.getState();
            JSONObject state = new JSONObject(rawState == null ? "{}" : rawState);
            boolean running = state.optBoolean("running", false);
            boolean paused = state.optBoolean("paused", false);

            if (!running) {
                bridge.setPreviewVisible(true);
                bridge.startScanner();
            } else if (paused) {
                bridge.setPaused(false);
            } else {
                bridge.stopScanner();
                bridge.setPreviewVisible(false);
            }
        } catch (Exception ignored) {
        }
    }

    private void restoreSimpleZoomListener() {
        if (recoveryZoomSeek == null) return;

        recoveryZoomSeek.setOnTouchListener(null);
        recoveryZoomSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (!fromUser) return;
                try {
                    JSONObject state = new JSONObject(new NativeBridge().getState());
                    if (!state.optBoolean("running", false)) return;
                } catch (Exception ignored) {
                    return;
                }
                new NativeBridge().setZoom(progress / 1000.0);
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                recoveryZoomTouching = true;
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                recoveryZoomTouching = false;
            }
        });
    }

    @Override
    public void onState(String stateJson) {
        super.onState(stateJson);

        if (recoveryZoomSeek == null || recoveryZoomTouching) return;
        try {
            JSONObject state = new JSONObject(stateJson == null ? "{}" : stateJson);
            double linear = state.optDouble("linearZoom", -1.0);
            if (linear < 0.0) return;
            int progress = (int) Math.round(Math.max(0.0, Math.min(1.0, linear)) * 1000.0);
            runOnUiThread(() -> {
                if (!recoveryZoomTouching && recoveryZoomSeek != null) {
                    recoveryZoomSeek.setProgress(progress);
                }
            });
        } catch (Exception ignored) {
        }
    }
}
