package com.bricolab.scannerbridge;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class CameraPermissionGateAuthLatestActivity extends AppCompatActivity {
    private static final int CAMERA_PERMISSION_REQUEST = 7601;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private BricoAuthClient authClient;
    private TextView statusText;
    private EditText loginInput;
    private EditText passwordInput;
    private Button mainButton;
    private boolean openingScanner = false;
    private boolean authStarted = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        BricoAuthApplication app = (BricoAuthApplication) getApplication();
        authClient = app.authClient();
        if (!hasCameraPermission()) buildCameraScreen(); else startAuthGate();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!openingScanner && hasCameraPermission() && !authStarted) startAuthGate();
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private LinearLayout root() {
        float d = getResources().getDisplayMetrics().density;
        int pad = Math.round(24 * d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(pad, pad, pad, pad);
        root.setBackgroundColor(Color.rgb(11,13,16));
        return root;
    }

    private TextView title(String text) {
        TextView v = new TextView(this);
        v.setText(text); v.setTextColor(Color.WHITE); v.setTextSize(27f); v.setGravity(Gravity.CENTER);
        v.setTypeface(v.getTypeface(), android.graphics.Typeface.BOLD);
        return v;
    }

    private TextView info(String text) {
        TextView v = new TextView(this);
        v.setText(text); v.setTextColor(Color.rgb(180,188,197)); v.setTextSize(14f); v.setGravity(Gravity.CENTER);
        int p = Math.round(18 * getResources().getDisplayMetrics().density);
        v.setPadding(0,p,0,p);
        return v;
    }

    private Button primary(String text) {
        Button b = new Button(this);
        b.setText(text); b.setTextColor(Color.WHITE); b.setTextSize(13f);
        b.setTypeface(b.getTypeface(), android.graphics.Typeface.BOLD);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(30,125,71)));
        return b;
    }

    private void buildCameraScreen() {
        authStarted = false;
        LinearLayout r = root();
        r.addView(title("Skaner AUTH LATEST"));
        statusText = info("Najpierw nadaj zgodę na aparat.\nNastępnie zalogujesz się kontem BricoLab.");
        r.addView(statusText);
        mainButton = primary("ZEZWÓL NA APARAT");
        mainButton.setOnClickListener(v -> ActivityCompat.requestPermissions(
                this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST));
        r.addView(mainButton, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                Math.round(52 * getResources().getDisplayMetrics().density)));
        setContentView(r);
    }

    private void startAuthGate() {
        if (openingScanner || authStarted) return;
        authStarted = true;
        boolean saved = authClient.stateObject().optBoolean("savedSession", false);
        if (saved) {
            buildChecking("Sprawdzam zapisaną sesję BricoLab…");
            executor.execute(() -> {
                try {
                    authClient.verify();
                    if (!authClient.canUseScanner()) throw new BricoAuthClient.AuthException(403,"scanner_forbidden");
                    runOnUiThread(this::openScanner);
                } catch (Exception error) {
                    try { authClient.logout(); } catch (Exception ignored) {}
                    runOnUiThread(() -> buildLogin(friendly(error)));
                }
            });
        } else buildLogin("");
    }

    private void buildChecking(String message) {
        LinearLayout r = root();
        r.addView(title("BricoLab · Skaner"));
        statusText = info(message);
        r.addView(statusText);
        setContentView(r);
    }

    private EditText field(String hint, boolean password) {
        EditText e = new EditText(this);
        e.setHint(hint); e.setHintTextColor(Color.rgb(125,135,145)); e.setTextColor(Color.WHITE);
        e.setTextSize(16f); e.setSingleLine(true); e.setPadding(16,0,16,0);
        e.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(70,82,94)));
        e.setInputType(password ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD : InputType.TYPE_CLASS_TEXT);
        return e;
    }

    private void buildLogin(String message) {
        authStarted = true;
        LinearLayout r = root();
        r.addView(title("Zaloguj się do BricoLab"));
        r.addView(info("Użyj tego samego loginu i hasła co na stronie BricoLab.\nAplikacja sprawdzi uprawnienie do modułu Skaner."));
        loginInput = field("Login", false);
        passwordInput = field("Hasło", true);
        int h = Math.round(52 * getResources().getDisplayMetrics().density);
        r.addView(loginInput, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,h));
        LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,h);
        pp.topMargin = Math.round(8 * getResources().getDisplayMetrics().density);
        r.addView(passwordInput, pp);
        mainButton = primary("ZALOGUJ");
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,h);
        bp.topMargin = Math.round(14 * getResources().getDisplayMetrics().density);
        r.addView(mainButton,bp);
        mainButton.setOnClickListener(v -> login());
        statusText = info(message == null ? "" : message);
        if (message != null && !message.isEmpty()) statusText.setTextColor(Color.rgb(255,120,120));
        r.addView(statusText);
        passwordInput.setOnEditorActionListener((v,actionId,event) -> { login(); return true; });
        setContentView(r);
        loginInput.requestFocus();
    }

    private void login() {
        String login = loginInput == null ? "" : loginInput.getText().toString().trim();
        String password = passwordInput == null ? "" : passwordInput.getText().toString();
        if (login.isEmpty() || password.isEmpty()) { setStatus("Wpisz login i hasło.", false); return; }
        setBusy(true);
        executor.execute(() -> {
            try {
                authClient.login(login,password);
                authClient.verify();
                if (!authClient.canUseScanner()) throw new BricoAuthClient.AuthException(403,"scanner_forbidden");
                runOnUiThread(this::openScanner);
            } catch (Exception error) {
                runOnUiThread(() -> {
                    setBusy(false);
                    setStatus(friendly(error), false);
                    if (passwordInput != null) { passwordInput.setText(""); passwordInput.requestFocus(); }
                });
            }
        });
    }

    private void setBusy(boolean busy) {
        if (mainButton != null) { mainButton.setEnabled(!busy); mainButton.setText(busy ? "SPRAWDZAM…" : "ZALOGUJ"); }
        if (loginInput != null) loginInput.setEnabled(!busy);
        if (passwordInput != null) passwordInput.setEnabled(!busy);
        if (busy) setStatus("Logowanie i sprawdzanie uprawnień…", true);
    }

    private void setStatus(String text, boolean neutral) {
        if (statusText == null) return;
        statusText.setTextColor(neutral ? Color.rgb(180,188,197) : Color.rgb(255,120,120));
        statusText.setText(text == null ? "" : text);
    }

    private String friendly(Exception error) {
        String code = error instanceof BricoAuthClient.AuthException
                ? ((BricoAuthClient.AuthException) error).errorCode : "network_error";
        if ("invalid_credentials".equals(code)) return "Nieprawidłowy login lub hasło.";
        if ("account_inactive".equals(code)) return "Konto jest wyłączone w ACCESSIS.";
        if ("password_change_required".equals(code)) return "Najpierw zmień hasło pierwszego logowania w BricoLab.";
        if ("store_forbidden".equals(code)) return "Konto nie ma dostępu do sklepu Oborniki.";
        if ("scanner_forbidden".equals(code)) return "Konto nie ma dostępu do modułu Skaner.";
        if ("credentials_changed".equals(code)) return "Hasło zostało zmienione. Zaloguj się ponownie.";
        if ("no_saved_session".equals(code) || "invalid_refresh_token".equals(code)) return "Sesja wygasła. Zaloguj się ponownie.";
        return "Błąd połączenia z BricoLab: " + String.valueOf(error.getMessage());
    }

    private void openScanner() {
        if (openingScanner || !hasCameraPermission() || !authClient.canUseScanner()) return;
        openingScanner = true;
        Intent intent = new Intent(this, MainActivityAuthLatest.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
        overridePendingTransition(0,0);
        finish();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != CAMERA_PERMISSION_REQUEST) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) { authStarted = false; startAuthGate(); }
        else { setStatus("Brak zgody na aparat. Skaner nie został uruchomiony.", false); }
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
