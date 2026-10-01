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

/**
 * Native launcher gate used only by the rollback-safe AUTH TEST application.
 * Camera permission and BricoLab account verification both happen BEFORE the
 * scanner Activity is opened, so a web UI race cannot bypass the login screen.
 */
public class CameraPermissionGateAuthActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_REQUEST = 7501;

    private final ExecutorService authExecutor = Executors.newSingleThreadExecutor();
    private BricoAuthClient authClient;

    private TextView statusText;
    private EditText loginInput;
    private EditText passwordInput;
    private Button mainButton;
    private Button logoutButton;

    private boolean openingScanner = false;
    private boolean authCheckStarted = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        authClient = new BricoAuthClient(this);

        if (!hasCameraPermission()) {
            buildCameraPermissionScreen();
            return;
        }

        startAuthGate();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (openingScanner) return;
        if (hasCameraPermission() && !authCheckStarted) startAuthGate();
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    private LinearLayout rootLayout() {
        float density = getResources().getDisplayMetrics().density;
        int pad = Math.round(24f * density);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(pad, pad, pad, pad);
        root.setBackgroundColor(Color.rgb(11, 13, 16));
        return root;
    }

    private TextView title(String text) {
        TextView title = new TextView(this);
        title.setText(text);
        title.setTextColor(Color.WHITE);
        title.setTextSize(27f);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        return title;
    }

    private TextView info(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(Color.rgb(180, 188, 197));
        view.setTextSize(14f);
        view.setGravity(Gravity.CENTER);
        int d = Math.round(18f * getResources().getDisplayMetrics().density);
        view.setPadding(0, d, 0, d);
        return view;
    }

    private Button primaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setTextSize(13f);
        button.setTypeface(button.getTypeface(), android.graphics.Typeface.BOLD);
        button.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(Color.rgb(30, 125, 71))
        );
        return button;
    }

    private void buildCameraPermissionScreen() {
        authCheckStarted = false;
        LinearLayout root = rootLayout();
        root.addView(title("Skaner AUTH TEST"), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        statusText = info("Najpierw nadaj zgodę na aparat.\nPo niej pojawi się logowanie kontem BricoLab.");
        root.addView(statusText, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        mainButton = primaryButton("ZEZWÓL NA APARAT");
        mainButton.setOnClickListener(v -> requestCameraPermission());
        root.addView(mainButton, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                Math.round(52f * getResources().getDisplayMetrics().density)));
        setContentView(root);
    }

    private void requestCameraPermission() {
        if (hasCameraPermission()) {
            startAuthGate();
            return;
        }
        ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.CAMERA},
                CAMERA_PERMISSION_REQUEST
        );
    }

    private void startAuthGate() {
        if (openingScanner || authCheckStarted) return;
        authCheckStarted = true;

        boolean savedSession = false;
        try {
            savedSession = authClient.stateObject().optBoolean("savedSession", false);
        } catch (Exception ignored) { }

        if (savedSession) {
            buildCheckingScreen("Sprawdzam zapisaną sesję BricoLab…");
            verifySavedSession();
        } else {
            buildLoginScreen("");
        }
    }

    private void buildCheckingScreen(String message) {
        LinearLayout root = rootLayout();
        root.addView(title("BricoLab · Skaner"), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        statusText = info(message);
        root.addView(statusText, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(root);
    }

    private EditText field(String hint, boolean password) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setHintTextColor(Color.rgb(125, 135, 145));
        input.setTextColor(Color.WHITE);
        input.setTextSize(16f);
        input.setSingleLine(true);
        input.setPadding(16, 0, 16, 0);
        input.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(Color.rgb(70, 82, 94))
        );
        input.setInputType(password
                ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD
                : InputType.TYPE_CLASS_TEXT);
        return input;
    }

    private void buildLoginScreen(String message) {
        authCheckStarted = true;
        LinearLayout root = rootLayout();
        root.addView(title("Zaloguj się do BricoLab"), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView description = info("Użyj tego samego loginu i hasła co na stronie BricoLab.\nAplikacja sprawdzi uprawnienie do modułu Skaner.");
        root.addView(description, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        loginInput = field("Login", false);
        passwordInput = field("Hasło", true);
        int fieldHeight = Math.round(52f * getResources().getDisplayMetrics().density);
        root.addView(loginInput, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, fieldHeight));
        LinearLayout.LayoutParams passwordParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, fieldHeight);
        passwordParams.topMargin = Math.round(8f * getResources().getDisplayMetrics().density);
        root.addView(passwordInput, passwordParams);

        mainButton = primaryButton("ZALOGUJ");
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                Math.round(52f * getResources().getDisplayMetrics().density));
        buttonParams.topMargin = Math.round(14f * getResources().getDisplayMetrics().density);
        root.addView(mainButton, buttonParams);
        mainButton.setOnClickListener(v -> login());

        statusText = info(message == null ? "" : message);
        statusText.setTextColor(message == null || message.isEmpty()
                ? Color.rgb(180, 188, 197)
                : Color.rgb(255, 120, 120));
        root.addView(statusText, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        logoutButton = new Button(this);
        logoutButton.setText("WYCZYŚĆ ZAPISANĄ SESJĘ");
        logoutButton.setTextColor(Color.rgb(190, 198, 206));
        logoutButton.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(Color.rgb(40, 47, 54))
        );
        logoutButton.setOnClickListener(v -> {
            authClient.logout();
            if (statusText != null) statusText.setText("Sesja została wyczyszczona.");
        });
        LinearLayout.LayoutParams logoutParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                Math.round(44f * getResources().getDisplayMetrics().density));
        logoutParams.topMargin = Math.round(6f * getResources().getDisplayMetrics().density);
        root.addView(logoutButton, logoutParams);

        passwordInput.setOnEditorActionListener((v, actionId, event) -> {
            login();
            return true;
        });

        setContentView(root);
        loginInput.requestFocus();
    }

    private void login() {
        if (openingScanner) return;
        String login = loginInput == null ? "" : loginInput.getText().toString().trim();
        String password = passwordInput == null ? "" : passwordInput.getText().toString();
        if (login.isEmpty() || password.isEmpty()) {
            if (statusText != null) {
                statusText.setTextColor(Color.rgb(255, 120, 120));
                statusText.setText("Wpisz login i hasło.");
            }
            return;
        }

        setBusy(true, "Logowanie…");
        authExecutor.execute(() -> {
            try {
                authClient.login(login, password);
                authClient.verify();
                if (!authClient.canUseScanner()) {
                    throw new BricoAuthClient.AuthException(403, "scanner_forbidden");
                }
                runOnUiThread(this::openScanner);
            } catch (BricoAuthClient.AuthException error) {
                runOnUiThread(() -> {
                    setBusy(false, friendly(error.errorCode));
                    if (passwordInput != null) {
                        passwordInput.setText("");
                        passwordInput.requestFocus();
                    }
                });
            } catch (Exception error) {
                runOnUiThread(() -> setBusy(false,
                        "Błąd połączenia z BricoLab: " + String.valueOf(error.getMessage())));
            }
        });
    }

    private void verifySavedSession() {
        authExecutor.execute(() -> {
            try {
                authClient.verify();
                if (!authClient.canUseScanner()) {
                    throw new BricoAuthClient.AuthException(403, "scanner_forbidden");
                }
                runOnUiThread(this::openScanner);
            } catch (Exception error) {
                try { authClient.logout(); } catch (Exception ignored) { }
                runOnUiThread(() -> buildLoginScreen(
                        error instanceof BricoAuthClient.AuthException
                                ? friendly(((BricoAuthClient.AuthException) error).errorCode)
                                : "Sesja wygasła. Zaloguj się ponownie."
                ));
            }
        });
    }

    private void setBusy(boolean busy, String message) {
        if (mainButton != null) {
            mainButton.setEnabled(!busy);
            mainButton.setText(busy ? "SPRAWDZAM…" : "ZALOGUJ");
        }
        if (loginInput != null) loginInput.setEnabled(!busy);
        if (passwordInput != null) passwordInput.setEnabled(!busy);
        if (statusText != null) {
            statusText.setTextColor(busy
                    ? Color.rgb(180, 188, 197)
                    : Color.rgb(255, 120, 120));
            statusText.setText(message == null ? "" : message);
        }
    }

    private String friendly(String code) {
        if (code == null) return "Błąd logowania.";
        if ("invalid_credentials".equals(code)) return "Nieprawidłowy login lub hasło.";
        if ("account_inactive".equals(code)) return "Konto jest wyłączone w ACCESSIS.";
        if ("password_change_required".equals(code)) return "Najpierw zmień hasło pierwszego logowania w BricoLab.";
        if ("store_forbidden".equals(code)) return "Konto nie ma dostępu do sklepu Oborniki.";
        if ("scanner_forbidden".equals(code)) return "Konto nie ma dostępu do modułu Skaner.";
        if ("credentials_changed".equals(code)) return "Hasło zostało zmienione. Zaloguj się ponownie.";
        if ("no_saved_session".equals(code) || "invalid_refresh_token".equals(code)) {
            return "Sesja wygasła. Zaloguj się ponownie.";
        }
        return "Błąd logowania: " + code;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != CAMERA_PERMISSION_REQUEST) return;
        boolean granted = grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            authCheckStarted = false;
            startAuthGate();
        } else {
            if (statusText != null) {
                statusText.setText("Brak zgody na aparat. Skaner nie został uruchomiony.");
            }
            if (mainButton != null) mainButton.setText("SPRÓBUJ PONOWNIE");
        }
    }

    private void openScanner() {
        if (openingScanner || !hasCameraPermission() || !authClient.canUseScanner()) return;
        openingScanner = true;
        Intent intent = new Intent(this, MainActivityAuthTest.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
        overridePendingTransition(0, 0);
        finish();
    }

    @Override
    protected void onDestroy() {
        authExecutor.shutdownNow();
        super.onDestroy();
    }
}
