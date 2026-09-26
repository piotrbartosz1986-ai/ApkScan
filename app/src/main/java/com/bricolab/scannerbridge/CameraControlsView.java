package com.bricolab.scannerbridge;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.util.AttributeSet;
import android.view.Gravity;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * Visual camera controls only. It deliberately does not own/bind CameraX.
 * All camera actions go through the same NativeBridge methods used by the
 * proven historical UI, so ScannerEngine remains untouched.
 */
public class CameraControlsView extends FrameLayout {

    private static final int ACTIVE_GREEN = Color.rgb(30, 125, 71);
    private static final int INACTIVE_RED = Color.rgb(168, 50, 50);
    private static final float CONTROL_ALPHA = 0.35f;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private MainActivity activity;
    private MainActivity.NativeBridge bridge;
    private Button startButton;
    private Button torchButton;
    private SeekBar zoomSeek;
    private TextView zoomLabel;

    private boolean zoomTouching = false;
    private boolean pendingTorch = false;

    private final Runnable statePoll = new Runnable() {
        @Override
        public void run() {
            refreshState();
            handler.postDelayed(this, 220L);
        }
    };

    public CameraControlsView(Context context) {
        super(context);
        init();
    }

    public CameraControlsView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public CameraControlsView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void init() {
        setClipChildren(false);
        setClipToPadding(false);

        startButton = new Button(getContext());
        startButton.setText("START");
        startButton.setTextColor(Color.WHITE);
        startButton.setTextSize(11f);
        startButton.setAllCaps(false);
        startButton.setGravity(Gravity.CENTER);
        startButton.setPadding(0, 0, 0, 0);
        startButton.setMinWidth(0);
        startButton.setMinHeight(0);
        startButton.setAlpha(CONTROL_ALPHA);
        startButton.setBackgroundTintList(ColorStateList.valueOf(INACTIVE_RED));
        LayoutParams startLp = new LayoutParams(dp(72), dp(48), Gravity.BOTTOM | Gravity.START);
        startLp.leftMargin = dp(12);
        startLp.bottomMargin = dp(12);
        addView(startButton, startLp);

        torchButton = new Button(getContext());
        torchButton.setText("🔦");
        torchButton.setTextColor(Color.WHITE);
        torchButton.setTextSize(19f);
        torchButton.setAllCaps(false);
        torchButton.setGravity(Gravity.CENTER);
        torchButton.setPadding(0, 0, 0, 0);
        torchButton.setMinWidth(0);
        torchButton.setMinHeight(0);
        torchButton.setAlpha(CONTROL_ALPHA);
        torchButton.setBackgroundTintList(ColorStateList.valueOf(INACTIVE_RED));
        LayoutParams torchLp = new LayoutParams(dp(54), dp(48), Gravity.BOTTOM | Gravity.START);
        torchLp.leftMargin = dp(90);
        torchLp.bottomMargin = dp(12);
        addView(torchButton, torchLp);

        zoomLabel = new TextView(getContext());
        zoomLabel.setText("1.0×");
        zoomLabel.setTextColor(Color.WHITE);
        zoomLabel.setTextSize(10f);
        zoomLabel.setGravity(Gravity.CENTER);
        GradientDrawable labelBg = new GradientDrawable();
        labelBg.setColor(Color.argb(185, 0, 0, 0));
        labelBg.setCornerRadius(dp(6));
        zoomLabel.setBackground(labelBg);
        LayoutParams labelLp = new LayoutParams(dp(50), dp(28), Gravity.CENTER_VERTICAL | Gravity.END);
        labelLp.rightMargin = dp(4);
        labelLp.topMargin = -dp(104);
        addView(zoomLabel, labelLp);

        zoomSeek = new SeekBar(getContext());
        zoomSeek.setMax(1000);
        zoomSeek.setProgress(0);
        zoomSeek.setRotation(-90f);
        zoomSeek.setSplitTrack(false);
        applyThumbSize(30);
        LayoutParams zoomLp = new LayoutParams(dp(190), dp(64), Gravity.CENTER_VERTICAL | Gravity.END);
        zoomLp.rightMargin = -dp(59);
        addView(zoomSeek, zoomLp);

        startButton.setOnClickListener(v -> {
            if (!ensureBridge()) return;
            JSONObject state = state();
            boolean running = state.optBoolean("running", false);
            if (running) {
                pendingTorch = false;
                bridge.stopScanner();
                bridge.setPreviewVisible(false);
            } else {
                // Same proven historical path: make preview available, then
                // request scanner start. Permission remains system-controlled.
                bridge.setPreviewVisible(true);
                bridge.startScanner();
            }
        });

        torchButton.setOnClickListener(v -> {
            if (!ensureBridge()) return;
            JSONObject state = state();
            boolean running = state.optBoolean("running", false);
            boolean torch = state.optBoolean("torch", false);
            if (running) {
                bridge.setTorch(!torch);
            } else {
                pendingTorch = true;
                bridge.setPreviewVisible(true);
                bridge.startScanner();
            }
        });

        zoomSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (!fromUser || !ensureBridge()) return;
                JSONObject state = state();
                if (state.optBoolean("running", false)) {
                    bridge.setZoom(progress / 1000.0);
                }
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

    private void applyThumbSize(int sizeDp) {
        int px = dp(Math.max(16, Math.min(56, sizeDp)));
        GradientDrawable thumb = new GradientDrawable();
        thumb.setShape(GradientDrawable.OVAL);
        thumb.setColor(Color.WHITE);
        thumb.setStroke(Math.max(1, px / 12), Color.argb(180, 20, 24, 29));
        thumb.setSize(px, px);
        zoomSeek.setThumb(thumb);
        zoomSeek.setThumbOffset(px / 2);
    }

    private boolean ensureBridge() {
        if (bridge != null) return true;
        Context context = getContext();
        if (!(context instanceof MainActivity)) return false;
        activity = (MainActivity) context;
        bridge = activity.new NativeBridge();
        return true;
    }

    private JSONObject state() {
        if (!ensureBridge()) return new JSONObject();
        try {
            String raw = bridge.getState();
            return raw == null ? new JSONObject() : new JSONObject(raw);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private void refreshState() {
        if (!ensureBridge()) return;
        JSONObject state = state();
        boolean running = state.optBoolean("running", false);
        boolean paused = state.optBoolean("paused", false);
        boolean active = running && !paused;
        boolean torch = state.optBoolean("torch", false);

        startButton.setText(active ? "STOP" : "START");
        startButton.setBackgroundTintList(ColorStateList.valueOf(active ? ACTIVE_GREEN : INACTIVE_RED));
        startButton.setAlpha(CONTROL_ALPHA);

        torchButton.setBackgroundTintList(ColorStateList.valueOf(torch ? ACTIVE_GREEN : INACTIVE_RED));
        torchButton.setAlpha(CONTROL_ALPHA);

        if (pendingTorch && running) {
            pendingTorch = false;
            bridge.setTorch(true);
        }

        double zoomRatio = state.optDouble("zoom", 1.0);
        zoomLabel.setText(String.format(java.util.Locale.US, "%.1f×", zoomRatio));

        if (!zoomTouching) {
            double linear = state.optDouble("linearZoom", 0.0);
            int progress = (int) Math.round(Math.max(0.0, Math.min(1.0, linear)) * 1000.0);
            zoomSeek.setProgress(progress);
        }
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        handler.removeCallbacks(statePoll);
        handler.post(statePoll);
    }

    @Override
    protected void onDetachedFromWindow() {
        handler.removeCallbacks(statePoll);
        super.onDetachedFromWindow();
    }
}
