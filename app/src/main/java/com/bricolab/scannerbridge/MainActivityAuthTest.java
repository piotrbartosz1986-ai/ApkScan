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

    private static final String AUTH_WEB_BASE =
            "https://raw.githubusercontent.com/piotrbartosz1986-ai/ApkScan/mobile-auth-v1/web/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // MainActivity starts the camera automatically. Stop it immediately for the auth test.
        stopScannerNow();

        WebView webView = findViewById(R.id.webView);
        if (webView != null) {
            webView.removeJavascriptInterface("NativeScanner");
            webView.addJavascriptInterface(new AuthNativeBridge(), "NativeScanner");

            // Stable scanner UI still comes from main. Once it is present, inject only the
            // isolated AUTH layer from mobile-auth-v1. This keeps rollback trivial.
            scheduleAuthInjection(webView, 700L);
            scheduleAuthInjection(webView, 1400L);
            scheduleAuthInjection(webView, 2800L);
            scheduleAuthInjection(webView, 5000L);
        }
    }

    private void scheduleAuthInjection(WebView webView, long delayMs) {
        webView.postDelayed(() -> {
            String base = AUTH_WEB_BASE.replace("'", "\\'");
            String js = "(function(){"
                    + "if(window.__bricoAuthTestInjected===true||window.__bricoAuthTestInjected==='loading')return;"
                    + "if(!document.getElementById('hero'))return;"
                    + "window.__bricoAuthTestInjected='loading';"
                    + "var b='" + base + "';var s=Date.now();"
                    + "Promise.all(["
                    + "fetch(b+'bricolab-auth-extension.js?_='+s,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('AUTH '+r.status);return r.text()}),"
                    + "fetch(b+'upload-auth-extension.js?_='+s,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('UPLOAD '+r.status);return r.text()}),"
                    + "fetch(b+'product-data-auth-extension.js?_='+s,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('PRODUCT '+r.status);return r.text()})"
                    + "]).then(function(x){(0,eval)(x[0]);(0,eval)(x[1]);(0,eval)(x[2]);window.__bricoAuthTestInjected=true;})"
                    + ".catch(function(e){window.__bricoAuthTestInjected=false;console.error('Brico AUTH inject',e);});"
                    + "})();";
            try { webView.evaluateJavascript(js, null); } catch (Exception ignored) { }
        }, delayMs);
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
        public void setPreviewVisible(boolean visible) {
            if (visible && !canUseScanner()) {
                stopScannerNow();
                return;
            }
            super.setPreviewVisible(visible);
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
