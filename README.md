# Brico Scanner Bridge V1

Pierwszy test natywnego skanera Android dla BricoLab/Sentinela.

## Co testujemy

Ta wersja nie korzysta z kamery przez Chrome.

Używa:

- CameraX 1.6.2
- Google ML Kit Barcode Scanning 17.3.0
- tylnej kamery Androida
- prawdziwego `CameraControl.startFocusAndMetering()`
- AF + AE + AWB w centrum strefy skanowania
- automatycznego ponawiania focusa
- ML Kit z modelem wbudowanym w APK
- ukrytego podglądu kamery jako trybu domyślnego

## Obsługiwane kody w V1

- EAN-13
- EAN-8
- UPC-A
- UPC-E
- Code 128
- Code 39
- Code 93
- ITF
- Codabar

Celowo nie włączono QR/DataMatrix, żeby przy teście sklepowym ograniczyć liczbę fałszywych trafień.

## Strefa skanowania

ML Kit analizuje obraz, ale do listy akceptujemy wyłącznie kod, którego środek znajduje się w centralnym pasie:

- X: 7%–93%
- Y: 36%–64%

Jeżeli dwa kody są jednocześnie w strefie, wybierany jest kod najbliżej środka.

## Duplikaty

Ten sam kod:

1. nie może zostać ponownie dodany wcześniej niż po 1,5 s,
2. musi wcześniej zniknąć z obrazu na co najmniej 550 ms.

Czyli zostawienie telefonu skierowanego na jeden kod NIE powinno dodawać go co 1,5 s w nieskończoność.

## Focus

Domyślnie włączone jest automatyczne ponawianie focusa.

CameraX dostaje prawdziwe:

- AF
- AE
- AWB
- punkt w centrum kadru
- rozmiar punktu około 18%

Na ekranie zobaczysz wynik:

- `AF: SUCCESS ✓`
- albo brak potwierdzenia / błąd

Przycisk `◎ FOCUS` wymusza focus ręcznie.

## Kamera ukryta

`Pokaż kamerę` jest domyślnie wyłączone.

To NIE zatrzymuje `ImageAnalysis`, więc skanowanie działa mimo braku podglądu.

Po włączeniu podglądu zobaczysz dokładną strefę skanowania.

## Następny krok po teście

Jeżeli CameraX + ML Kit faktycznie rozwiążą problem ostrości, następna wersja będzie "bridge":

HTML BricoLab/Sentinel
-> natywny CameraX/ML Kit
-> `window.onNativeBarcode(...)`
