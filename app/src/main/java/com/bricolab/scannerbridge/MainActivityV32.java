package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

/**
 * Small recovery layer for devices where CameraX can stay stopped after
 * installation, permission dialog, screen lock or returning to the app.
 * MainActivityV25 still provides the OVH upload bridge; all scanner logic
 * remains in MainActivity / ScannerEngine.
 */
public class MainActivityV32 extends MainActivityV25 {

    private boolean recoveryPending = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        scheduleCameraRecovery(700L);
    }

    @Override
    protected void onResume() {
        super.onResume();
        scheduleCameraRecovery(350L);
    }

    private void scheduleCameraRecovery(long delayMs) {
        if (recoveryPending) return;
        recoveryPending = true;
        getWindow().getDecorView().postDelayed(() -> {
            recoveryPending = false;
            recoverCameraIfNeeded();
        }, delayMs);
    }

    private void recoverCameraIfNeeded() {
        Button scanButton = findViewById(R.id.cameraScanToggle);
        TextView scanState = findViewById(R.id.cameraScanState);
        if (scanButton == null) return;

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            if (scanState != null) {
                scanState.setText("APARAT: BRAK ZGODY");
                scanState.setBackgroundColor(Color.rgb(168, 50, 50));
            }
            // MainActivity already owns the permission request path. A tap on
            // SKAN will request it again if Android allows another prompt.
            return;
        }

        CharSequence label = scanButton.getText();
        boolean scannerActive = label != null && "STOP".contentEquals(label);
        if (!scannerActive) {
            // Reuse MainActivity's normal start path instead of duplicating
            // CameraX lifecycle logic here.
            scanButton.performClick();
        }
    }
}
