package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * Permission gate for the scanner.
 *
 * Important: the real scanner Activity is not created at all until CAMERA
 * permission is already granted. This completely separates the Android
 * permission dialog from CameraX/PreviewView/ScannerEngine initialization.
 */
public class CameraPermissionGateActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_REQUEST = 7401;

    private TextView statusText;
    private Button permissionButton;
    private boolean openingScanner = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (hasCameraPermission()) {
            openScanner();
            return;
        }

        buildPermissionScreen();
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (!openingScanner && hasCameraPermission()) {
            openScanner();
        }
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void buildPermissionScreen() {
        float density = getResources().getDisplayMetrics().density;
        int pad = Math.round(24f * density);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(pad, pad, pad, pad);
        root.setBackgroundColor(Color.rgb(11, 13, 16));

        TextView title = new TextView(this);
        title.setText("Skaner");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28f);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);

        statusText = new TextView(this);
        statusText.setText("Aparat nie jest jeszcze uruchamiany.\nNajpierw nadaj zgodę na użycie kamery.");
        statusText.setTextColor(Color.rgb(180, 188, 197));
        statusText.setTextSize(14f);
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(0, Math.round(18f * density), 0, Math.round(22f * density));

        permissionButton = new Button(this);
        permissionButton.setText("ZEZWÓL NA APARAT");
        permissionButton.setTextColor(Color.WHITE);
        permissionButton.setTextSize(13f);
        permissionButton.setTypeface(permissionButton.getTypeface(), android.graphics.Typeface.BOLD);
        permissionButton.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(Color.rgb(30, 125, 71))
        );
        permissionButton.setOnClickListener(v -> requestCameraPermission());

        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                Math.round(52f * density)
        );

        root.addView(title, titleParams);
        root.addView(statusText, textParams);
        root.addView(permissionButton, buttonParams);
        setContentView(root);
    }

    private void requestCameraPermission() {
        if (hasCameraPermission()) {
            openScanner();
            return;
        }

        if (statusText != null) {
            statusText.setText("Android poprosi teraz o zgodę na aparat.\nSkaner uruchomi się dopiero po jej przyznaniu.");
        }

        ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.CAMERA},
                CAMERA_PERMISSION_REQUEST
        );
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != CAMERA_PERMISSION_REQUEST) return;

        boolean granted = grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        if (granted) {
            openScanner();
            return;
        }

        if (statusText != null) {
            statusText.setText("Brak zgody na aparat. Kamera nadal nie została uruchomiona.\nMożesz spróbować ponownie.");
        }
        if (permissionButton != null) {
            permissionButton.setText("SPRÓBUJ PONOWNIE");
        }
    }

    private void openScanner() {
        if (openingScanner || !hasCameraPermission()) return;
        openingScanner = true;

        Intent intent = new Intent(this, MainActivityV34.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
        overridePendingTransition(0, 0);
        finish();
    }
}
