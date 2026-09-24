# Model i format wymiany

## Baza

IndexedDB `shadowarchive:<ścieżka-aplikacji>/`, wersja schematu 2, odseparowana również przez origin.

| Store | Klucz | Zawartość |
| --- | --- | --- |
| records | id | Rekordy wszystkich typów |
| blobs | id | Oryginały Blob i metadane |
| logs | id | Zwięzłe czynności automatyczne |
| drafts | id rekordu | Ostatni szkic formularza |
| settings | key | Ustawienia, data backupu, blokada |

Indeksy records: kind, caseIds (multiEntry), updatedAt, status. Indeksy logs: caseIds, recordId, sessionId. Rekord i log zapisują się atomowo; rewizja chroni przed cichym nadpisaniem.

Wspólne pola: id, kind, title, createdAt, updatedAt, revision, caseIds, tags, relatedIds, epistemic. deletedAt oznacza kosz. demo: true oznacza fikcyjne dane. importedOriginalId wskazuje pierwotne ID po kolizji importu. Typy i pola definiuje `schema.js`.

Referencje są tablicami ID, np. personIds, organizationIds, sourceIds. Relacje grafu są osobnymi rekordami relation, z dokładnie jednym ID fromIds i toIds. Nie są wyprowadzane automatycznie z innych referencji.

Daty kalendarzowe: YYYY-MM-DD. Daty z czasem w formularzach są prezentowane lokalnie, a zapisywane jako ISO UTC. Historyczne wydarzenie ma osobny czas i opis strefy czasowej.

## Minimalny pakiet rekordów do importu

Zapisz poniższy JSON jako plik. Import CSV nie jest obsługiwany.

```json
{
  "format": "shadowarchive",
  "formatVersion": 1,
  "appVersion": "1.0.0",
  "scope": "records",
  "records": [{
    "id": "example-note-001",
    "kind": "note",
    "title": "Notatka testowa",
    "content": "# Pytanie badawcze\n\nCo sprawdzić?",
    "createdAt": "2026-09-24T00:00:00.000Z",
    "updatedAt": "2026-09-24T00:00:00.000Z",
    "revision": 0,
    "caseIds": [],
    "relatedIds": [],
    "sourceIds": [],
    "tags": ["test"],
    "epistemic": "INFORMACJA NIEWERYFIKOWANA"
  }],
  "blobs": [],
  "logs": [],
  "drafts": []
}
```

Każde wskazane ID musi znajdować się w pakiecie lub istniejącej bazie. Przy kolizji import przepisuje identyfikatory importowanych kopii i wewnętrzne referencje. Nie scala na podstawie nazw.

## Załączniki

Rekord: blobId, fileName, fileSize, fileMime, sha256, fileAddedAt. Store blobs: id, name, size, mime, sha256, addedAt, data. W JSON data jest Base64. Metadane muszą się zgadzać. Import oblicza SHA-256 przed zapisem.

## Backup w częściach

Manifest: `shadowarchive-bundle`, formatVersion: 1, id kopii, parts i snapshot bez bajtów. Część: `shadowarchive-part`, ID kopii/części/pliku, indeks i Base64 fragmentu do 16 MiB. Import wymaga całego zestawu, sprawdza indeksy, rozmiary i hashe zrekonstruowanych oryginałów. Uszkodzenie lub brak części nie zmienia bazy.

## Szyfrowana koperta

`shadowarchive-encrypted`, version: 1, KDF PBKDF2-SHA256, 600000 iteracji, cipher AES-256-GCM, losowe salt/iv w Base64. AAD: `ShadowArchive:1`. data zawiera szyfrogram JSON z tagiem GCM. Parametry są walidowane; osłabiony KDF lub nieznana wersja są odrzucane.

## Migracje

Wersja 1 obejmowała rekordy, pliki, logi i ustawienia. Wersja 2 dodaje szkice bez usuwania dotychczasowych danych. Przyszłe migracje należy dopisać jawnie i przetestować odtworzenie backupu. Import obsługuje format kopii 1 i odrzuca nieznane wersje.
