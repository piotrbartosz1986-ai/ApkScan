# Brico Scanner Bridge V2

V2 rozdziela aplikację na dwie warstwy:

## 1. APK = stabilny silnik Android

Natywna część odpowiada za:

- CameraX
- Google ML Kit Barcode Scanning
- focus AF/AE/AWB w centrum pola
- automatyczne ponawianie focusa
- zoom
- latarkę
- analizę kodów
- komunikację JavaScript z interfejsem

APK nie zawiera już głównej logiki interfejsu użytkownika.

## 2. `web/` = zdalny interfejs i zasady

Aplikacja przy uruchomieniu pobiera z tego repozytorium:

- `web/index.html` — cały interfejs HTML/JS
- `web/scanner-config.json` — parametry skanera

Dzięki temu większość zmian nie wymaga ponownego instalowania APK.

### Zmiana wyglądu / logiki HTML

Edytujesz:

`web/index.html`

Po ponownym otwarciu aplikacji pobierana jest aktualna wersja. W samym UI jest też przycisk `ODŚWIEŻ UI`.

### Zmiana zasad skanera

Edytujesz:

`web/scanner-config.json`

Aktualnie zdalnie sterowane są:

- `duplicateDelayMs`
- `releaseDelayMs`
- `focusIntervalMs`
- `autoFocus`
- `roi.left/right/top/bottom`
- lista formatów kodów

Przycisk `ODŚWIEŻ CONFIG` pobiera nową konfigurację bez instalacji nowego APK. Jeśli skaner był uruchomiony, bridge restartuje go, żeby również nowa lista formatów zaczęła działać.

## Tryb offline

Aplikacja stosuje kolejność:

1. aktualny plik z GitHuba,
2. ostatnia poprawnie pobrana kopia w cache,
3. awaryjny HTML i config wbudowany w APK.

Czyli utrata internetu nie blokuje podstawowego skanowania.

## Komunikacja HTML ↔ Android

Android udostępnia obiekt:

`window.NativeScanner`

Najważniejsze metody:

- `startScanner()`
- `stopScanner()`
- `setPaused(boolean)`
- `focus()`
- `setTorch(boolean)`
- `setZoom(0..1)`
- `setPreviewVisible(boolean)`
- `reloadConfig()`
- `reloadUi()`
- `getConfig()`
- `getState()`
- `getNativeInfo()`

Po odczycie Android wywołuje:

```js
window.onNativeBarcode({
  code: "5901234567890",
  format: "EAN_13",
  timestamp: 1780000000000
});
```

Stan kamery jest przekazywany przez:

```js
window.onNativeScannerState({...});
```

## Budowanie APK

GitHub Actions buduje testowe APK. Po udanym workflow plik znajduje się w `Artifacts` jako:

`BricoScanner-debug-apk`

## Ważne o aktualizacji APK

Obecny workflow tworzy APK typu debug. Nowy runner GitHuba może użyć innego klucza debug, więc przy zmianach natywnego APK Android może wymagać odinstalowania poprzedniej wersji.

Po potwierdzeniu V2 należy zrobić jednorazowo stałe podpisywanie release przez GitHub Secrets. Wtedy również natywne aktualizacje będą instalowane nad istniejącą aplikacją.
