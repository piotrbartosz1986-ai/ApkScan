package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.lang.reflect.Field;

/**
 * v3.2.2 camera-start diagnostic/fix layer.
 *
 * CameraX is kept stopped after Activity startup and is bound explicitly by
 * the SKAN button. This avoids startup races between permission, PreviewView,
 * remote config and the WebView. PreviewView uses COMPATIBLE (TextureView)
 * mode, which is safer with overlays and WebView on Samsung devices.
 */
public class MainActivityV33 extends MainActivityV25 {

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

        // MainActivity historically tries to start CameraX immediately. For
        // this build we intentionally stop that startup attempt and require
        // one explicit SKAN press after the view is fully attached.
        getWindow().getDecorView().postDelayed(() -> {
            if (!userRequestedCameraStart) {
                ScannerEngine engine = scannerEngine();
                if (engine != null) engine.stop();
                showReadyForButton();
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
                    showReadyForButton();
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

                // One press on LATARKA should be enough: start/bind the camera
                // first and switch the torch on as soon as CameraX reports ready.
                userRequestedCameraStart = true;
                pendingTorchAfterStart = true;
                hardStartCamera();
                armTorchRetry(0);
            });
        }
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

        // Binding after the PreviewView has a laid-out surface avoids the black
        // SurfaceView race seen on some Samsung/Android combinations.
        preview.post(() -> {
            preview.requestLayout();
            preview.invalidate();
            engine.start();
        });
    }

    private void armTorchRetry(int attempt) {
        if (!pendingTorchAfterStart || attempt > 10) return;
        getWindow().getDecorView().postDelayed(() -> {
            ScannerEngine engine = scannerEngine();
            if (engine == null || !pendingTorchAfterStart) return;

            if (engine.isRunning()) {
                engine.setTorch(true);
                pendingTorchAfterStart = false;
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
                showReadyForButton();
            }, 250L);
        }
    }

    @Override
    public void onState(String stateJson) {
        super.onState(stateJson);
        try {
            JSONObject state = new JSONObject(stateJson);
            String event = state.optString("event", "");
            if ("camera_error".equals(event) || "bind_error".equals(event)) {
                TextView status = findViewById(R.id.cameraScanState);
                if (status != null) status.setText("BŁĄD KAMERY • SKAN PONÓW");
            }
            if (pendingTorchAfterStart && state.optBoolean("running", false)) {
                armTorchRetry(0);
            }
        } catch (Exception ignored) {
        }
    }

    private void showReadyForButton() {
        TextView status = findViewById(R.id.cameraScanState);
        Button scan = findViewById(R.id.cameraScanToggle);
        if (status != null) status.setText("NACIŚNIJ SKAN");
        if (scan != null) scan.setText("SKAN");
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
