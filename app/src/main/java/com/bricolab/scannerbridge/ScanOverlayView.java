package com.bricolab.scannerbridge;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

public class ScanOverlayView extends View {
    private final Paint dimPaint = new Paint();
    private final Paint borderPaint = new Paint();
    private final Paint linePaint = new Paint();

    public ScanOverlayView(Context context) { super(context); init(); }
    public ScanOverlayView(Context context, AttributeSet attrs) { super(context, attrs); init(); }

    private void init() {
        dimPaint.setColor(Color.argb(145, 0, 0, 0));
        borderPaint.setColor(Color.WHITE);
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(dp(2));
        linePaint.setColor(Color.rgb(54, 210, 127));
        linePaint.setStrokeWidth(dp(2));
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w = getWidth(), h = getHeight();
        RectF zone = new RectF(w * .07f, h * .36f, w * .93f, h * .64f);
        canvas.drawRect(0, 0, w, zone.top, dimPaint);
        canvas.drawRect(0, zone.bottom, w, h, dimPaint);
        canvas.drawRect(0, zone.top, zone.left, zone.bottom, dimPaint);
        canvas.drawRect(zone.right, zone.top, w, zone.bottom, dimPaint);
        canvas.drawRoundRect(zone, dp(12), dp(12), borderPaint);
        canvas.drawLine(zone.left + zone.width() * .07f, zone.centerY(), zone.right - zone.width() * .07f, zone.centerY(), linePaint);
    }

    private float dp(float v) { return v * getResources().getDisplayMetrics().density; }
}
