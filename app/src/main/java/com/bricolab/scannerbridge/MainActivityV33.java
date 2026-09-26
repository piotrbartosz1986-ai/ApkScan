package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.lang.reflect.Field;

/**
 * v3.2.2 camera-start layer.
 * CameraX is bound explicitly from SKAN/LATARKA after PreviewView is laid out.
 */
public class MainActivityV33 extends MainActivityV25 {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);

    private boolean userRequestedCameraStart = false;
    private boolean pendingTorchAfterStart = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        PreviewView preview = findViewById(R.id.previewView);
        PreviewView contextPreview = findViewById(R.id.contextPreviewView);
        if (preview != null) preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        if (contextPreview != null) contextPreview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);

        installDeterministicCameraButtons();

        // Cancel the historical automatic startup attempt. This build starts
        // the camera explicitly from SKAN/LATARKA after the view is attached.
        getWindow().getDecorView().postDelayed(() -> {
            if (!userRequestedCameraStart) {
                ScannerEngine engine = scannerEngine();
                if (engine != null) engine.stop();
                paintButtons();
            }
        }, 900L);
    }

    private void installDeterministicCameraButtons() {
        Button scan = findViewById(R.id.cameraScanToggle);
        Button torch = findViewById(R.id.cameraTorchToggle);

        if (scan != null) {
            scan.setOnClickListener(v -> {
                ScannerEngine engine = scannerEngine();
                if (engine == null) return;

                if (engine.isRunning() && !engine.isPaused()) {
                    userRequestedCameraStart = false;
                    pendingTorchAfterStart = false;
                    engine.stop();
                    paintButtons();
                    return;
                }

                userRequestedCameraStart = true;
                pendingTorchAfterStart = false;
                hardStartCamera();
            });
        }

        if (torch != null) {
            torch.setOnClickListener(v -> {
                ScannerEngine engine = scannerEngine();
                if (engine == null) return;

                if (engine.isRunning() && !engine.isPaused()) {
                    engine.setTorch(!engine.isTorchOn());
                    return;
                }

                // One tap is enough: bind camera first, then enable torch.
                userRequestedCameraStart = true;
                pendingTorchAfterStart = true;
                hardStartCamera();
                armTorchRetry(0);
            });
        }

        paintButtons();
    }

    private void hardStartCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            new NativeBridge().startScanner();
            return;
        }

        ScannerEngine engine = scannerEngine();
        PreviewView preview = findViewById(R.id.previewView);
        if (engine == null || preview == null) return;

        preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        engine.stop();

        preview.post(() -> {
            preview.requestLayout();
            preview.invalidate();
            engine.start();
        });
    }

    private void armTorchRetry(int attempt) {
        if (!pendingTorchAfterStart || attempt > 12) return;
        getWindow().getDecorView().postDelayed(() -> {
            ScannerEngine engine = scannerEngine();
            if (engine == null || !pendingTorchAfterStart) return;

            if (engine.isRunning()) {
                engine.setTorch(true);
                pendingTorchAfterStart = false;
                paintButtons();
            } else {
                armTorchRetry(attempt + 1);
            }
        }, attempt == 0 ? 350L : 180L);
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

        if (userRequestedCameraStart) {
            getWindow().getDecorView().postDelayed(() -> {
                hardStartCamera();
                if (pendingTorchAfterStart) armTorchRetry(0);
            }, 180L);
        } else {
            getWindow().getDecorView().postDelayed(() -> {
                ScannerEngine engine = scannerEngine();
                if (engine != null) engine.stop();
                paintButtons();
            }, 250L);
        }
    }

    @Override
    public void onState(String stateJson) {
        super.onState(stateJson);
        runOnUiThread(() -> {
            paintButtons();
            try {
                JSONObject state = new JSONObject(stateJson);
                if (pendingTorchAfterStart && state.optBoolean("running", false)) {
                    armTorchRetry(0);
                }
            } catch (Exception ignored) {
            }
        });
    }

    private void paintButtons() {
        ScannerEngine engine = scannerEngine();
        Button scan = findViewById(R.id.cameraScanToggle);
        Button torch = findViewById(R.id.cameraTorchToggle);
        if (engine == null) return;

        boolean scanOn = engine.isRunning() && !engine.isPaused();
        boolean torchOn = engine.isTorchOn();

        if (scan != null) {
            scan.setText(scanOn ? "STOP" : "SKAN");
            scan.setBackgroundTintList(ColorStateList.valueOf(scanOn ? ACTIVE_GREEN : INACTIVE_RED));
            scan.setAlpha(0.82f);
        }
        if (torch != null) {
            torch.setText("🔦");
            torch.setBackgroundTintList(ColorStateList.valueOf(torchOn ? ACTIVE_GREEN : INACTIVE_RED));
            torch.setAlpha(0.82f);
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
