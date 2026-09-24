import {
  uuid
} from './ids.js';
/** Declarative schema shared by the editor, validator and backup importer. */
export const VERSION = '1.0.0';
export const EPI = ['INFORMACJA NIEWERYFIKOWANA', 'TWIERDZENIE ŹRÓDŁA', 'HIPOTEZA', 'FAKT POTWIERDZONY',
  'WNIOSEK ANALITYCZNY'
];
export const CONF = ['NIEWERYFIKOWANE', 'PRAWDOPODOBNE', 'TWIERDZENIE ŹRÓDŁA', 'HIPOTEZA',
  'POTWIERDZONY FAKT', 'SPRZECZNE INFORMACJE', 'OBALONE'
];
export const PRIORITIES = ['Normalny', 'Wysoki', 'Pilny', 'Niski'];
export const YESNO = ['Nie ustalono', 'Tak', 'Nie', 'Częściowo'];
const f = (key, label, type = 'text', extra = {}) => ({
  key,
  label,
  type,
  ...extra
});
const area = (k, l) => f(k, l, 'textarea');
const ref = (k, l, kinds) => f(k, l, 'refs', {
  kinds
});
const sel = (k, l, options) => f(k, l, 'select', {
  options
});
const date = (k, l) => f(k, l, 'date');
const status = options => sel('status', 'Status', options);
const sources = () => ref('sourceIds', 'Źródła potwierdzające', ['source']);
const people = () => ref('personIds', 'Osoby', ['person']);
const orgs = () => ref('organizationIds', 'Organizacje', ['organization']);
const docs = () => ref('documentIds', 'Dokumenty / materiały', ['document', 'media', 'evidence']);
const verify = () => status(['Nieweryfikowane', 'W trakcie', 'Zweryfikowane', 'Sprzeczne', 'Obalone']);
export const SCHEMA = {
  case: {
    label: 'Sprawy',
    single: 'Sprawa',
    icon: 'folder',
    fields: [f('shortName', 'Krótka nazwa'), status(['Nowa', 'Rozpoznanie', 'Gromadzenie danych',
        'Weryfikacja', 'Analiza', 'Raportowanie', 'Zakończona', 'Archiwalna'
      ]), sel('priority', 'Priorytet', PRIORITIES), f('categories', 'Kategorie'), area('description',
        'Opis'), area('goal', 'Cel dochodzenia'), area('scope', 'Zakres'), area('limitations',
        'Ograniczenia'), area('questions', 'Główne pytania badawcze'), area('methodology', 'Metodologia'),
      area('findings', 'Ustalenia robocze — nieklasyfikowane'), area('conclusions',
        'Wnioski analityczne autora'), area('openQuestions', 'Otwarte kwestie'), f('pinned',
        'Przypnij sprawę', 'checkbox')
    ]
  },
  person: {
    label: 'Osoby',
    single: 'Osoba',
    icon: 'person',
    fields: [f('firstName', 'Imię'), f('lastName', 'Nazwisko'), f('originalName',
        'Imię i nazwisko oryginalne'), f('aliases', 'Aliasy'), f('nicknames', 'Pseudonimy'), f('variants',
        'Warianty pisowni'), f('transliterations', 'Transliteracje'), f('nameLanguages',
        'Języki nazwiska'), f('russianName', 'Wersja rosyjska'), f('ukrainianName', 'Wersja ukraińska'),
      f('polishName', 'Wersja polska'), f('englishName', 'Wersja angielska'), f('role', 'Rola'), f(
        'position', 'Stanowisko'), orgs(), f('locations', 'Lokalizacje publiczne'), f('activePeriod',
        'Okres aktywności'), area('description', 'Opis'), people(), ref('eventIds', 'Wydarzenia', [
        'event']), sources(), docs(), area('notes', 'Notatki')
    ]
  },
  organization: {
    label: 'Organizacje',
    single: 'Organizacja',
    icon: 'building',
    fields: [f('fullName', 'Pełna nazwa'), f('previousNames', 'Poprzednie nazwy'), f('organizationType',
        'Typ organizacji'), f('country', 'Kraj'), f('registryId', 'Identyfikator rejestrowy'), f('url',
        'Strona internetowa', 'url'), ref('domainIds', 'Domeny', ['domain']), date('founded',
        'Data powstania'), date('dissolved', 'Data likwidacji'), status(['Aktywna', 'Nie ustalono',
        'W likwidacji', 'Zlikwidowana'
      ]), ref('founderIds', 'Założyciele', ['person', 'organization']), ref('boardIds', 'Zarząd', [
        'person'
      ]), ref('beneficiaryIds', 'Beneficjenci', ['person', 'organization']), people(), orgs(), sources(),
      docs(), ref('eventIds', 'Wydarzenia', ['event']), area('notes', 'Notatki')
    ]
  },
  source: {
    label: 'Źródła',
    single: 'Źródło',
    icon: 'link',
    fields: [f('url', 'URL', 'url'), f('originalUrl', 'Oryginalny URL', 'url'), f('archiveOrg',
        'Archive.org URL', 'url'), f('archiveToday', 'Archive.today URL', 'url'), f('archiveUrl',
        'Inne archiwum', 'url'), f('author', 'Autor'), f('publisher', 'Wydawca'), f('domain', 'Domena'),
      date('publicationDate', 'Data publikacji'), date('eventDate', 'Data zdarzenia'), f('acquiredAt',
        'Data pozyskania', 'datetime-local'), f('language', 'Język'), sel('sourceType', 'Klasyfikacja', [
        'ŹRÓDŁO PIERWOTNE', 'ŹRÓDŁO WTÓRNE', 'AGREGATOR', 'MEDIA', 'SOCIAL MEDIA', 'DOKUMENT URZĘDOWY',
        'REJESTR', 'NAGRANIE', 'ARCHIWUM', 'BLOG / FORUM', 'INNE'
      ]), area('description', 'Opis'), area('quote', 'Cytat / fragment'), f('timestamp',
        'Timestamp nagrania'), people(), orgs(), verify(), sel('authenticity', 'Autentyczność materiału',
        ['Nie oceniono', 'Oryginał potwierdzony', 'Pochodzenie niepewne', 'Podejrzenie edycji',
          'Zweryfikowana kopia'
        ]), sel('authorIdentity', 'Tożsamość autora', ['Nie ustalono', 'Zidentyfikowany',
        'Częściowo ustalona', 'Pseudonim'
      ]), sel('proximity', 'Bliskość do wydarzenia', ['Nie ustalono', 'Bezpośredni świadek',
        'Relacja pośrednia', 'Komentarz'
      ]), sel('independence', 'Niezależność', ['Nie ustalono', 'Niezależne', 'Zależne',
        'Możliwy konflikt interesów'
      ]), sources(), ...['Źródło pierwotne', 'Autor był świadkiem', 'Materiał kompletny',
        'Znamy oryginał', 'Materiał edytowany', 'Istnieje wcześniejsza wersja',
        'Potwierdza inne niezależne źródło', 'Znamy datę', 'Znamy autora', 'Znamy miejsce',
        'Konflikt interesów'
      ].map((l, i) => sel('check' + i, l, YESNO)), f('deadLink', 'Link martwy — oznaczenie ręczne',
        'checkbox'), area('notes', 'Notatki / uzasadnienie oceny')
    ]
  },
  document: {
    label: 'Dokumenty',
    single: 'Dokument',
    icon: 'file',
    file: true,
    fields: [f('documentType', 'Typ dokumentu'), sources(), f('url', 'URL pochodzenia', 'url'), date('date',
        'Data dokumentu'), f('author', 'Autor'), f('institution', 'Instytucja'), f('documentNumber',
        'Numer dokumentu'), f('caseSignature', 'Sygnatura'), people(), orgs(), area('description',
      'Opis'), area('provenance', 'Pochodzenie pliku')
    ]
  },
  evidence: {
    label: 'Materiały / capture',
    single: 'Materiał',
    icon: 'camera',
    file: true,
    fields: [f('url', 'URL strony', 'url'), f('pageTitle', 'Tytuł strony'), f('acquiredAt',
        'Data pozyskania', 'datetime-local'), area('description', 'Opis'), area('notes', 'Notatka'),
      people(), orgs(), sources(), area('provenance', 'Pochodzenie / sposób pozyskania')
    ]
  },
  media: {
    label: 'Nagrania i obrazy',
    single: 'Medium',
    icon: 'play',
    file: true,
    fields: [sel('mediaType', 'Typ', ['video', 'audio', 'image']), f('url', 'URL', 'url'), f('platform',
      'Platforma'), f('uploader', 'Uploader'), date('publicationDate', 'DATA PUBLIKACJI'), date(
      'recordingDate', 'DATA POWSTANIA MATERIAŁU'), f('duration', 'Czas trwania'), f('timestamp',
      'Timestamp'), area('description', 'Opis'), area('transcript', 'Transkrypcja / notatka'), f(
      'originalUrl', 'Oryginał — URL', 'url'), f('copyUrl', 'Kopia — URL', 'url'), sel('authenticity',
      'Autentyczność', ['Nie oceniono', 'Oryginał potwierdzony', 'Pochodzenie niepewne',
        'Podejrzenie edycji', 'Zweryfikowana kopia'
      ]), people(), ref('eventIds', 'Wydarzenia', ['event']), sources()]
  },
  event: {
    label: 'Oś czasu',
    single: 'Wydarzenie',
    icon: 'clock',
    fields: [date('date', 'Data początku'), f('time', 'Czas', 'time'), date('endDate',
      'Data końca zakresu'), f('timezone', 'Strefa czasowa / uwaga o czasie'), f('category',
        'Kategoria wydarzenia'), area('description', 'Opis'), people(), orgs(), f('location',
        'Lokalizacja'), sources(), sel('confidence', 'Pewność informacji', CONF)
    ]
  },
  relation: {
    label: 'Relacje',
    single: 'Relacja',
    icon: 'graph',
    fields: [ref('fromIds', 'Od (jeden rekord)'), ref('toIds', 'Do (jeden rekord)'), f('relationType',
      'Typ relacji'), date('date', 'Data początku'), date('endDate', 'Data końca'), area('description',
      'Opis'), sources(), verify(), sel('confidence', 'Status informacji', CONF)]
  },
  hypothesis: {
    label: 'Hipotezy',
    single: 'Hipoteza',
    icon: 'bulb',
    fields: [area('content', 'Treść hipotezy'), status(['Nowa', 'W trakcie weryfikacji',
        'Częściowo potwierdzona', 'Potwierdzona', 'Osłabiona', 'Obalona', 'Nieweryfikowalna'
      ]), area('argumentsFor', 'Argumenty za'), area('argumentsAgainst', 'Argumenty przeciw'), sources(),
      docs(), area('missingInfo', 'Brakujące informacje'), area('alternatives',
        'Alternatywne wyjaśnienia'), area('nextSteps', 'Następne kroki')
    ]
  },
  contradiction: {
    label: 'Sprzeczności',
    single: 'Sprzeczność',
    icon: 'split',
    fields: [ref('sourceAIds', 'Źródło A', ['source']), area('claimA', 'Źródło A twierdzi'), ref(
      'sourceBIds', 'Źródło B', ['source']), area('claimB', 'Źródło B twierdzi'), area('differences',
      'Różnice'), verify(), area('conclusion', 'Wniosek użytkownika')]
  },
  lead: {
    label: 'Tropy',
    single: 'Trop',
    icon: 'compass',
    fields: [area('description', 'Opis'), f('origin', 'Pochodzenie tropu'), sources(), people(), orgs(), f(
      'url', 'URL', 'url'), sel('priority', 'Priorytet', PRIORITIES), status(['Nowy', 'Do sprawdzenia',
      'W trakcie', 'Zweryfikowany', 'Odrzucony', 'Przeniesiony do sprawy'
    ]), ref('taskIds', 'Zadania', ['task'])]
  },
  task: {
    label: 'Zadania',
    single: 'Zadanie',
    icon: 'check',
    fields: [area('description', 'Opis'), sel('priority', 'Priorytet', PRIORITIES), date('deadline',
      'Termin'), status(['Do wykonania', 'W trakcie', 'Wykonane', 'Anulowane']), ref('leadIds', 'Tropy',
      ['lead']), people(), orgs(), sources()]
  },
  note: {
    label: 'Notatki',
    single: 'Notatka',
    icon: 'note',
    fields: [area('content', 'Treść Markdown'), sources()]
  },
  claim: {
    label: 'Twierdzenia',
    single: 'Twierdzenie',
    icon: 'quote',
    fields: [area('content', 'Treść twierdzenia'), f('speaker', 'Kto wypowiedział'), people(), f('where',
      'Gdzie'), date('date', 'Kiedy'), sources(), status(['Nieweryfikowane', 'Częściowo potwierdzone',
      'Potwierdzone', 'Sprzeczne źródła', 'Obalone', 'Nie da się zweryfikować'
    ]), ref('supportIds', 'Dowody wspierające', ['source', 'document', 'media', 'evidence']), area(
      'supportNote', 'Argumenty wspierające'), ref('againstIds', 'Dowody przeciwne', ['source',
      'document', 'media', 'evidence'
    ]), area('againstNote', 'Argumenty przeciwne'), ref('claimIds', 'Powiązane twierdzenia', ['claim'])]
  },
  finding: {
    label: 'Ustalenia',
    single: 'Ustalenie',
    icon: 'flag',
    fields: [sel('epistemic', 'Kategoria informacji', EPI), sel('confidence', 'Status informacji', CONF),
      area('content', 'Treść ustalenia'), sources(), docs(), area('reasoning',
        'Uzasadnienie / metoda weryfikacji')
    ]
  },
  domain: {
    label: 'Domeny',
    single: 'Domena',
    icon: 'globe',
    fields: [f('domain', 'Nazwa domeny'), date('firstSeen', 'Pierwsze zauważenie'), f('registrar',
        'Rejestrator'), date('registrationDate', 'Data utworzenia'), date('expiryDate',
        'Data wygaśnięcia'), area('nameservers', 'Nameservery'), f('ip', 'IP'), f('asn', 'ASN'), orgs(),
      sources(), area('history', 'Informacje historyczne'), area('notes', 'Notatki / wklejony wynik')
    ]
  },
  website: {
    label: 'Strony WWW',
    single: 'Strona WWW',
    icon: 'globe',
    fields: [f('url', 'URL', 'url'), ref('domainIds', 'Domeny', ['domain']), area('description', 'Opis'),
      sources()
    ]
  },
  location: {
    label: 'Lokalizacje',
    single: 'Lokalizacja',
    icon: 'pin',
    fields: [f('country', 'Kraj'), f('location', 'Publiczna lokalizacja'), area('description', 'Opis'),
      sources()
    ]
  },
  profile: {
    label: 'Profile publiczne',
    single: 'Profil publiczny',
    icon: 'person',
    fields: [f('url', 'URL profilu', 'url'), f('platform', 'Platforma'), f('handle', 'Nazwa konta'),
    people(), orgs(), sources(), area('description', 'Opis')]
  },
  search: {
    label: 'Search Log',
    single: 'Zapytanie',
    icon: 'search',
    fields: [sel('engine', 'Silnik', ['Google', 'Yandex', 'Bing', 'Brave', 'DuckDuckGo']), area('query',
      'Zapytanie'), f('searchedAt', 'Data wykonania', 'datetime-local'), status(['Zaplanowane',
      'Wykonane', 'Do powtórzenia'
    ]), area('result', 'Wynik / notatka')]
  },
  activity: {
    label: 'Dziennik',
    single: 'Czynność',
    icon: 'list',
    fields: [f('dateTime', 'Data i czas', 'datetime-local'), area('content', 'Wykonane działanie'),
    sources()]
  },
  session: {
    label: 'Sesje OSINT',
    single: 'Sesja',
    icon: 'timer',
    fields: [f('startedAt', 'Czas rozpoczęcia', 'datetime-local'), f('endedAt', 'Czas zakończenia',
      'datetime-local'), status(['Trwa', 'Zakończona']), area('summary',
      'Podsumowanie / notatka końcowa')]
  }
};
export const REF_KEYS = [...new Set(['caseIds', 'relatedIds', ...Object.values(SCHEMA).flatMap(s => s.fields
  .filter(f => f.type === 'refs').map(f => f.key))])];
export function allFields(kind) {
  return [f('title', kind === 'person' ? 'Pełna nazwa' : 'Nazwa / tytuł'), ...(kind === 'case' ? [] : [ref(
      'caseIds', 'Sprawy', ['case'])]), ...SCHEMA[kind].fields, f('tags', 'Tagi (oddziel przecinkiem)'),
    ref('relatedIds', 'Inne powiązane rekordy')
  ];
}
export function newRecord(kind, caseId) {
  const now = new Date().toISOString();
  const r = {
    id: uuid(),
    kind,
    title: '',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    caseIds: caseId && kind !== 'case' ? [caseId] : [],
    tags: [],
    relatedIds: [],
    epistemic: kind === 'hypothesis' ? EPI[2] : kind === 'claim' ? EPI[1] : EPI[0]
  };
  for (const field of SCHEMA[kind].fields) {
    if (field.type === 'select') r[field.key] = field.options[0];
    if (field.type === 'refs') r[field.key] = [];
  }
  if (['source', 'evidence'].includes(kind)) r.acquiredAt = now;
  if (kind === 'source') r.sourceType = 'INNE';
  return r;
}
export function references(r) {
  return REF_KEYS.flatMap(k => Array.isArray(r[k]) ? r[k] : []).filter(Boolean);
}
export function validateRecord(r, {
  strict = true,
  draft = false
} = {}) {
  const errors = [];
  if (!r || typeof r !== 'object' || !SCHEMA[r.kind]) return ['Nieznany typ rekordu'];
  if (typeof r.id !== 'string' || !r.id || r.id.length > 200) errors.push('Niepoprawny ID');
  if (typeof r.title !== 'string' || (!draft && !r.title.trim())) errors.push('Wpisz nazwę / tytuł');
  if (r.title?.length > 1000) errors.push('Nazwa jest zbyt długa');
  for (const k of REF_KEYS) {
    if (r[k] !== undefined && (!Array.isArray(r[k]) || r[k].some(x => typeof x !== 'string'))) errors.push(
      'Niepoprawne odwołania: ' + k);
  }
  if (!Array.isArray(r.tags) || r.tags.some(t => typeof t !== 'string')) errors.push('Niepoprawne tagi');
  if (!Number.isInteger(r.revision) || r.revision < 0) errors.push('Niepoprawna rewizja');
  if (!r.createdAt || !r.updatedAt || !Number.isFinite(Date.parse(r.createdAt)) || !Number.isFinite(Date
      .parse(r.updatedAt))) errors.push('Niepoprawne daty rekordu');
  if (!EPI.includes(r.epistemic)) errors.push('Niepoprawna kategoria informacji');
  if (r.kind === 'hypothesis' && r.epistemic !== EPI[2]) errors.push('Hipoteza musi pozostać hipotezą');
  if (r.kind === 'claim' && r.epistemic !== EPI[1]) errors.push(
    'Twierdzenie musi pozostać twierdzeniem źródła');
  for (const field of allFields(r.kind)) {
    const v = r[field.key];
    if (v === undefined || v === '') continue;
    if (field.type === 'select' && !field.options.includes(v)) errors.push('Niepoprawna wartość: ' + field
      .label);
    if (['text', 'textarea', 'url', 'date', 'time', 'datetime-local'].includes(field.type) && field.key !==
      'tags' && typeof v !== 'string') errors.push('Niepoprawne pole: ' + field.label);
    if (field.type === 'checkbox' && typeof v !== 'boolean') errors.push('Niepoprawny przełącznik: ' + field
      .label);
    if (field.type === 'url' && v && !/^https?:\/\//i.test(v)) errors.push(field.label +
      ': wymagany adres http(s)');
  }
  if (strict && r.kind === 'relation' && ((r.fromIds?.length !== 1) || (r.toIds?.length !== 1))) errors.push(
    'Relacja wymaga jednego rekordu Od i jednego Do');
  if (strict && r.kind === 'relation' && r.fromIds?.[0] === r.toIds?.[0]) errors.push(
    'Wybierz dwa różne rekordy');
  if (!draft && r.epistemic === EPI[3] && !r.sourceIds?.length) errors.push(
    'Potwierdzony fakt wymaga wskazania źródła');
  if (strict && r.kind === 'relation' && r.status === 'Zweryfikowane' && !r.sourceIds?.length) errors.push(
    'Zweryfikowana relacja wymaga źródła');
  if (r.endDate && r.date && r.endDate < r.date) errors.push('Koniec zakresu nie może poprzedzać początku');
  return errors;
}
export const normal = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')
  .replace(/Ł/g, 'L').toLowerCase();
