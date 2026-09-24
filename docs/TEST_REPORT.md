# Raport weryfikacji ShadowArchive 1.0.0

Data: 24 września 2026. Weryfikacja dotyczy dołączonego kodu. To testy funkcjonalne, nie certyfikacja bezpieczeństwa ani gwarancja działania na każdym urządzeniu.

## Wynik

- Testy Node: **15 PASS, 0 FAIL**. Log: `node-test-results.txt`.
- Testy integracyjne w przeglądarce Chromium: **16 PASS, 0 FAIL, 2 SKIP**.
- Otworzono rzeczywistą aplikację i sprawdzono interfejs desktop oraz obszar mobilny 390 × 844 px.
- Zestaw obciążeniowy: 100 spraw, 10 000 źródeł, 5 000 osób, 5 000 organizacji, 20 000 relacji, dodatkowe rekordy testów funkcjonalnych. Nie dodaje danych do bazy użytkownika.

## Sprawdzone obszary

| Obszar | Zakres |
| --- | --- |
| IndexedDB | Utworzenie, odczyt po edycji, konflikt rewizji, log w transakcji, migracja v1 → v2 |
| Usuwanie | Kosz, przywrócenie, usunięcie definitywne, ochrona referencji |
| Szkice | Długa notatka, trwałość treści, odzyskanie niedokończonego formularza i załącznika |
| Metodologia | Fakt wymaga źródła; status hipotezy nie zamienia kategorii na fakt; oddzielenie kategorii w raporcie |
| Import i eksport | Pełny backup, walidacja, remap kolizji ID, zachowanie referencji, odrzucenie brakujących/zmienionych plików, rollback całej transakcji |
| Kryptografia | SHA-256 `abc`, zachowanie oryginalnych bajtów, AES-GCM roundtrip, losowe parametry, błędne hasło, zmiana szyfrogramu, odrzucenie nieprawidłowego KDF |
| Kopia w częściach | Odtworzenie pliku przekraczającego 16 MiB, brak części, uszkodzenie części, szyfrowany zestaw |
| Wyszukiwarka | Worker, aliasy, frazy, tagi, sprawa, typ, stronicowanie 50 wyników przy ponad 40 tys. rekordów |
| Analiza | Jakość danych, propozycje duplikatów, graf z 20 tys. relacji i ograniczonym renderowaniem, timeline i filtry |
| Notatki | Markdown: tabele, odnośniki do rekordów, neutralizacja HTML/XSS |
| Dork Builder | Składnia zależna od silnika, ograniczenia dat, działający formularz, zapis zapytania do Search Log |
| Widoki | Dashboard, karta i historia, linki tagów, raport, generator zapytań |
| PWA — kod | Manifest, kompletność plików cache, ścieżka repozytorium, symulowany lifecycle i odpowiedzi cache bez sieci; obce URL nie są przechwytywane |

Przejścia manualne w aplikacji: dodanie fikcyjnego demo, utworzenie i edycja sprawy, autosave, kosz/przywrócenie, rozpoczęcie/zakończenie sesji, Quick Add, szkic notatki na wąskim ekranie, karta sprawy, zapis dorka. W trakcie audytu poprawiono m.in. odzyskiwanie szkiców z plikami, ochronę oryginałów, nawigację po operacji kosza oraz renderowanie pól i historii. Po naprawach powtórzono zestaw integracyjny.

## Orientacyjne pomiary końcowego przebiegu Chromium

| Operacja | Czas |
| --- | ---: |
| Import 40 100 rekordów do IndexedDB | 4527 ms |
| Odczyt i inicjalizacja indeksu, pierwsze zapytanie | 835 ms |
| Zapytanie po zleceniu inicjalizacji | 253 ms |
| Wyszukiwarka i stronicowany widok | 334 ms |
| Jakość danych: 55 010 kontroli | 219 ms |
| Graf: filtrowanie i początkowy render | 37 ms |
| Timeline: zestaw sprawdzeń chronologii i filtrów | 585 ms |

Wyniki zależą od procesora, ilości pamięci, długości treści, urządzenia i limitów przeglądarki. Nie są gwarancją identycznych czasów na iPhonie ani przy dużych transkrypcjach.

## Uczciwe granice testu

Podgląd udostępniał zwykły HTTP. Chromium blokuje w nim Service Worker i Web Crypto. Dlatego dwa testy przeglądarkowe oznaczono **SKIP**, a nie PASS. Kryptografię wykonano w Node Web Crypto; kod Service Workera sprawdzono w kontrolowanym modelu Cache/Fetch. Nie zastępuje to instalacji PWA i próby offline na docelowym HTTPS.

Nie wykonano instalacji na fizycznym iPhonie, iPadzie, Androidzie, Windows ani macOS, testu Safari/WebKit, prawdziwego wdrożenia GitHub Pages, aktualizacji z wcześniejszego wydania na produkcji ani audytu przez niezależnego specjalistę. Mobilny test iframe sprawdza layout; nie emuluje systemowej klawiatury iOS.

Po publikacji przez HTTPS: poczekaj na instalację Service Workera, przeładuj, wyłącz sieć, utwórz notatkę, ponownie ją otwórz, sprawdź SHA-256 małego pliku i import szyfrowanego backupu. Instalację i aktualizację PWA sprawdź na docelowym urządzeniu. Instrukcje są w README.

## Powtarzanie

`npm ci --ignore-scripts` i `npm test` uruchamia testy Node. Testy przeglądarkowe są w `tests/index.html`; lokalny serwer opisano w README. Node nie jest wymagany do publikacji ani korzystania z aplikacji. Testy tworzą oddzielne bazy o prefiksie `shadowarchive-test-`; można je usunąć w narzędziach deweloperskich przeglądarki po zakończeniu testów.
