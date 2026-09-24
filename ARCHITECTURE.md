# ShadowArchive — architektura 1.0

## Model i niezmienniki

IndexedDB jest izolowana nazwą zawierającą ścieżkę aplikacji. `records` przechowuje rekordy identyfikowane UUID, typ (`kind`), tytuł, daty ISO, rewizję, `caseIds`, tagi i pola właściwe typowi. Indeksy: kind, caseIds (multiEntry), updatedAt, status. Wspólne `relatedIds` i nazwane tablice referencji tworzą nawigację między kartami. Osobne relacje są wyłącznie świadomie tworzonymi przez użytkownika krawędziami; graf nigdy nie wyprowadza relacji ze współwystępowania.

`epistemic` oznacza kategorię: fakt, twierdzenie źródła, hipoteza, informacja nieweryfikowana, wniosek analityczny. `confidence` i status procesu są osobnymi polami. Hipotezy zawsze pozostają w swojej kategorii, także gdy zmieni się ich status. Fakt wymaga wskazania źródła i ręcznej decyzji. Nie obliczamy prawdopodobieństwa prawdy.

`blobs`: niezmienione pliki, UUID, nazwa, MIME, rozmiar, SHA-256. `logs`: zwięzłe zdarzenia i nazwy zmienionych pól (dla organizacji również ograniczone długością stare/nowe wartości); nie jest to nieusuwalny dziennik dowodowy. `drafts`: awaryjne szkice formularzy. `settings`: ustawienia, termin backupu, parametry blokady. Wersja bazy 2 dodaje szkice, zachowując dane wersji 1.

Zapisy danych i odpowiadających im logów są atomowe. Sprawdzenie rewizji w transakcji uniemożliwia ciche nadpisanie rekordu edytowanego w drugiej karcie. BroadcastChannel sygnalizuje zmiany. Kosz jest soft-delete; twarde usunięcie sprawdza odwołania. Import działa atomowo po walidacji wszystkich rekordów, referencji, plików i hashy. Kolizje ID nie są nadpisywane: importowany zestaw dostaje nowe UUID wraz z przepisaniem odwołań.

## Warstwy

- `schema.js`: definicje pól, statusów, kategorii i walidacja.
- `db.js`: IndexedDB, migracja, transakcje, log, kosz, rewizje.
- `search-worker.js`: indeks tekstu, wyszukiwanie poza głównym wątkiem.
- `crypto.js`, `transfer.js`, `multipart.js`: SHA-256, AES-GCM, PBKDF2, backup i import.
- `ui.js`, `editor.js`: bezpieczne renderowanie, Markdown bez HTML, formularze, szkice, referencje.
- `views.js`, `graph.js`, `report.js`: powierzchnie pracy i analiza.
- `app.js`, `pwa.js`: nawigacja, sesje, aktualizacje i instalacja.

## Workflow

Utwórz sprawę i określ pytania → rozpocznij sesję → dodawaj źródła i oryginalne pliki → zapisuj twierdzenia oraz ustalenia ze wskazaniem pochodzenia → ręcznie twórz relacje i zdarzenia → weryfikuj hipotezy i sprzeczności → sprawdź jakość danych → przygotuj raport → zakończ sesję → zapisz backup.

## Layout

Stały granatowy sidebar, jasne tło robocze, niebieski akcent. Nagłówek z globalnym wyszukiwaniem, wyborem sprawy i Quick Add. Dashboard jest pulpitem pracy, nie stroną reklamową. Na telefonie wysuwana nawigacja, jednokolumnowe formularze i przyklejony pasek zapisu. Ciemny motyw używa tych samych semantycznych kolorów kategorii i czytelnych etykiet.

## Granice

Brak backendu, telemetrii, pobierania obcych stron i automatycznych ocen. Cache przechowuje wyłącznie własne zasoby aplikacji. Szyfrowanie dotyczy backupu, nie lokalnej bazy. Blokada sesji chroni tylko widok. Oryginalne dane nie są wysyłane na GitHub. Gwarancja trwałości wymaga regularnych kopii poza przeglądarką. Widoki są stronicowane, graf ogranicza renderowanie do wybranego otoczenia; pełne dane pozostają w bazie.
