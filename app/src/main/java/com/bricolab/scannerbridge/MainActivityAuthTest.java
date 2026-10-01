package com.bricolab.scannerbridge;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import java.lang.reflect.Field;

/**
 * Test-only activity used by the mobile-auth branch.
 * It keeps the stable V34 scanner UI/camera engine, but blocks scanner controls
 * until BricoLab mobile authentication is verified.
 */
public class MainActivityAuthTest extends MainActivityV34 {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // MainActivity starts the camera automatically. Stop it immediately for the auth test.
        stopScannerNow();

        WebView webView = findViewById(R.id.webView);
        if (webView != null) {
            webView.removeJavascriptInterface("NativeScanner");
            webView.addJavascriptInterface(new AuthNativeBridge(), "NativeScanner");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!canUseScanner()) stopScannerNow();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int key = event.getKeyCode();
        boolean volume = key == KeyEvent.KEYCODE_VOLUME_UP || key == KeyEvent.KEYCODE_VOLUME_DOWN;
        if (volume && !canUseScanner()) return true;
        return super.dispatchKeyEvent(event);
    }

    private boolean canUseScanner() {
        try {
            return ((BricoApplication) getApplication()).canUseScanner();
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean canEditScanner() {
        try {
            return ((BricoApplication) getApplication()).canEditScanner();
        } catch (Exception ignored) {
            return false;
        }
    }

    private void showLoginRequired() {
        runOnUiThread(() -> Toast.makeText(
                MainActivityAuthTest.this,
                "Najpierw zaloguj się do BricoLab.",
                Toast.LENGTH_SHORT
        ).show());
    }

    private void stopScannerNow() {
        ScannerEngine engine = scannerEngineAuth();
        if (engine != null) {
            try { engine.stop(); } catch (Exception ignored) { }
        }
    }

    private ScannerEngine scannerEngineAuth() {
        try {
            Field field = MainActivity.class.getDeclaredField("scannerEngine");
            field.setAccessible(true);
            return (ScannerEngine) field.get(this);
        } catch (Exception ignored) {
            return null;
        }
    }

    public class AuthNativeBridge extends StableNativeBridge {

        @Override
        @JavascriptInterface
        public void startScanner() {
            if (!canUseScanner()) {
                showLoginRequired();
                return;
            }
            super.startScanner();
        }

        @Override
        @JavascriptInterface
        public void setPaused(boolean paused) {
            if (!paused && !canUseScanner()) {
                showLoginRequired();
                return;
            }
            super.setPaused(paused);
        }

        @Override
        @JavascriptInterface
        public void focus() {
            if (!canUseScanner()) return;
            super.focus();
        }

        @Override
        @JavascriptInterface
        public void setTorch(boolean enabled) {
            if (enabled && !canUseScanner()) {
                showLoginRequired();
                return;
            }
            super.setTorch(enabled);
        }

        @Override
        @JavascriptInterface
        public void setZoom(double combinedZoom) {
            if (!canUseScanner()) return;
            super.setZoom(combinedZoom);
        }

        @Override
        @JavascriptInterface
        public void productFeedback(boolean found) {
            if (!canUseScanner()) return;
            super.productFeedback(found);
        }

        @JavascriptInterface
        public boolean hasScannerAccess() {
            return canUseScanner();
        }

        @JavascriptInterface
        public boolean hasScannerEditAccess() {
            return canEditScanner();
        }
    }
}
