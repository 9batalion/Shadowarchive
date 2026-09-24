import {
  newRecord,
  EPI
} from './schema.js';
import * as db from './db.js';
export function demoRecords() {
  const make = (kind, title, fields = {}) => ({
    ...newRecord(kind),
    title,
    demo: true,
    revision: 1,
    ...fields
  });
  const c = make('case', 'Projekt Latarnia — infrastruktura miejska', {
    shortName: 'LATARNIA',
    status: 'Gromadzenie danych',
    priority: 'Normalny',
    pinned: true,
    description: 'Fikcyjny research dotyczący modernizacji oświetlenia w mieście Brzegowo.',
    goal: 'Odtworzenie publicznej chronologii decyzji i wykonania projektu.',
    scope: 'Przetarg, wykonawca i publiczne komunikaty z 2025 roku.',
    questions: 'Kiedy podjęto decyzję?\nCzy komunikaty podają spójny termin realizacji?',
    limitations: 'Dane demonstracyjne. Wszystkie osoby, organizacje i dokumenty są fikcyjne.',
    methodology: 'Porównanie rejestru, komunikatów i dokumentów; oddzielenie twierdzeń od ustaleń.',
    tags: ['demo', 'infrastruktura']
  });
  const base = {
    caseIds: [c.id]
  };
  const org = make('organization', 'Lumen Studio sp. z o.o.', {
    ...base,
    fullName: 'Lumen Studio spółka z ograniczoną odpowiedzialnością',
    country: 'Polska',
    organizationType: 'Spółka',
    registryId: 'DEMO-KRS-001',
    status: 'Aktywna',
    founded: '2020-04-03',
    tags: ['demo', 'firma'],
    notes: 'Fikcyjny podmiot użyty wyłącznie w przykładzie.'
  });
  const p = make('person', 'Anna Nowak', {
    ...base,
    firstName: 'Anna',
    lastName: 'Nowak',
    originalName: 'Anna Nowak',
    variants: 'A. Nowak',
    role: 'Rzeczniczka projektu',
    organizationIds: [org.id],
    description: 'Postać fikcyjna.',
    tags: ['demo']
  });
  const s1 = make('source', 'Komunikat o rozpoczęciu projektu Latarnia', {
    ...base,
    url: 'https://example.com/latarnia/start',
    author: 'Biuro Projektu Latarnia',
    publisher: 'Urząd Miasta Brzegowo (fikcyjny)',
    publicationDate: '2025-03-12',
    eventDate: '2025-03-10',
    sourceType: 'ŹRÓDŁO PIERWOTNE',
    status: 'W trakcie',
    quote: 'Prace rozpoczną się w czerwcu 2025 r.',
    personIds: [p.id],
    organizationIds: [org.id],
    description: 'Przykładowy komunikat prasowy; adres example.com jest demonstracyjny.',
    tags: ['demo', 'komunikat']
  });
  const s2 = make('source', 'Protokół posiedzenia zespołu — maj 2025', {
    ...base,
    url: 'https://example.com/latarnia/protokol',
    publicationDate: '2025-05-20',
    eventDate: '2025-05-19',
    author: 'Sekretariat zespołu',
    sourceType: 'DOKUMENT URZĘDOWY',
    status: 'Nieweryfikowane',
    quote: 'Przewidywany start prac: lipiec 2025.',
    organizationIds: [org.id],
    tags: ['demo', 'dokument']
  });
  const e1 = make('event', 'Ogłoszenie projektu', {
    ...base,
    date: '2025-03-10',
    category: 'Komunikacja',
    description: 'Ogłoszono plan modernizacji oświetlenia.',
    sourceIds: [s1.id],
    personIds: [p.id],
    organizationIds: [org.id],
    confidence: 'TWIERDZENIE ŹRÓDŁA'
  });
  const e2 = make('event', 'Posiedzenie zespołu projektowego', {
    ...base,
    date: '2025-05-19',
    category: 'Decyzje',
    description: 'W protokole wskazano inny przewidywany termin rozpoczęcia.',
    sourceIds: [s2.id],
    organizationIds: [org.id],
    confidence: 'TWIERDZENIE ŹRÓDŁA'
  });
  const rel = make('relation', 'Anna Nowak — rzeczniczka projektu Lumen', {
    ...base,
    fromIds: [p.id],
    toIds: [org.id],
    relationType: 'reprezentowała',
    sourceIds: [s1.id],
    date: '2025-03-12',
    status: 'W trakcie',
    description: 'Relacja wpisana ręcznie na podstawie komunikatu.'
  });
  const h = make('hypothesis', 'Termin rozpoczęcia prac uległ przesunięciu', {
    ...base,
    status: 'W trakcie weryfikacji',
    content: 'Zmiana daty w dokumentach może oznaczać przesunięcie harmonogramu.',
    argumentsFor: 'Komunikat wskazuje czerwiec, protokół wskazuje lipiec.',
    argumentsAgainst: 'Dokumenty mogą dotyczyć różnych etapów.',
    alternatives: 'Różnica między pracami przygotowawczymi i montażem.',
    missingInfo: 'Zatwierdzony harmonogram oraz aneks.',
    nextSteps: 'Porównać zakres obu dokumentów.',
    sourceIds: [s1.id, s2.id],
    tags: ['demo', 'terminy']
  });
  const lead = make('lead', 'Odszukać harmonogram stanowiący załącznik', {
    ...base,
    description: 'Protokół odwołuje się do załącznika, którego nie ma w materiale.',
    origin: 'Analiza protokołu',
    sourceIds: [s2.id],
    priority: 'Wysoki',
    status: 'Do sprawdzenia',
    tags: ['demo']
  });
  const task = make('task', 'Porównać daty w dwóch komunikatach', {
    ...base,
    deadline: new Date().toISOString().slice(0, 10),
    status: 'Do wykonania',
    priority: 'Wysoki',
    leadIds: [lead.id],
    sourceIds: [s1.id, s2.id]
  });
  const claim = make('claim', 'Prace rozpoczną się w czerwcu 2025', {
    ...base,
    speaker: 'Biuro Projektu Latarnia',
    date: '2025-03-12',
    content: 'Zapowiedziano rozpoczęcie prac w czerwcu.',
    sourceIds: [s1.id],
    againstIds: [s2.id],
    status: 'Sprzeczne źródła'
  });
  const contradiction = make('contradiction', 'Czerwiec czy lipiec — termin rozpoczęcia', {
    ...base,
    sourceAIds: [s1.id],
    sourceBIds: [s2.id],
    claimA: 'Start w czerwcu 2025.',
    claimB: 'Start w lipcu 2025.',
    differences: 'Rozbieżny miesiąc rozpoczęcia; nie znamy zakresu etapów.',
    status: 'W trakcie'
  });
  const note = make('note', 'Plan weryfikacji i notatki robocze', {
    ...base,
    content: `# Projekt Latarnia\n\n## Pytania badawcze\n- Ustalić wersję harmonogramu.\n- Porównać zakres komunikatów.\n\n> Różnica dat nie przesądza o przyczynie.\n\n| Materiał | Co sprawdzić |\n| --- | --- |\n| Komunikat | Zakres zapowiedzi |\n| Protokół | Załączniki |\n\nŹródło: [[Source:${s1.id}]]\n\nOsoba: [[Person:${p.id}]]`,
    sourceIds: [s1.id, s2.id],
    tags: ['demo', 'plan']
  });
  const finding = make('finding', 'Dokumenty wskazują różne terminy', {
    ...base,
    epistemic: EPI[4],
    content: 'W analizowanych materiałach występują dwie daty planowanego rozpoczęcia. Przyczyna różnicy pozostaje nieustalona.',
    sourceIds: [s1.id, s2.id],
    confidence: 'SPRZECZNE INFORMACJE',
    reasoning: 'Porównanie przytoczonych fragmentów.'
  });
  return [c, org, p, s1, s2, e1, e2, rel, h, lead, task, claim, contradiction, note, finding];
}
export async function addDemo() {
  const existing = await db.all();
  if (existing.some(r => r.demo)) throw new Error(
    'Dane demo już istnieją. Usuń je w Ustawieniach przed ponownym dodaniem.');
  const records = demoRecords();
  await db.importBatch({
    records
  }, 'Dodanie danych demo');
  return records;
}
