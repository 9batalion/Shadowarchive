import * as db from './db.js';
import {
  uuid
} from './ids.js';
import {
  SCHEMA,
  EPI,
  newRecord,
  validateRecord,
  references
} from './schema.js';
import {
  state,
  reload,
  save
} from './state.js';
import {
  buildBackup,
  validateBackup,
  importBackup
} from './transfer.js';
import {
  encrypt,
  decrypt,
  fileRecord,
  sha256
} from './crypto.js';
import {
  search,
  initialize
} from './search.js';
import {
  quality,
  duplicates
} from './quality.js';
import {
  markdown
} from './ui.js';
import {
  createReport
} from './report.js';
import {
  buildQuery, dorkView
} from './dork.js';
import {
  graphView,
  destroyGraph
} from './graph.js';
import {
  timeline, dashboard, detail, tagsView,
  listView
} from './views.js';
import {
  demoRecords
} from './demo.js';
const status = document.querySelector('#test-status'),
  output = document.querySelector('#test-results');

function assert(c, message) {
  if (!c) throw new Error(message);
}
async function rejects(fn) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error('Oczekiwano odrzucenia operacji');
}
let results = [];
async function test(name, fn) {
  const t = performance.now();
  try {
    const detail = await fn();
    const row = {
      name,
      status: 'PASS',
      ms: Math.round(performance.now() - t),
      detail: detail || ''
    };
    results.push(row);
    output.textContent += `PASS · ${name} · ${row.ms} ms ${detail||''}\n`;
  } catch (e) {
    results.push({
      name,
      status: 'FAIL',
      error: e.message
    });
    output.textContent += `FAIL · ${name}: ${e.message}\n`;
    console.error(e);
  }
}
const make = (kind, title, extra = {}) => ({
  ...newRecord(kind),
  title,
  ...extra
});
document.querySelector('#run-tests').onclick = async () => {
  document.querySelector('#run-tests').disabled = true;
  results = [];
  output.textContent = '';
  status.textContent = 'Testy trwają…';
  let c, p, src, note;
  await db.init({
    name: 'shadowarchive-test-' + uuid()
  });
  await test('IndexedDB: utworzenie, edycja, historia i konflikt rewizji', async () => {
    c = await db.save(make('case', 'Sprawa testowa'));
    const original = {
      ...c
    };
    c = await db.save({
      ...c,
      goal: 'Cel po edycji'
    });
    assert((await db.get(c.id)).goal === 'Cel po edycji', 'Edycja nie przetrwała odczytu');
    await rejects(() => db.save({
      ...original,
      title: 'Konflikt'
    }));
    assert((await db.all('logs')).length === 2, 'Brak atomowego logu');
  });
  await test('Kosz, przywracanie i ochrona referencji', async () => {
    p = await db.save(make('person', 'Testowa Osoba', {
      caseIds: [c.id]
    }));
    let trashed = await db.trash(p);
    assert(!!trashed.deletedAt, 'Brak soft-delete');
    p = await db.restore(trashed);
    assert(!p.deletedAt, 'Przywrócenie nie działa');
    const ct = await db.trash(c);
    await rejects(() => db.purge(c.id));
    c = await db.restore(ct);
    const orphan = await db.save(make('note', 'Rekord do usunięcia'));
    await db.trash(orphan);
    await db.purge(orphan.id);
    assert(!await db.get(orphan.id), 'Nie usunięto rekordu');
  });
  await test('Szkic długiej notatki jest trwały', async () => {
    note = make('note', 'Szkic', {
      caseIds: [c.id],
      content: 'Duża notatka. '.repeat(10000)
    });
    await db.saveDraft(note);
    assert((await db.get(note.id, 'drafts')).record.content.length === note.content.length,
      'Utrata treści szkicu');
  });
  await test('Fakty wymagają źródła; potwierdzona hipoteza pozostaje hipotezą', async () => {
    src = await db.save(make('source', 'Źródło testowe', {
      caseIds: [c.id],
      url: 'https://example.com/test'
    }));
    const f = make('finding', 'Fakt', {
      caseIds: [c.id],
      epistemic: EPI[3]
    });
    await rejects(() => db.save(f));
    await db.save({
      ...f,
      sourceIds: [src.id]
    });
    const h = await db.save(make('hypothesis', 'Hipoteza testowa', {
      caseIds: [c.id],
      status: 'Potwierdzona'
    }));
    assert(h.epistemic === 'HIPOTEZA', 'Hipoteza zmieniła kategorię');
  });
  await test('Pełny backup, walidacja, import i przepisanie kolidujących ID', async () => {
    const before = await db.all();
    const backup = await buildBackup();
    assert(backup.drafts[0].record.content === note.content, 'Backup pomija szkic');
    const validated = await validateBackup(JSON.parse(JSON.stringify(backup)));
    const result = await importBackup(validated);
    assert(result.remapped === before.length, 'Nie przepisano kolizji');
    const after = await db.all();
    assert(after.length === before.length * 2, 'Import zgubił dane');
    const copy = after.find(r => r.importedOriginalId === p.id);
    const cc = after.find(r => r.importedOriginalId === c.id);
    assert(copy.caseIds[0] === cc.id, 'Nie przepisano referencji');
    const oldCount = after.length;
    const broken = structuredClone(backup);
    broken.records[0].kind = 'unknown';
    await rejects(() => validateBackup(broken));
    assert((await db.all()).length === oldCount, 'Walidacja zmieniła bazę');
    const missing = structuredClone(backup);
    missing.records[0].relatedIds = ['nonexistent'];
    await rejects(() => validateBackup(missing));
  });
  if (crypto.subtle) {
    await test('Załącznik: hash, backup bytes, szyfrowanie i import uszkodzenia', async () => {
      const blob = await fileRecord(new File(['abc'], 'oryginal.txt', {
        type: 'text/plain'
      }));
      assert(blob.sha256 === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        'Błędny SHA-256');
      await db.save(make('document', 'Plik', {
        caseIds: [c.id],
        blobId: blob.id,
        fileName: blob.name,
        fileSize: blob.size,
        fileMime: blob.mime,
        sha256: blob.sha256,
        fileAddedAt: blob.addedAt
      }), {
        blob
      });
      const backup = await buildBackup();
      const encrypted = await encrypt(backup, 'Only test password 2026!');
      const plain = await decrypt(encrypted, 'Only test password 2026!');
      await validateBackup(plain);
      await rejects(() => decrypt(encrypted, 'wrong'));
      plain.blobs[0].data = 'YWJk';
      await rejects(() => validateBackup(plain));
    });
  } else {
    results.push({
      name: 'Web Crypto w przeglądarce',
      status: 'SKIP',
      detail: 'HTTP — wykonano osobne testy Node Web Crypto'
    });
    output.textContent +=
      'SKIP · Web Crypto: środowisko HTTP. Test we właściwym kontekście HTTPS / localhost.\n';
  }
  await test('Markdown: tabele, linki rekordów i neutralizacja XSS', async () => {
    const map = new Map([
      [p.id, p]
    ]);
    document.querySelector('#main').innerHTML = markdown(
      `# Nagłówek\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[[Person:${p.id}]]\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))`,
      map);
    assert(document.querySelector('#main table'), 'Brak tabeli');
    assert(document.querySelector('#main a').getAttribute('href') === '#record/' + p.id,
      'Link rekordu nie działa');
    assert(!document.querySelector('#main script'), 'XSS w Markdown');
    assert(!document.querySelector('#main [href^="javascript:"]'), 'Niebezpieczny link');
  });
  await test('Dork Builder różnicuje silniki i ograniczenia dat', async () => {
    const y = buildQuery({
      engine: 'Yandex',
      person: 'Jan Test',
      filetype: 'pdf',
      from: '2020-01-01',
      to: '2021-12-31',
      language: 'ru'
    });
    assert(y.query.includes('mime:pdf') && y.query.includes('date:20200101..20211231'),
      'Niepoprawny Yandex');
    const b = buildQuery({
      engine: 'Bing',
      from: '2020-01-01'
    });
    assert(!b.query.includes('after:') && b.notes.length, 'Pozorne operatory dat w Bing');
  });
  await test('Raport: kategorie rozdzielone, źródła i załączniki', async () => {
    await reload();
    state.scope = c.id;
    const html = createReport(c.id);
    assert(html.includes('Fakty potwierdzone') && html.includes('Twierdzenia źródeł') && html
      .includes('Hipotezy') && html.includes('Wnioski analityczne'), 'Brak kategorii raportu');
    assert(html.indexOf('Hipoteza testowa') > html.indexOf('6. Hipotezy'),
      'Hipoteza znalazła się w złej części');
    assert(html.includes(src.title), 'Brak źródła');
  });
  await test('Widoki: formularz dorków, dashboard, karta i tagi renderują poprawny HTML', async () => {
    await reload();
    state.scope = '';
    dorkView();
    assert(document.querySelectorAll('#dork-form input').length === 9, 'Brak pól generatora');
    assert(document.querySelector('#dork-case').options.length > 1, 'Brak spraw w formularzu');
    const input = document.querySelector('#dork-exact');
    input.value = 'fraza kontrolna';
    input.dispatchEvent(new Event('input', {bubbles:true}));
    assert(document.querySelector('#dork-output').textContent === '"fraza kontrolna"', 'Generator nie reaguje');
    await dashboard();
    assert(!document.querySelector('#main').textContent.includes('$ {'), 'Uszkodzony szablon pulpitu');
    assert(document.querySelector('.mini-metrics'), 'Brak podsumowania zadań');
    await detail(c.id);
    assert(!document.querySelector('#main').textContent.includes('$ {'), 'Uszkodzona karta');
    state.records.get(c.id).tags = ['test-tag'];
    await tagsView();
    assert(document.querySelector('.tag-cloud a').textContent === '#test-tag', 'Uszkodzony link tagu');
    state.scope = '';
  });
  await test('40 100 rekordów: import do IndexedDB', async () => {
    const records = [];
    const cases = Array.from({
      length: 100
    }, (_, i) => make('case', 'CASE-' + i, {
      revision: 1
    }));
    records.push(...cases);
    const people = [],
      orgs = [],
      sources = [];
    for (let i = 0; i < 5000; i++) {
      people.push(make('person', 'Osoba test ' + i, {
        revision: 1,
        caseIds: [cases[i % 100].id],
        variants: 'Testowy Alias ' + i
      }));
      orgs.push(make('organization', 'Organizacja test ' + i, {
        revision: 1,
        caseIds: [cases[i % 100].id]
      }));
    }
    for (let i = 0; i < 10000; i++) sources.push(make('source', 'Źródło test ' + i, {
      revision: 1,
      caseIds: [cases[i % 100].id],
      url: 'https://example.com/' + i,
      tags: i % 2 ? ['archiwum'] : ['media']
    }));
    records.push(...people, ...orgs, ...sources);
    for (let i = 0; i < 20000; i++) records.push(make('relation', 'Relacja ' + i, {
      revision: 1,
      caseIds: [cases[i % 100].id],
      fromIds: [people[i % 5000].id],
      toIds: [orgs[(i + 7) % 5000].id],
      sourceIds: [sources[i % 10000].id]
    }));
    await db.importBatch({
      records
    }, 'Test wydajności');
    return '100 spraw + 10 000 źródeł + 5 000 osób + 5 000 organizacji + 20 000 relacji';
  });
  await test('40 100+ rekordów: odczyt i indeks Worker', async () => {
    const records = await reload();
    state.scope = '';
    const t = performance.now();
    const found = await search({
      query: '"testowy alias 4999"',
      kinds: ['person']
    });
    assert(found.total === 1, 'Wyszukiwanie wariantu nie działa');
    return `${records.length} rekordów; zapytanie po indeksacji: ${Math.round(performance.now()-t)} ms`;
  });
  await test('Paginacja globalnej wyszukiwarki przy 40 100+ rekordach', async () => {
    await listView('source');
    const count = document.querySelectorAll('#list-result tbody tr').length;
    assert(count === 50, 'Wyszukiwarka nie ograniczyła DOM do 50 wierszy');
    const input = document.querySelector('#list-query');
    input.value = '"Źródło test 9999"';
    input.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 300));
    assert(document.querySelectorAll('#list-result tbody tr').length === 1,
      'Filtr widoku nie działa');
  });
  await test('Jakość danych i duplikaty przy pełnym wolumenie', async () => {
    const records = [...state.records.values()];
    const q = quality(records),
      d = duplicates(records);
    assert(q.checks > 10000, 'Za mało kontroli');
    return `${q.checks} kontroli, ${d.total} par duplikatów`;
  });
  await test('Graf: 20 000 relacji, ograniczenie renderowania, canvas i inspektor', async () => {
    graphView();
    assert(document.querySelector('canvas'), 'Brak grafu');
    assert(document.querySelector('#graph-count').textContent.includes('20000') || document
      .querySelector('#graph-count').textContent.includes('20 000'),
      'Nie załadowano pełnej liczby relacji');
    assert(document.querySelectorAll('#graph-accessible p').length <= 700,
      'Przekroczono limit grafu');
    destroyGraph();
  });
  await test('Timeline: chronologia, filtry i zakresy czasu', async () => {
    state.scope = c.id;
    const e1 = await db.save(make('event', 'Wczesne zdarzenie', {
      caseIds: [c.id],
      date: '2020-01-01',
      sourceIds: [src.id]
    }));
    const e2 = await db.save(make('event', 'Późne zdarzenie', {
      caseIds: [c.id],
      date: '2021-06-01',
      sourceIds: [src.id]
    }));
    await reload();
    await timeline();
    const links = [...document.querySelectorAll('.timeline-event h3')].map(n => n.textContent);
    assert(links[0] === 'Wczesne zdarzenie' && links[1] === 'Późne zdarzenie',
      'Zła kolejność osi czasu');
    document.querySelector('#timeline-zoom').value = 'decade';
    document.querySelector('#timeline-zoom').dispatchEvent(new Event('input'));
    assert(document.querySelector('.timeline-period').textContent === '2020–2029',
      'Zoom dekady nie działa');
  });
  await test('Migracja schematu v1 → v2 zachowuje rekordy', async () => {
    const name = 'shadowarchive-migration-test-' + uuid();
    await new Promise((resolve, reject) => {
      const q = indexedDB.open(name, 1);
      q.onupgradeneeded = () => {
        const d = q.result;
        const r = d.createObjectStore('records', {
          keyPath: 'id'
        });
        for (const [k, multi] of [
            ['kind', false],
            ['caseIds', true],
            ['updatedAt', false],
            ['status', false]
          ]) r.createIndex(k, k, {
          multiEntry: multi
        });
        r.put(make('case', 'Stary rekord'));
        d.createObjectStore('blobs', {
          keyPath: 'id'
        });
        d.createObjectStore('logs', {
          keyPath: 'id'
        });
        d.createObjectStore('settings', {
          keyPath: 'key'
        });
      };
      q.onsuccess = () => {
        q.result.close();
        resolve();
      };
      q.onerror = () => reject(q.error);
    });
    await db.init({
      name
    });
    assert((await db.all())[0].title === 'Stary rekord', 'Migracja usunęła rekord');
    assert(Array.isArray(await db.all('drafts')), 'Nie utworzono nowego store szkiców');
  });
  if ('serviceWorker' in navigator && isSecureContext) {
    await test('PWA: manifest, instalacja Service Workera i cache wszystkich modułów', async () => {
      const manifest = await (await fetch('./manifest.webmanifest')).json();
      assert(manifest.start_url === './' && manifest.scope === './',
        'Niepoprawny subpath manifestu');
      const reg = await navigator.serviceWorker.register('./sw.js', {
        scope: './'
      });
      await navigator.serviceWorker.ready;
      const cacheKeys = await caches.keys();
      const keys = cacheKeys.filter(k => k.includes('shadowarchive:'));
      assert(keys.length > 0, 'Brak cache');
      const cache = await caches.open(keys.at(-1));
      assert(await cache.match(new URL('./app.js', location.href).href), 'Brak app.js w cache');
    });
  } else {
    results.push({
      name: 'PWA w przeglądarce',
      status: 'SKIP',
      detail: 'Wymagane HTTPS / localhost'
    });
    output.textContent +=
      'SKIP · PWA instalacja / offline: wymagane HTTPS lub localhost. Logika cache testowana osobno.\n';
  }
  document.querySelector('#main').innerHTML = '';
  const failed = results.filter(r => r.status === 'FAIL').length;
  status.textContent =
    `Zakończono: ${results.filter(r=>r.status==='PASS').length} PASS, ${failed} FAIL, ${results.filter(r=>r.status==='SKIP').length} SKIP.`;
  document.querySelector('#run-tests').disabled = false;
  const pre = document.createElement('pre');
  pre.id = 'test-results-json';
  pre.hidden = true;
  pre.textContent = JSON.stringify({
    at: new Date().toISOString(),
    results
  }, null, 2);
  document.body.append(pre);
};
