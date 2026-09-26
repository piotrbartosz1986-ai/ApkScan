package com.bricolab.scannerbridge;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

import java.lang.ref.WeakReference;

public class ScanOverlayView extends View {

    private static WeakReference<ScanOverlayView> activeView = new WeakReference<>(null);

    private final Paint dimPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path dimPath = new Path();

    private float left = ScannerConfig.liveRoiLeft;
    private float right = ScannerConfig.liveRoiRight;
    private float top = ScannerConfig.liveRoiTop;
    private float bottom = ScannerConfig.liveRoiBottom;

    public ScanOverlayView(Context context) {
        super(context);
        init();
    }

    public ScanOverlayView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        activeView = new WeakReference<>(this);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);

        // 70% przezroczystości poza ramką = 30% krycia czerni.
        dimPaint.setColor(Color.argb(77, 0, 0, 0));
        dimPaint.setStyle(Paint.Style.FILL);

        borderPaint.setColor(Color.WHITE);
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(dp(1.5f));

        linePaint.setColor(Color.rgb(54, 210, 127));
        linePaint.setStrokeWidth(dp(1f));
    }

    public static void applyGlobalRoi(float left, float top, float right, float bottom) {
        ScanOverlayView view = activeView.get();
        if (view == null) return;

        view.post(() -> view.setRoi(left, top, right, bottom));
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        activeView = new WeakReference<>(this);
        setRoi(
                ScannerConfig.liveRoiLeft,
                ScannerConfig.liveRoiTop,
                ScannerConfig.liveRoiRight,
                ScannerConfig.liveRoiBottom
        );
    }

    public void setRoi(float left, float top, float right, float bottom) {
        this.left = clamp(left, 0f, 0.95f);
        this.top = clamp(top, 0f, 0.95f);
        this.right = clamp(right, this.left + 0.05f, 1f);
        this.bottom = clamp(bottom, this.top + 0.05f, 1f);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        float w = getWidth();
        float h = getHeight();

        RectF zone = new RectF(
                w * left,
                h * top,
                w * right,
                h * bottom
        );

        float radius = dp(12f);

        // Jedna maska EVEN_ODD zamiast czterech prostokątów. Dzięki temu
        // przyciemnienie dokładnie respektuje zaokrąglone rogi ramki.
        dimPath.reset();
        dimPath.setFillType(Path.FillType.EVEN_ODD);
        dimPath.addRect(0f, 0f, w, h, Path.Direction.CW);
        dimPath.addRoundRect(zone, radius, radius, Path.Direction.CW);
        canvas.drawPath(dimPath, dimPaint);

        canvas.drawRoundRect(zone, radius, radius, borderPaint);
        canvas.drawLine(
                zone.left + zone.width() * 0.07f,
                zone.centerY(),
                zone.right - zone.width() * 0.07f,
                zone.centerY(),
                linePaint
        );
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }
}
