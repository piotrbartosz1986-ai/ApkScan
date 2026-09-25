package com.bricolab.scannerbridge;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

public class ContextGuideView extends View {
    private final Paint framePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint cropPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private float digitalZoom = 1f;

    public ContextGuideView(Context context) {
        super(context);
        init();
    }

    public ContextGuideView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        setWillNotDraw(false);
        framePaint.setStyle(Paint.Style.STROKE);
        framePaint.setStrokeWidth(dp(1.5f));
        framePaint.setColor(Color.argb(210, 255, 255, 255));

        cropPaint.setStyle(Paint.Style.STROKE);
        cropPaint.setStrokeWidth(dp(2f));
        cropPaint.setColor(Color.rgb(54, 210, 127));
    }

    public void setDigitalZoom(float value) {
        digitalZoom = Math.max(1f, value);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w = getWidth();
        float h = getHeight();
        if (w <= 0 || h <= 0) return;

        float pad = dp(2f);
        canvas.drawRoundRect(new RectF(pad, pad, w - pad, h - pad), dp(7f), dp(7f), framePaint);

        float visibleW = (w - pad * 4f) / digitalZoom;
        float visibleH = (h - pad * 4f) / digitalZoom;
        float left = (w - visibleW) / 2f;
        float top = (h - visibleH) / 2f;
        canvas.drawRoundRect(new RectF(left, top, left + visibleW, top + visibleH), dp(3f), dp(3f), cropPaint);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }
}
