package com.bricolab.scannerbridge;

import android.content.Context;
import android.graphics.Rect;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.Vibrator;

import androidx.annotation.NonNull;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.FocusMeteringResult;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.core.SurfaceOrientedMeteringPointFactory;
import androidx.camera.core.ZoomState;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class ScannerEngine {

    public interface Listener {
        void onBarcode(String code, String format, long timestamp);
        void onState(String stateJson);
    }

    private final MainActivity owner;
    private final PreviewView previewView;
    private final Listener listener;
    private final ExecutorService cameraExecutor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final AtomicBoolean busy = new AtomicBoolean(false);

    private ProcessCameraProvider cameraProvider;
    private Camera camera;
    private BarcodeScanner barcodeScanner;
    private ScannerConfig config = new ScannerConfig();

    private boolean running = false;
    private boolean paused = false;
    private boolean torchOn = false;
    private String focusState = "idle";
    private long lastAcceptedAnyCodeAt = 0L;
    private long lastFocusAttemptAt = 0L;

    private final Map<String, Long> acceptedAtByCode = new HashMap<>();
    private final Map<String, Long> seenAtByCode = new HashMap<>();
    private final Map<String, Boolean> rearmedByCode = new HashMap<>();

    private final Runnable autoFocusRunnable = new Runnable() {
        @Override
        public void run() {
            if (running && !paused && config.autoFocus) {
                long now = SystemClock.elapsedRealtime();

                if (now - lastAcceptedAnyCodeAt > 900L &&
                        now - lastFocusAttemptAt >= config.focusIntervalMs) {
                    focusCenter(false);
                }
            }

            handler.postDelayed(this, 350L);
        }
    };

    public ScannerEngine(MainActivity owner, PreviewView previewView, Listener listener) {
        this.owner = owner;
        this.previewView = previewView;
        this.listener = listener;
        handler.post(autoFocusRunnable);
    }

    public void applyConfig(ScannerConfig newConfig) {
        if (newConfig == null) return;
        this.config = newConfig;

        // Parametry ROI, duplicate/release i focus są od razu używane z config.
        // Format listy jest przebudowywany przy następnym starcie skanera.
        emitState("config_applied");
    }

    public ScannerConfig getConfig() {
        return config;
    }

    public boolean isRunning() {
        return running;
    }

    public boolean isPaused() {
        return paused;
    }

    public void start() {
        if (running) {
            emitState("already_running");
            return;
        }

        rebuildBarcodeScanner();
        emitState("starting");

        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(owner);

        future.addListener(() -> {
            try {
                cameraProvider = future.get();
                bindCamera();
            } catch (Exception error) {
                focusState = "camera_error";
                emitState("camera_error");
            }
        }, ContextCompat.getMainExecutor(owner));
    }

    private void bindCamera() {
        if (cameraProvider == null) return;

        cameraProvider.unbindAll();

        Preview preview = new Preview.Builder().build();
        preview.setSurfaceProvider(previewView.getSurfaceProvider());

        ImageAnalysis analysis = new ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build();

        analysis.setAnalyzer(cameraExecutor, this::analyzeImage);

        try {
            camera = cameraProvider.bindToLifecycle(
                    owner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    analysis
            );
        } catch (Exception error) {
            focusState = "bind_error";
            emitState("bind_error");
            return;
        }

        running = true;
        paused = false;
        focusState = "ready";

        observeZoom();
        emitState("started");

        handler.postDelayed(() -> focusCenter(false), 300L);
    }

    public void stop() {
        running = false;
        paused = false;
        torchOn = false;
        focusState = "stopped";
        busy.set(false);

        if (cameraProvider != null) {
            cameraProvider.unbindAll();
        }

        camera = null;
        emitState("stopped");
    }

    public void setPaused(boolean value) {
        paused = value;
        emitState(value ? "paused" : "resumed");
    }

    public void setTorch(boolean enabled) {
        if (camera == null || !running || !camera.getCameraInfo().hasFlashUnit()) {
            torchOn = false;
            emitState("torch_unavailable");
            return;
        }

        camera.getCameraControl().enableTorch(enabled);
        torchOn = enabled;
        emitState(enabled ? "torch_on" : "torch_off");
    }

    public void setLinearZoom(float linearZoom) {
        if (camera == null || !running) return;

        float safe = Math.max(0f, Math.min(1f, linearZoom));
        camera.getCameraControl().setLinearZoom(safe);
    }

    public void focusCenter(boolean manual) {
        if (camera == null || !running) return;

        lastFocusAttemptAt = SystemClock.elapsedRealtime();
        focusState = manual ? "manual_focusing" : "auto_focusing";
        emitState(manual ? "focus_manual" : "focus_auto");

        SurfaceOrientedMeteringPointFactory factory =
                new SurfaceOrientedMeteringPointFactory(1f, 1f);

        MeteringPoint point = factory.createPoint(0.5f, 0.5f, 0.18f);

        FocusMeteringAction action = new FocusMeteringAction.Builder(
                point,
                FocusMeteringAction.FLAG_AF |
                        FocusMeteringAction.FLAG_AE |
                        FocusMeteringAction.FLAG_AWB
        )
                .setAutoCancelDuration(2, TimeUnit.SECONDS)
                .build();

        ListenableFuture<FocusMeteringResult> future =
                camera.getCameraControl().startFocusAndMetering(action);

        future.addListener(() -> {
            try {
                boolean success = future.get().isFocusSuccessful();
                focusState = success ? "success" : "not_confirmed";
                emitState(success ? "focus_success" : "focus_not_confirmed");
            } catch (Exception error) {
                focusState = "error";
                emitState("focus_error");
            }
        }, ContextCompat.getMainExecutor(owner));
    }

    private void analyzeImage(@NonNull ImageProxy imageProxy) {
        if (!running || paused || busy.getAndSet(true)) {
            imageProxy.close();
            return;
        }

        if (imageProxy.getImage() == null || barcodeScanner == null) {
            busy.set(false);
            imageProxy.close();
            return;
        }

        int rotation = imageProxy.getImageInfo().getRotationDegrees();
        InputImage image = InputImage.fromMediaImage(imageProxy.getImage(), rotation);

        barcodeScanner
                .process(image)
                .addOnSuccessListener(barcodes -> {
                    Barcode candidate = pickBarcode(barcodes, imageProxy, rotation);

                    if (candidate != null && candidate.getRawValue() != null) {
                        String raw = candidate.getRawValue().trim();
                        if (!raw.isEmpty()) {
                            acceptBarcode(raw, formatName(candidate.getFormat()));
                        }
                    }
                })
                .addOnCompleteListener(task -> {
                    busy.set(false);
                    imageProxy.close();
                });
    }

    private Barcode pickBarcode(List<Barcode> barcodes, ImageProxy proxy, int rotation) {
        if (barcodes == null || barcodes.isEmpty()) return null;

        final int rotatedWidth =
                (rotation == 90 || rotation == 270)
                        ? proxy.getHeight()
                        : proxy.getWidth();

        final int rotatedHeight =
                (rotation == 90 || rotation == 270)
                        ? proxy.getWidth()
                        : proxy.getHeight();

        List<Barcode> accepted = new ArrayList<>();

        for (Barcode barcode : barcodes) {
            Rect box = barcode.getBoundingBox();
            if (box == null) continue;

            float cx = box.exactCenterX() / Math.max(1f, rotatedWidth);
            float cy = box.exactCenterY() / Math.max(1f, rotatedHeight);

            if (cx >= config.roiLeft &&
                    cx <= config.roiRight &&
                    cy >= config.roiTop &&
                    cy <= config.roiBottom) {
                accepted.add(barcode);
            }
        }

        if (accepted.isEmpty()) return null;

        accepted.sort(Comparator.comparingDouble(barcode -> {
            Rect box = barcode.getBoundingBox();
            if (box == null) return Double.MAX_VALUE;

            double cx = box.exactCenterX() / Math.max(1f, rotatedWidth);
            double cy = box.exactCenterY() / Math.max(1f, rotatedHeight);

            return Math.hypot(cx - 0.5, cy - 0.5);
        }));

        return accepted.get(0);
    }

    private synchronized void acceptBarcode(String code, String format) {
        long now = SystemClock.elapsedRealtime();

        Long previousSeen = seenAtByCode.get(code);
        if (previousSeen == null || now - previousSeen > config.releaseDelayMs) {
            rearmedByCode.put(code, true);
        }

        seenAtByCode.put(code, now);

        Long previousAccepted = acceptedAtByCode.get(code);
        boolean rearmed = rearmedByCode.getOrDefault(code, true);

        if (previousAccepted != null) {
            if (now - previousAccepted < config.duplicateDelayMs) return;
            if (!rearmed) return;
        }

        acceptedAtByCode.put(code, now);
        rearmedByCode.put(code, false);
        lastAcceptedAnyCodeAt = now;

        long timestamp = System.currentTimeMillis();
        feedback();

        owner.runOnUiThread(() -> listener.onBarcode(code, format, timestamp));
    }

    private void rebuildBarcodeScanner() {
        if (barcodeScanner != null) {
            try {
                barcodeScanner.close();
            } catch (Exception ignored) {
            }
        }

        int[] formats = config.barcodeFormats();
        int first = formats[0];
        int[] rest = formats.length > 1
                ? Arrays.copyOfRange(formats, 1, formats.length)
                : new int[0];

        BarcodeScannerOptions options = new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(first, rest)
                .build();

        barcodeScanner = BarcodeScanning.getClient(options);
    }

    private void observeZoom() {
        if (camera == null) return;

        camera.getCameraInfo().getZoomState().observe(owner, state -> {
            if (state != null) {
                emitState("zoom_changed");
            }
        });
    }

    private void feedback() {
        try {
            Vibrator vibrator = (Vibrator) owner.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                vibrator.vibrate(45);
            }
        } catch (Exception ignored) {
        }

        try {
            ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70);
            tone.startTone(ToneGenerator.TONE_PROP_BEEP, 70);
            handler.postDelayed(tone::release, 120L);
        } catch (Exception ignored) {
        }
    }

    public String stateJson() {
        try {
            JSONObject object = new JSONObject();
            object.put("running", running);
            object.put("paused", paused);
            object.put("torch", torchOn);
            object.put("focus", focusState);
            object.put("configVersion", config.version);

            if (camera != null) {
                ZoomState state = camera.getCameraInfo().getZoomState().getValue();
                if (state != null) {
                    object.put("zoom", state.getZoomRatio());
                    object.put("linearZoom", state.getLinearZoom());
                    object.put("minZoom", state.getMinZoomRatio());
                    object.put("maxZoom", state.getMaxZoomRatio());
                }
                object.put("flashAvailable", camera.getCameraInfo().hasFlashUnit());
            } else {
                object.put("zoom", 1.0);
                object.put("linearZoom", 0.0);
                object.put("flashAvailable", false);
            }

            return object.toString();
        } catch (Exception ignored) {
            return "{}";
        }
    }

    private void emitState(String event) {
        try {
            JSONObject object = new JSONObject(stateJson());
            object.put("event", event);
            owner.runOnUiThread(() -> listener.onState(object.toString()));
        } catch (Exception ignored) {
            owner.runOnUiThread(() -> listener.onState(stateJson()));
        }
    }

    private String formatName(int format) {
        switch (format) {
            case Barcode.FORMAT_EAN_13: return "EAN_13";
            case Barcode.FORMAT_EAN_8: return "EAN_8";
            case Barcode.FORMAT_UPC_A: return "UPC_A";
            case Barcode.FORMAT_UPC_E: return "UPC_E";
            case Barcode.FORMAT_CODE_128: return "CODE_128";
            case Barcode.FORMAT_CODE_39: return "CODE_39";
            case Barcode.FORMAT_CODE_93: return "CODE_93";
            case Barcode.FORMAT_ITF: return "ITF";
            case Barcode.FORMAT_CODABAR: return "CODABAR";
            case Barcode.FORMAT_QR_CODE: return "QR_CODE";
            case Barcode.FORMAT_DATA_MATRIX: return "DATA_MATRIX";
            default: return "BARCODE";
        }
    }

    public void destroy() {
        stop();
        handler.removeCallbacks(autoFocusRunnable);

        if (barcodeScanner != null) {
            try {
                barcodeScanner.close();
            } catch (Exception ignored) {
            }
        }

        cameraExecutor.shutdown();
    }
}
