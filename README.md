# ShadowArchive — OSINT Workspace

Lokalne środowisko do codziennego researchu OSINT. Wersja **1.0.0**, interfejs po polsku. Aplikacja jest statyczna, przechowuje dane w IndexedDB i działa na GitHub Pages.

**Publikacja i użytkowanie nie wymagają Node.js, npm, backendu, płatnych API ani budowania projektu.** Pliki `package.json` i `package-lock.json` dotyczą wyłącznie opcjonalnych testów i podglądu deweloperskiego.

## Funkcje

| Obszar | Działanie |
| --- | --- |
| Sprawy | Wiele spraw, statusy, priorytety, cel, zakres, pytania, ograniczenia, przypinanie |
| Źródła | URL i archiwa, cytaty, autor, wydawca, daty, klasyfikacja i niezależne kryteria jakości |
| Podmioty | Osoby, aliasy, transliteracje, organizacje i ich historia, domeny, strony, lokalizacje i profile publiczne |
| Materiały | Dokumenty, screenshoty, audio/video/obrazy, oryginały plików, SHA-256 i metadane |
| Analiza | Ustalenia, twierdzenia, hipotezy, sprzeczności, chronologia, ręcznie tworzone relacje i graf |
| Codzienna praca | Tropy, zadania, dziennik, sesje OSINT, notatki Markdown, szkice i autosave |
| Wyszukiwanie | Worker, frazy, #tagi, warianty nazw, typy, daty, status i zakres sprawy |
| Jakość | Braki danych i potencjalne duplikaty; bez automatycznego scalania i oceniania osób |
| Kopie | JSON z załącznikami, backup w częściach, szyfrowanie hasłem i walidowany import |
| Raporty | Rozdzielone kategorie informacji, źródła i załączniki; HTML, PDF przez druk, CSV, Markdown |
| PWA | Manifest, ikony, cache, offline, instalacja i powiadomienie o aktualizacji |
| Ergonomia | Jasny/ciemny/systemowy motyw, mobile, Quick Add, skróty i przyklejony pasek zapisu |

## Metodologia: kategoria to nie status weryfikacji

- **FAKT POTWIERDZONY** — ręcznie sklasyfikowane ustalenie ze wskazanym źródłem.
- **TWIERDZENIE ŹRÓDŁA** — to, co podaje źródło, oddzielone od ustaleń autora.
- **HIPOTEZA** — możliwe wyjaśnienie, także jeśli ręcznie otrzymało status „Potwierdzona”.
- **INFORMACJA NIEWERYFIKOWANA** — informacja wymagająca sprawdzenia.
- **WNIOSEK ANALITYCZNY** — interpretacja autora.

Kategorię ustalenia wybiera się w module **Ustalenia**. Hipotezy i twierdzenia mają kategorię utrwaloną przez swój typ rekordu. Zmiana statusu nigdy nie przenosi ich automatycznie do faktów. Kompletność danych nie jest prawdopodobieństwem prawdy. Współwystępowanie osób nie tworzy relacji grafu.

## GitHub Pages — krok po kroku

1. Rozpakuj ZIP i otwórz folder `shadowarchive`.
2. Zaloguj się do GitHub i wybierz **New repository**.
3. Nadaj nazwę, np. `shadowarchive`. Dla bezpłatnej publikacji z publicznego repozytorium wybierz **Public**.
4. Utwórz repozytorium. Ma zawierać kod aplikacji — nie dane spraw i nie backupy.
5. Wybierz **Add file → Upload files**.
6. Przeciągnij **zawartość** folderu `shadowarchive`, zachowując podfoldery. `index.html` musi leżeć bezpośrednio w katalogu głównym repozytorium. Nie wrzucaj samego ZIP.
7. Zapisz zmiany przez **Commit changes**.
8. Upewnij się, że jest plik `.nojekyll`. Jeżeli system go ukrył, utwórz w GitHub pusty plik o tej nazwie.
9. Otwórz **Settings → Pages**.
10. W **Build and deployment** wybierz **Deploy from a branch**.
11. Wybierz **main** oraz **/ (root)**, następnie **Save**.
12. Poczekaj na publikację. GitHub pokaże adres, zwykle `https://NAZWA-UZYTKOWNIKA.github.io/shadowarchive/`.
13. Otwórz go przez HTTPS i przy pierwszym uruchomieniu pozostaw połączenie online, aby pobrać cache.
14. Utwórz testową sprawę, przeładuj aplikację i sprawdź, czy pozostała. Wykonaj pierwszy backup.

Ścieżki są względne, a routing używa `#...`. Obsługiwany jest katalog repozytorium, nie tylko korzeń domeny. Publikacja nie wymaga reguł przekierowania ani kompilacji. Pliki testowe i dokumentacyjne można pozostawić w tym samym folderze albo pominąć przy publikacji; sama aplikacja nie wymaga npm.

Na iPhone pierwsze przesłanie całego folderu do GitHub może być niewygodne; najłatwiej wykonać je z komputera. Codzienna praca działa potem normalnie z telefonu.

Aplikacja nie wysyła zawartości IndexedDB do GitHub. Publiczność kodu repozytorium nie oznacza publikacji lokalnej bazy. **Nie dodawaj backupów do publicznego repozytorium.**

## Instalacja PWA i offline

**iPhone/iPad:** otwórz adres w Safari → Udostępnij → Do ekranu początkowego. Nazwy opcji mogą zależeć od systemu. Po uruchomieniu z ikony sprawdź obecność danych; niektóre konfiguracje oddzielają pamięć przeglądarki i aplikacji. W razie potrzeby przenieś dane backupem.

**Android/desktop:** użyj opcji instalacji w menu przeglądarki albo **Ustawienia → Zainstaluj aplikację PWA**. Jeśli przeglądarka nie udostępnia programowego dialogu, aplikacja wyświetli instrukcję.

Po poprawnym pobraniu zasobów Service Worker udostępnia aplikację offline. Rekordy i lokalne pliki są dostępne bez sieci. Zewnętrzne źródła i archiwa wymagają internetu. Aplikacja nie pobiera automatycznie treści cudzych stron.

Service Worker i Web Crypto wymagają **HTTPS lub localhost**. Zwykły HTTP umożliwia pracę z rekordami, ale pokazuje ograniczenie SHA-256, szyfrowania i PWA. Nie uruchamiaj dwuklikiem jako `file://`.

## Pierwsza sesja pracy

1. **Dodaj → Sprawa**: określ nazwę, cel, zakres, pytania i ograniczenia.
2. Otwórz kartę sprawy. Ustawi ona zakres pracy. Na desktopie wybór jest też u góry, na telefonie w wysuwanym menu.
3. Na pulpicie kliknij **Rozpocznij sesję OSINT**.
4. Dodaj źródło: URL, autor, daty, cytat i pochodzenie. Oddziel publikację od opisywanego wydarzenia.
5. Dodaj osoby i organizacje; zapisz warianty nazw oraz źródła.
6. Połącz rekordy przez **Wybierz**. Wyszukiwanie w selektorze obejmuje warianty i ID.
7. Dodaj wydarzenia z datami i źródłami. Oś czasu grupuje dzień, miesiąc, rok lub dekadę; filtruj osobą, organizacją, kategorią i sprawą.
8. Wprowadź twierdzenia źródeł; osobno hipotezy z argumentami za/przeciw i alternatywami.
9. Ręcznie utwórz relacje: dwa rekordy, typ, data, opis i źródło. Zweryfikowana relacja wymaga źródła; robocza bez źródła jest oznaczona jako brak danych.
10. Kolejne kroki zapisz jako zadania i tropy.
11. Sprawdź Analizę oraz Jakość danych. Luka chronologii nie dowodzi, że nic się nie wydarzyło.
12. Przygotuj raport, sprawdź treść i źródła, następnie eksportuj HTML lub drukuj do PDF.
13. Zakończ sesję z podsumowaniem i pobierz backup.

## Pliki i SHA-256

Dokument, Materiał i Medium przyjmują lokalny plik. Oryginał jest przechowywany jako Blob wraz z nazwą, rozmiarem, MIME, datą dodania i SHA-256. Nie można podmienić oryginału w istniejącej karcie — inny plik dodaje się jako nowy rekord. **Sprawdź integralność** ponownie oblicza hash.

Hash potwierdza zgodność bajtów, nie autentyczność treści ani czas jej powstania. Dziennik jest historią operacyjną, nie niezmienialnym łańcuchem dowodowym.

Limit pojedynczego załącznika wynosi **150 MiB**, aby ograniczyć zużycie pamięci podczas hashowania. Większe nagrania kataloguj przez URL i metadane, przechowując oryginały osobno. Podgląd obejmuje lokalne obrazy rastrowe; SVG, HTML i dokumenty biurowe nie są wykonywane ani automatycznie osadzane. Oryginały można pobrać.

Nie ma automatycznego OCR, transkrypcji ani indeksowania treści PDF/DOCX. Wyszukiwanie obejmuje wpisane metadane, teksty i notatki.

## Autosave, szkice, undo i kosz

Formularz zachowuje szkic po krótkiej przerwie w pisaniu, a poprawny rekord zapisuje po około sekundzie. `Zapisz` i Ctrl/Cmd+S wymuszają zapis. „Zapisano” pojawia się po zakończonej transakcji.

Niekompletne dane pozostają szkicem na pulpicie: **Szkice do odzyskania → Kontynuuj**. **Zamknij** zachowuje zmiany; nie jest anulowaniem edycji. Zmiany statusu/kategorii są decyzją użytkownika, choć zapisują się automatycznie.

Rewizje blokują ciche nadpisanie zapisanego rekordu przez drugą kartę. Edytuj dany rekord w jednej karcie naraz — szkice są współdzielone w tej samej bazie. Konflikt zachowuje szkic i wymaga otwarcia bieżącej wersji.

**Cofnij ostatnią operację** działa w bieżącej sesji na usunięciu/zmianie statusu, o ile późniejsza edycja nie zmieniła rekordu. Usunięcie trafia do kosza. Definitywne usunięcie jest potwierdzane i blokowane, jeśli inne rekordy nadal odwołują się do tego ID.

## Backup: jeden plik lub części

### Jeden JSON

**Ustawienia → Pełny backup → Jeden plik JSON → Pobierz kopię.** Zawiera aktywne rekordy, kosz, oryginalne pliki Base64, hashe, dziennik i szkice. Nie zawiera hasła ani konfiguracji blokady sesji.

Pojedynczy JSON ma limit 350 MiB oryginalnych załączników; Base64 i JSON dodatkowo obciążają pamięć. Dla większej bazy użyj kompletnego backupu w częściach.

### Duże archiwum

1. Wybierz **Pełny backup w częściach**.
2. Opcjonalnie zaznacz szyfrowanie.
3. Pobierz manifest i **każdą** część do jednego folderu.
4. Fragmenty oryginalnych plików mają do 16 MiB; rekordy i metadane są w manifeście.
5. Sprawdź komplet i kliknij **Potwierdzam zapis całego kompletu**.
6. Przy odtwarzaniu zaznacz manifest i wszystkie części jednocześnie.

Ten tryb nie ogranicza sumy załączników do 350 MiB. Nadal obowiązują limity pamięci przeglądarki, pojedynczego oryginału i miejsca na urządzeniu. Folder całej kopii można dodatkowo spakować systemowo do ZIP.

### Szyfrowanie

Szyfrowany eksport używa **AES-256-GCM**, **PBKDF2-SHA-256 (600 000 iteracji)**, losowego 16-bajtowego salt i 12-bajtowego IV na każdy szyfrowany plik. Hasło: minimum 12 znaków. Manifest i części także mogą być szyfrowane.

**Szyfrowany jest backup, nie IndexedDB.** Nie ma pełnego zaszyfrowanego vaultu lokalnej bazy. Hasło nie jest zapisywane; aplikacja nie potrafi go odzyskać.

„Ostatni backup” oznacza pełny eksport lub potwierdzenie zapisu kompletu części. Przeglądarka nie gwarantuje zachowania pobranego pliku — sprawdź folder pobierania. Przypomnienie domyślnie pojawia się po 7 dniach, z możliwością zmiany w Ustawieniach.

## Import i przywracanie

1. **Ustawienia → Wybierz plik do importu**.
2. Wybierz pojedynczy JSON albo manifest i wszystkie części jednej kopii.
3. Podaj hasło, jeśli kopia jest szyfrowana.
4. Kliknij **Sprawdź plik**. Walidacja obejmuje schemat, referencje, wymagane pola, pliki i SHA-256.
5. Przeczytaj podsumowanie i wybierz **Importuj sprawdzone dane**.
6. Import zapisuje wszystko jedną transakcją. Błąd wycofuje zapis.

Import **dodaje**, nie synchronizuje i nie zastępuje obecnej bazy. Kolizja ID tworzy nowy identyfikator i przepisuje odwołania w importowanym zestawie. Powtórzenie importu może tworzyć duplikaty. Pełne odtworzenie najłatwiej wykonać w pustym profilu/przeglądarce po zabezpieczeniu obecnych danych.

Eksport sprawy/rekordu dołącza zależności wskazane w odwołaniach, także spoza tej sprawy. Sprawdź zakres przed udostępnieniem. Preferencje w kopii są informacyjne; ustawienia bezpieczeństwa nie są importowane automatycznie.

Format własnych rekordów: [DATA_FORMAT.md](DATA_FORMAT.md). CSV i Markdown służą do analizy/czytania, a nie pełnego przywracania.

## Wyszukiwanie, notatki i graf

- Ctrl/Cmd+K: globalna wyszukiwarka, np. `"Anna Nowak" #wywiad`.
- Ctrl/Cmd+N: szybkie dodawanie. Ctrl/Cmd+S: zapis formularza. Esc: zamknięcie z zachowaniem szkicu.
- Worker indeksuje warianty nazw, transliteracje, aliasy i tekstowe pola. Listy mają po 50 rekordów na stronę.
- Filtry dat wyszukiwarki używają daty merytorycznej, publikacji albo utworzenia wpisu, gdy wcześniejszych brak. Timeline używa dat wydarzeń.
- Markdown: nagłówki, listy, tabele, cytaty, kod, linki oraz `[[Record:ID]]`, `[[Person:ID]]`, `[[Source:ID]]`, `[[Company:ID]]`. ID znajduje się na karcie rekordu.
- Surowy HTML jest tekstem; zewnętrzne obrazki nie są pobierane.
- Graf: przeciąganie węzłów/tła, zoom, inspektor źródła relacji, tekstowa lista dostępna z klawiatury.
- Graf renderuje 60/120/250 węzłów i do 700 krawędzi. Wyszukaj nazwę lub wybierz sprawę. Pozostałe dane pozostają w bazie.
- Jakość danych pokazuje do 250 braków/par na ekranie. Zawężaj sprawą. Podobne początki tytułów są wskazówką, nie dowodem tożsamości.

## Dork Builder i Search Log

Google, Yandex, Bing, Brave i DuckDuckGo. Generator tylko buduje tekst; sam nie wykonuje wyszukiwania. Skopiuj go, zapisz jako „Zaplanowane”, a po wykonaniu uzupełnij datę, wynik i status „Wykonane”.

Yandex używa m.in. `mime:`, `lang:` i `date:`. Ograniczenia języka/dat bez wiarygodnego operatora są opisane jako filtry do ręcznego ustawienia. Nie są dodawane fikcyjne operatory dat Bing/Brave/DuckDuckGo. Silniki mogą ignorować część operatorów lub rozszerzać wyniki.

## Aktualizacje

1. Wykonaj pełny backup przed wgraniem nowego kodu.
2. Zachowaj domenę i ścieżkę repozytorium.
3. Przy własnych zmianach zwiększ `RELEASE` w `sw.js`.
4. Nowy cache instaluje się w całości, a aktywacja czeka na decyzję.
5. Po komunikacie **Nowa wersja jest gotowa** wybierz **Zapisz i zaktualizuj**.
6. Nie czyść danych witryny dla samej aktualizacji — usuniesz także bazę. Użyj „Sprawdź aktualizację” i zamknij inne karty.

Schemat IndexedDB ma wersję 2; migracja z 1 dodaje szkice bez usuwania rekordów. Inna domena, protokół, profil lub ścieżka aplikacji oznaczają inną lokalną bazę; użyj backupu do przenoszenia.

## Bezpieczeństwo i granice

Brak backendu, kont, telemetrii, CDN i automatycznego wysyłania danych. Otwarcie zewnętrznego linku/archiwum przekazuje adres do tej usługi jako świadoma czynność użytkownika.

CORS i izolacja przeglądarki uniemożliwiają dowolny scraping i screenshot cudzej karty. Dodaj ręcznie URL, datę, notatkę i plik. Nie ma automatycznych ocen osób ani generowania oskarżeń.

Blokada hasłem chroni widok, nie dane na dysku. IndexedDB i szkice pozostają jawne. Włącz szyfrowanie urządzenia i zachowuj szyfrowane kopie. Tryb prywatny, czyszczenie witryny, odinstalowanie i limity pamięci mogą usunąć dane. Prośba o trwałą pamięć `navigator.storage.persist()` nie zastępuje backupu.

Repozytoria GitHub Pages użytkownika dzielą origin. Nazwy baz są oddzielone ścieżką, ale kod innej strony na tym samym originie może mieć dostęp do pamięci. Do wymagającej pracy używaj kontrolowanej domeny i osobnego profilu. Aplikacja nie jest systemem wieloosobowym ani certyfikowanym systemem dowodowym.

Testy nie są gwarancją wieloletniej niezawodności. Nie sprawdzano fizycznego iPhone'a/Safari/Androida. Zakres wykonanej weryfikacji opisuje [TEST_REPORT.md](TEST_REPORT.md).

## Pliki i opcjonalne narzędzia deweloperskie

```text
ShadowArchive-OSINT-PWA/
  index.html, manifest.webmanifest, sw.js, .nojekyll
  app.js, schema.js, db.js, ...         moduły aplikacji
  app.css, print.css                    style
  icon.svg, icon-192.png, ...           ikony
  ARCHITECTURE.md, DATA_FORMAT.md, ...  dokumentacja
  browser-tests.js, unit.test.mjs, ...  testy opcjonalne
  README.md, package.json               instrukcja i narzędzia opcjonalne
```

Wersja dostarczona jako ZIP jest celowo płaska: nie zawiera podfolderów. Wszystkie ścieżki aplikacji są względne do tego jednego folderu.

**Brak zależności runtime.** `fake-indexeddb` jest przypiętą zależnością testów Node; przeglądarka jej nie ładuje.

Podgląd lokalny bez instalowania pakietów:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Otwórz `http://localhost:8080/`. Alternatywnie, mając Node: `npm run dev`, potem `http://localhost:4173/`.

Testy przeglądarkowe: otwórz przez serwer `tests-index.html` i uruchom testy izolowanej bazy. i uruchom testy izolowanej bazy. Generują ponad 40 tys. rekordów w osobnej bazie o losowej nazwie. Nie zastępują archiwum; mogą chwilowo obciążyć urządzenie.

Opcjonalne pełne testy Node:

```sh
npm ci --ignore-scripts
npm test
```

Podstawowy zestaw bez instalowania zależności: `node --test unit.test.mjs`.

Kontrola offline na docelowym HTTPS: po załadowaniu odwiedź moduły, wyłącz sieć, przeładuj, dodaj notatkę, ponownie ją otwórz, przywróć sieć i wykonaj backup. Test aktualizacji wymaga opublikowania nowego `RELEASE`.

## Dokumentacja źródłowa

- [GitHub Pages — źródło publikacji](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pages — utworzenie strony](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [MDN — aktualizacja Service Workera](https://developer.mozilla.org/en-US/Web/API/ServiceWorkerRegistration/update)
- [Yandex — daty, języki i typy](https://yandex.com/support/search/en/query-language/search-operators)
- [Brave — operatory](https://search.brave.com/help/operators)
- [DuckDuckGo — składnia](https://duckduckgo.com/duckduckgo-help-pages/results/syntax)
