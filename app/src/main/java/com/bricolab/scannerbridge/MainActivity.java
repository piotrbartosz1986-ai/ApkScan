package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.FocusMeteringResult;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.core.SurfaceOrientedMeteringPointFactory;
import androidx.camera.core.TorchState;
import androidx.camera.core.ZoomState;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_REQUEST = 7001;
    private static final long DUPLICATE_LOCK_MS = 1500L;
    private static final long SAME_CODE_RELEASE_MS = 550L;
    private static final long AUTO_FOCUS_INTERVAL_MS = 1800L;

    private static final float ROI_LEFT = .07f;
    private static final float ROI_RIGHT = .93f;
    private static final float ROI_TOP = .36f;
    private static final float ROI_BOTTOM = .64f;

    private PreviewView previewView;
    private FrameLayout cameraContainer;
    private TextView txtState, txtActive, txtLastCode, txtLastFormat, txtCount, txtFocusStatus, txtZoom, txtDiagnostic;
    private Button btnStart, btnFocus, btnTorch, btnPause, btnClear;
    private Switch switchPreview, switchAutoFocus;
    private SeekBar seekZoom;
    private LinearLayout listScans;

    private ProcessCameraProvider cameraProvider;
    private Camera camera;
    private BarcodeScanner barcodeScanner;
    private ExecutorService cameraExecutor;
    private final AtomicBoolean busy = new AtomicBoolean(false);

    private boolean running = false;
    private boolean paused = false;
    private boolean torchOn = false;
    private boolean zoomFromUser = false;
    private float minZoom = 1f;
    private float maxZoom = 1f;
    private long lastAcceptedAnyCodeAt = 0L;
    private long lastFocusAttemptAt = 0L;

    private final Map<String, Long> acceptedAtByCode = new HashMap<>();
    private final Map<String, Long> seenAtByCode = new HashMap<>();
    private final Map<String, Boolean> rearmedByCode = new HashMap<>();
    private final ArrayList<ScanItem> scans = new ArrayList<>();

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm:ss", Locale.getDefault());

    private final Runnable autoFocusRunnable = new Runnable() {
        @Override public void run() {
            if (running && !paused && switchAutoFocus.isChecked()) {
                long now = SystemClock.elapsedRealtime();
                if (now - lastAcceptedAnyCodeAt > 1000L && now - lastFocusAttemptAt >= AUTO_FOCUS_INTERVAL_MS) {
                    focusCenter(false);
                }
            }
            handler.postDelayed(this, 450L);
        }
    };

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        bindViews();
        prepareBarcodeScanner();
        cameraExecutor = Executors.newSingleThreadExecutor();

        switchPreview.setChecked(false);
        cameraContainer.setVisibility(View.GONE);
        switchPreview.setOnCheckedChangeListener((buttonView, checked) -> cameraContainer.setVisibility(checked ? View.VISIBLE : View.GONE));

        btnStart.setOnClickListener(v -> {
            if (running) stopScanner();
            else ensurePermissionAndStart();
        });
        btnFocus.setOnClickListener(v -> focusCenter(true));
        btnTorch.setOnClickListener(v -> toggleTorch());
        btnPause.setOnClickListener(v -> {
            paused = !paused;
            btnPause.setText(paused ? "WZNÓW" : "PAUZA");
            txtActive.setText(paused ? "SKANOWANIE WSTRZYMANE" : "SKANOWANIE AKTYWNE");
            updateState();
        });
        btnClear.setOnClickListener(v -> clearScans());

        seekZoom.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (!fromUser || camera == null || !running || maxZoom <= minZoom) return;
                float ratio = minZoom + (maxZoom - minZoom) * (progress / 100f);
                zoomFromUser = true;
                camera.getCameraControl().setZoomRatio(ratio);
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) { zoomFromUser = true; }
            @Override public void onStopTrackingTouch(SeekBar seekBar) { zoomFromUser = false; }
        });

        handler.post(autoFocusRunnable);
    }

    private void bindViews() {
        previewView = findViewById(R.id.previewView);
        cameraContainer = findViewById(R.id.cameraContainer);
        txtState = findViewById(R.id.txtState);
        txtActive = findViewById(R.id.txtActive);
        txtLastCode = findViewById(R.id.txtLastCode);
        txtLastFormat = findViewById(R.id.txtLastFormat);
        txtCount = findViewById(R.id.txtCount);
        txtFocusStatus = findViewById(R.id.txtFocusStatus);
        txtZoom = findViewById(R.id.txtZoom);
        txtDiagnostic = findViewById(R.id.txtDiagnostic);
        btnStart = findViewById(R.id.btnStart);
        btnFocus = findViewById(R.id.btnFocus);
        btnTorch = findViewById(R.id.btnTorch);
        btnPause = findViewById(R.id.btnPause);
        btnClear = findViewById(R.id.btnClear);
        switchPreview = findViewById(R.id.switchPreview);
        switchAutoFocus = findViewById(R.id.switchAutoFocus);
        seekZoom = findViewById(R.id.seekZoom);
        listScans = findViewById(R.id.listScans);
    }

    private void prepareBarcodeScanner() {
        BarcodeScannerOptions options = new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(
                        Barcode.FORMAT_EAN_13,
                        Barcode.FORMAT_EAN_8,
                        Barcode.FORMAT_UPC_A,
                        Barcode.FORMAT_UPC_E,
                        Barcode.FORMAT_CODE_128,
                        Barcode.FORMAT_CODE_39,
                        Barcode.FORMAT_CODE_93,
                        Barcode.FORMAT_ITF,
                        Barcode.FORMAT_CODABAR)
                .build();
        barcodeScanner = BarcodeScanning.getClient(options);
    }

    private void ensurePermissionAndStart() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) startCamera();
        else if (requestCode == CAMERA_PERMISSION_REQUEST) Toast.makeText(this, "Bez zgody na aparat skaner nie może działać.", Toast.LENGTH_LONG).show();
    }

    private void startCamera() {
        btnStart.setEnabled(false);
        txtDiagnostic.setText("Uruchamiam CameraX…");
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                cameraProvider = future.get();
                bindCamera();
            } catch (Exception e) {
                btnStart.setEnabled(true);
                txtDiagnostic.setText("Błąd CameraX: " + e.getMessage());
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void bindCamera() {
        cameraProvider.unbindAll();

        Preview preview = new Preview.Builder().build();
        preview.setSurfaceProvider(previewView.getSurfaceProvider());

        ImageAnalysis analysis = new ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build();
        analysis.setAnalyzer(cameraExecutor, this::analyzeImage);

        try {
            camera = cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis);
        } catch (Exception e) {
            btnStart.setEnabled(true);
            txtDiagnostic.setText("Nie udało się podłączyć tylnej kamery: " + e.getMessage());
            return;
        }

        running = true;
        paused = false;
        btnStart.setEnabled(true);
        btnStart.setText("WYŁĄCZ SKANER");
        btnFocus.setEnabled(true);
        btnPause.setEnabled(true);
        txtActive.setText("SKANOWANIE AKTYWNE");
        txtDiagnostic.setText("CameraX: OK\nML Kit: OK\nKamera: BACK\nPodgląd: " + (switchPreview.isChecked() ? "widoczny" : "ukryty"));
        observeCamera();
        updateState();
        handler.postDelayed(() -> focusCenter(false), 350L);
    }

    private void analyzeImage(@NonNull ImageProxy imageProxy) {
        if (!running || paused || busy.getAndSet(true)) {
            imageProxy.close();
            return;
        }
        if (imageProxy.getImage() == null) {
            busy.set(false);
            imageProxy.close();
            return;
        }

        int rotation = imageProxy.getImageInfo().getRotationDegrees();
        InputImage image = InputImage.fromMediaImage(imageProxy.getImage(), rotation);
        barcodeScanner.process(image)
                .addOnSuccessListener(barcodes -> {
                    Barcode barcode = pickBarcode(barcodes, imageProxy, rotation);
                    if (barcode != null && barcode.getRawValue() != null) acceptBarcode(barcode.getRawValue().trim(), formatName(barcode.getFormat()));
                })
                .addOnFailureListener(e -> runOnUiThread(() -> txtDiagnostic.setText("ML Kit błąd: " + e.getMessage())))
                .addOnCompleteListener(task -> {
                    busy.set(false);
                    imageProxy.close();
                });
    }

    private Barcode pickBarcode(List<Barcode> barcodes, ImageProxy proxy, int rotation) {
        if (barcodes == null || barcodes.isEmpty()) return null;
        final int w = (rotation == 90 || rotation == 270) ? proxy.getHeight() : proxy.getWidth();
        final int h = (rotation == 90 || rotation == 270) ? proxy.getWidth() : proxy.getHeight();

        List<Barcode> accepted = new ArrayList<>();
        for (Barcode b : barcodes) {
            if (b.getBoundingBox() == null) continue;
            float cx = b.getBoundingBox().exactCenterX() / Math.max(1f, w);
            float cy = b.getBoundingBox().exactCenterY() / Math.max(1f, h);
            if (cx >= ROI_LEFT && cx <= ROI_RIGHT && cy >= ROI_TOP && cy <= ROI_BOTTOM) accepted.add(b);
        }
        if (accepted.isEmpty()) return null;
        accepted.sort(Comparator.comparingDouble(b -> {
            float cx = b.getBoundingBox().exactCenterX() / Math.max(1f, w);
            float cy = b.getBoundingBox().exactCenterY() / Math.max(1f, h);
            return Math.hypot(cx - .5, cy - .5);
        }));
        return accepted.get(0);
    }

    private synchronized void acceptBarcode(String code, String format) {
        if (code.isEmpty()) return;
        long now = SystemClock.elapsedRealtime();
        Long previousSeen = seenAtByCode.get(code);
        if (previousSeen == null || now - previousSeen > SAME_CODE_RELEASE_MS) rearmedByCode.put(code, true);
        seenAtByCode.put(code, now);

        Long previousAccepted = acceptedAtByCode.get(code);
        boolean rearmed = rearmedByCode.getOrDefault(code, true);
        if (previousAccepted != null) {
            if (now - previousAccepted < DUPLICATE_LOCK_MS) return;
            if (!rearmed) return;
        }

        acceptedAtByCode.put(code, now);
        rearmedByCode.put(code, false);
        lastAcceptedAnyCodeAt = now;

        runOnUiThread(() -> {
            ScanItem item = new ScanItem(code, format, System.currentTimeMillis());
            scans.add(0, item);
            txtLastCode.setText(code);
            txtLastFormat.setText(format + " • " + timeFormat.format(item.timestamp));
            txtCount.setText("Zeskanowano: " + scans.size());
            addScanRow(item);
            feedback();
        });
    }

    private void addScanRow(ScanItem item) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(dp(12), dp(8), dp(12), dp(8));
        TextView code = new TextView(this);
        code.setText(item.code);
        code.setTextColor(ContextCompat.getColor(this, R.color.text));
        code.setTextSize(16);
        code.setTextIsSelectable(true);
        TextView meta = new TextView(this);
        meta.setText(item.format + " • " + timeFormat.format(item.timestamp));
        meta.setTextColor(ContextCompat.getColor(this, R.color.muted));
        meta.setTextSize(10);
        row.addView(code);
        row.addView(meta);
        listScans.addView(row, 0);
    }

    private void feedback() {
        try {
            android.os.Vibrator vibrator = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) vibrator.vibrate(45);
        } catch (Exception ignored) {}
        try {
            ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70);
            tone.startTone(ToneGenerator.TONE_PROP_BEEP, 70);
            handler.postDelayed(tone::release, 120L);
        } catch (Exception ignored) {}
    }

    private void focusCenter(boolean manual) {
        if (camera == null || !running) return;
        lastFocusAttemptAt = SystemClock.elapsedRealtime();
        txtFocusStatus.setText(manual ? "AF: ręczna próba…" : "AF: automatyczna próba…");

        MeteringPoint point;
        if (switchPreview.isChecked() && previewView.getWidth() > 0 && previewView.getHeight() > 0) {
            point = previewView.getMeteringPointFactory().createPoint(previewView.getWidth() * .5f, previewView.getHeight() * .5f, .18f);
        } else {
            SurfaceOrientedMeteringPointFactory factory = new SurfaceOrientedMeteringPointFactory(1f, 1f);
            point = factory.createPoint(.5f, .5f, .18f);
        }

        FocusMeteringAction action = new FocusMeteringAction.Builder(point,
                FocusMeteringAction.FLAG_AF | FocusMeteringAction.FLAG_AE | FocusMeteringAction.FLAG_AWB)
                .setAutoCancelDuration(2, TimeUnit.SECONDS)
                .build();

        ListenableFuture<FocusMeteringResult> future = camera.getCameraControl().startFocusAndMetering(action);
        future.addListener(() -> {
            try {
                boolean success = future.get().isFocusSuccessful();
                txtFocusStatus.setText(success ? "AF: SUCCESS ✓" : "AF: zakończony bez potwierdzenia");
                txtFocusStatus.setTextColor(ContextCompat.getColor(this, success ? R.color.green : R.color.yellow));
            } catch (Exception e) {
                txtFocusStatus.setText("AF: ERROR • " + e.getClass().getSimpleName());
                txtFocusStatus.setTextColor(ContextCompat.getColor(this, R.color.red));
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void observeCamera() {
        camera.getCameraInfo().getZoomState().observe(this, state -> {
            if (state == null) return;
            minZoom = state.getMinZoomRatio();
            maxZoom = state.getMaxZoomRatio();
            float ratio = state.getZoomRatio();
            txtZoom.setText(String.format(Locale.getDefault(), "Zoom: %.2f×  (%.2f–%.2f×)", ratio, minZoom, maxZoom));
            seekZoom.setEnabled(maxZoom > minZoom);
            if (!zoomFromUser && maxZoom > minZoom) {
                int progress = Math.round(((ratio - minZoom) / (maxZoom - minZoom)) * 100f);
                seekZoom.setProgress(Math.max(0, Math.min(100, progress)));
            }
        });

        camera.getCameraInfo().getTorchState().observe(this, state -> {
            torchOn = state != null && state == TorchState.ON;
            btnTorch.setEnabled(camera.getCameraInfo().hasFlashUnit());
            btnTorch.setText(torchOn ? "LATARKA ON" : "LATARKA");
        });
    }

    private void toggleTorch() {
        if (camera == null) return;
        if (!camera.getCameraInfo().hasFlashUnit()) {
            Toast.makeText(this, "Ta kamera nie ma latarki.", Toast.LENGTH_SHORT).show();
            return;
        }
        camera.getCameraControl().enableTorch(!torchOn);
    }

    private void stopScanner() {
        running = false;
        paused = false;
        if (cameraProvider != null) cameraProvider.unbindAll();
        busy.set(false);
        camera = null;
        btnStart.setText("WŁĄCZ SKANER");
        btnFocus.setEnabled(false);
        btnPause.setEnabled(false);
        btnPause.setText("PAUZA");
        btnTorch.setEnabled(false);
        seekZoom.setEnabled(false);
        txtActive.setText("GOTOWY DO URUCHOMIENIA");
        txtFocusStatus.setText("AF: skaner wyłączony");
        txtFocusStatus.setTextColor(ContextCompat.getColor(this, R.color.muted));
        txtDiagnostic.setText("CameraX / ML Kit: zatrzymane");
        updateState();
    }

    private void clearScans() {
        scans.clear();
        acceptedAtByCode.clear();
        seenAtByCode.clear();
        rearmedByCode.clear();
        listScans.removeAllViews();
        txtCount.setText("Zeskanowano: 0");
        txtLastCode.setText("—");
        txtLastFormat.setText("Brak skanów");
    }

    private void updateState() {
        if (!running) {
            txtState.setText("WYŁĄCZONY");
            txtState.setTextColor(ContextCompat.getColor(this, R.color.muted));
        } else if (paused) {
            txtState.setText("PAUZA");
            txtState.setTextColor(ContextCompat.getColor(this, R.color.yellow));
        } else {
            txtState.setText("SKANOWANIE");
            txtState.setTextColor(ContextCompat.getColor(this, R.color.green));
        }
    }

    private String formatName(int format) {
        switch (format) {
            case Barcode.FORMAT_EAN_13: return "EAN-13";
            case Barcode.FORMAT_EAN_8: return "EAN-8";
            case Barcode.FORMAT_UPC_A: return "UPC-A";
            case Barcode.FORMAT_UPC_E: return "UPC-E";
            case Barcode.FORMAT_CODE_128: return "CODE-128";
            case Barcode.FORMAT_CODE_39: return "CODE-39";
            case Barcode.FORMAT_CODE_93: return "CODE-93";
            case Barcode.FORMAT_ITF: return "ITF";
            case Barcode.FORMAT_CODABAR: return "CODABAR";
            default: return "BARCODE";
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override protected void onDestroy() {
        running = false;
        handler.removeCallbacks(autoFocusRunnable);
        if (cameraProvider != null) cameraProvider.unbindAll();
        if (barcodeScanner != null) barcodeScanner.close();
        if (cameraExecutor != null) cameraExecutor.shutdown();
        super.onDestroy();
    }

    private static class ScanItem {
        final String code;
        final String format;
        final long timestamp;
        ScanItem(String code, String format, long timestamp) {
            this.code = code;
            this.format = format;
            this.timestamp = timestamp;
        }
    }
}
