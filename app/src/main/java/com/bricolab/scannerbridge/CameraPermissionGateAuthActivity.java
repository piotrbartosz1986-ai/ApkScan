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

/** Launcher used only by the rollback-safe AUTH TEST application. */
public class CameraPermissionGateAuthActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_REQUEST = 7501;
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
        if (!openingScanner && hasCameraPermission()) openScanner();
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
        title.setText("Skaner AUTH TEST");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28f);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);

        statusText = new TextView(this);
        statusText.setText("Wersja testowa działa obok zwykłego Skanera.\nNajpierw nadaj zgodę na aparat, a następnie zaloguj się kontem BricoLab.");
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

        root.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(statusText, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(permissionButton, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Math.round(52f * density)));
        setContentView(root);
    }

    private void requestCameraPermission() {
        if (hasCameraPermission()) {
            openScanner();
            return;
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
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            openScanner();
        } else {
            if (statusText != null) statusText.setText("Brak zgody na aparat. Skaner nie został uruchomiony.");
            if (permissionButton != null) permissionButton.setText("SPRÓBUJ PONOWNIE");
        }
    }

    private void openScanner() {
        if (openingScanner || !hasCameraPermission()) return;
        openingScanner = true;
        Intent intent = new Intent(this, MainActivityAuthTest.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
        overridePendingTransition(0, 0);
        finish();
    }
}
