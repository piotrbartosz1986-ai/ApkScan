package com.bricolab.scannerbridge;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Exact build-320 scanner UI/camera core with BricoLab auth enforced on every entry.
 * Accessis JavaScript bridges are installed immediately after the proven scanner
 * activity has created its WebView, before the remote UI fetch can complete.
 */
public class MainActivityAuthLatest extends MainActivityV36 {
    private final Handler authHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService authExecutor = Executors.newSingleThreadExecutor();
    private WebView authWebView;
    private boolean destroyed = false;
    private boolean verifying = false;
    private boolean returningToGate = false;

    private final Runnable authPulse = new Runnable() {
        @Override
        public void run() {
            if (destroyed) return;
            BricoAuthApplication app = (BricoAuthApplication) getApplication();
            if (app.authClient().canUseScanner()) {
                pushAuthState();
            } else {
                ensureVerifiedSession();
            }
            authHandler.postDelayed(this, 900L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        authWebView = findViewById(R.id.webView);

        // IMPORTANT: wire the only BricoUpload/BricoAuth bridge explicitly now.
        // The base activity has already created the WebView, while its remote UI
        // is still being fetched asynchronously. This avoids "Brak transportu".
        BricoAuthApplication app = (BricoAuthApplication) getApplication();
        app.installBridges(this);

        ensureVerifiedSession();
        authHandler.postDelayed(authPulse, 250L);
    }

    @Override
    protected void onResume() {
        super.onResume();
        ensureVerifiedSession();
    }

    private void ensureVerifiedSession() {
        if (destroyed || returningToGate || verifying) return;
        BricoAuthApplication app = (BricoAuthApplication) getApplication();
        if (app.authClient().canUseScanner()) {
            pushAuthState();
            return;
        }

        verifying = true;
        authExecutor.execute(() -> {
            boolean ok = false;
            try {
                app.authClient().verify();
                ok = app.authClient().canUseScanner();
            } catch (Exception ignored) {
                ok = false;
            }
            final boolean verifiedOk = ok;
            runOnUiThread(() -> {
                verifying = false;
                if (destroyed) return;
                if (verifiedOk) pushAuthState();
                else returnToLoginGate();
            });
        });
    }

    private void pushAuthState() {
        if (destroyed || authWebView == null) return;
        try {
            BricoAuthApplication app = (BricoAuthApplication) getApplication();
            JSONObject state = app.authClient().stateObject();
            String js = "(function(){try{" +
                    "var s=" + state.toString() + ";" +
                    "window.BricoScannerAuth=s;" +
                    "window.dispatchEvent(new CustomEvent('brico-auth-change',{detail:s}));" +
                    "}catch(e){}})();";
            authWebView.evaluateJavascript(js, null);
        } catch (Exception ignored) {}
    }

    private void returnToLoginGate() {
        if (returningToGate || isFinishing()) return;
        returningToGate = true;
        Intent intent = new Intent(this, CameraPermissionGateAuthLatestActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        overridePendingTransition(0, 0);
        finish();
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        authHandler.removeCallbacksAndMessages(null);
        authExecutor.shutdownNow();
        authWebView = null;
        super.onDestroy();
    }
}
