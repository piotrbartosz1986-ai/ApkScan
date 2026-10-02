package com.bricolab.scannerbridge;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import org.json.JSONObject;

/**
 * Exact build-320 scanner UI and camera core with only the BricoLab auth state
 * bridged into the already-existing web UI. No HTML/converter/status files are changed.
 */
public class MainActivityAuthLatest extends MainActivityV36 {
    private final Handler authHandler = new Handler(Looper.getMainLooper());
    private WebView authWebView;
    private boolean destroyed = false;

    private final Runnable pushAuthState = new Runnable() {
        @Override
        public void run() {
            if (destroyed || authWebView == null) return;
            try {
                BricoAuthApplication app = (BricoAuthApplication) getApplication();
                JSONObject state = app.authClient().stateObject();
                String js = "(function(){try{" +
                        "var s=" + state.toString() + ";" +
                        "window.BricoScannerAuth=s;" +
                        "localStorage.setItem('brico.upload.token','BRICOLAB_SESSION_AUTH');" +
                        "window.dispatchEvent(new CustomEvent('brico-auth-change',{detail:s}));" +
                        "}catch(e){}})();";
                authWebView.evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        authWebView = findViewById(R.id.webView);
        authHandler.postDelayed(pushAuthState, 350L);
        authHandler.postDelayed(pushAuthState, 900L);
        authHandler.postDelayed(pushAuthState, 1800L);
        authHandler.postDelayed(pushAuthState, 3200L);
    }

    @Override
    protected void onResume() {
        super.onResume();
        authHandler.postDelayed(pushAuthState, 200L);
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        authHandler.removeCallbacksAndMessages(null);
        authWebView = null;
        super.onDestroy();
    }
}
