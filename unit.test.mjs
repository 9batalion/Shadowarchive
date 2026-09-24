import test, {
  after
} from 'node:test';
import {
  channel
} from './db.js';
after(() => channel?.close());
import assert from 'node:assert/strict';
import {
  readFile
} from 'node:fs/promises';
import vm from 'node:vm';
import {
  webcrypto
} from 'node:crypto';
import {
  SCHEMA,
  EPI,
  newRecord,
  validateRecord,
  normal
} from './schema.js';
import {
  sha256,
  encrypt,
  decrypt,
  fileRecord
} from './crypto.js';
import {
  quality,
  duplicates,
  analytics
} from './quality.js';
import {
  demoRecords
} from './demo.js';
const make = (kind, title = 'Rekord') => ({
  ...newRecord(kind),
  title
});
test('All schema defaults and demo records pass validation', () => {
  for (const kind of Object.keys(SCHEMA)) {
    const r = make(kind);
    if (kind === 'relation') {
      r.fromIds = ['a'];
      r.toIds = ['b'];
    }
    assert.deepEqual(validateRecord(r), [], kind);
  }
  for (const r of demoRecords()) assert.deepEqual(validateRecord(r), [], r.title);
});
test('Epistemic invariants: hypothesis and claim never silently become facts', () => {
  const h = make('hypothesis');
  h.status = 'Potwierdzona';
  assert.equal(h.epistemic, EPI[2]);
  assert.deepEqual(validateRecord(h), []);
  h.epistemic = EPI[3];
  assert.ok(validateRecord(h).length);
  const f = make('finding');
  f.epistemic = EPI[3];
  assert.ok(validateRecord(f).length);
  f.sourceIds = ['source'];
  assert.deepEqual(validateRecord(f), []);
  const c = make('claim');
  c.epistemic = EPI[3];
  assert.ok(validateRecord(c).length);
});
test('Unsafe URL schemes and invalid relation structure rejected', () => {
  const r = make('source');
  r.url = 'javascript:alert(1)';
  assert.ok(validateRecord(r).some(e => e.includes('http')));
  const rel = make('relation');
  assert.ok(validateRecord(rel).length);
  rel.fromIds = ['a'];
  rel.toIds = ['a'];
  assert.ok(validateRecord(rel).length);
  rel.toIds = ['b'];
  rel.status = 'Zweryfikowane';
  assert.ok(validateRecord(rel).length);
  rel.sourceIds = ['s'];
  assert.deepEqual(validateRecord(rel), []);
});
test('SHA-256 matches published abc test vector; original bytes retained', async () => {
  const file = new File(['abc'], 'test.txt', {
    type: 'text/plain'
  });
  const b = await fileRecord(file);
  assert.equal(b.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await b.data.text(), 'abc');
  assert.equal(b.size, 3);
});
test('AES-GCM encrypted backup roundtrip, randomized parameters and rejection paths', async () => {
  const content = {
    text: 'Zażółć gęślą jaźń',
    records: [1, 2, 3]
  };
  const password = 'Test-only password 2026!';
  const a = await encrypt(content, password),
    b = await encrypt(content, password);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.data, b.data);
  assert.deepEqual(await decrypt(a, password), content);
  await assert.rejects(() => decrypt(a, 'wrong password'));
  const bytes = Buffer.from(a.data, 'base64');
  bytes[5] ^= 1;
  await assert.rejects(() => decrypt({
    ...a,
    data: bytes.toString('base64')
  }, password));
  await assert.rejects(() => decrypt({
    ...a,
    iterations: 1
  }, password));
  await assert.rejects(() => encrypt(content, 'short'));
});
test('Duplicate detection suggests normalized URLs, hashes and name variants', () => {
  const a = make('person', 'Anna Kowalska');
  a.variants = 'Kowalska Anna';
  const b = make('person', 'Kowalska Anna');
  const c = make('source', 'Źródło A');
  c.url = 'https://example.com/a?utm_source=test';
  const d = make('source', 'Źródło B');
  d.url = 'https://example.com/a';
  const result = duplicates([a, b, c, d]);
  assert.equal(result.total, 2);
});
test('Data quality measures documentation, never truth', () => {
  const s = make('source'),
    e = make('event'),
    p = make('person');
  const q = quality([s, e, p]);
  assert.equal(q.checks, 5);
  assert.equal(q.passed, 1);
  assert.equal(q.percent, 20);
  assert.ok(q.issues.some(i => i.label === 'Wydarzenie bez źródła'));
});
test('Worker indexes 40,100 records, variants, phrases, tags, scope and pagination', async () => {
  let receive, answers = [];
  const context = {
    Map,
    Set,
    Array,
    String,
    Number,
    Boolean,
    JSON,
    RegExp,
    self: {},
    postMessage: m => answers.push(m),
    normal
  };
  const source = (await readFile(new URL('./search-worker.js', import.meta.url), 'utf8')).replace(
    /^import[\s\S]*?;\n/, '');
  vm.runInNewContext(source, context);
  receive = data => context.self.onmessage({
    data
  });
  const records = Array.from({
    length: 40100
  }, (_, i) => ({
    id: 'r' + i,
    kind: i < 100 ? 'case' : 'source',
    title: 'Rekord ' + i,
    variants: i === 35000 ? 'Łódź alias transkrypcji' : '',
    tags: i % 2 ? ['media'] : ['archiwum'],
    caseIds: ['case1'],
    status: 'Nieweryfikowane',
    date: '2025-03-01',
    updatedAt: '2025-01-01',
    createdAt: '2025-01-01'
  }));
  const start = performance.now();
  receive({
    op: 'init',
    records
  });
  receive({
    op: 'search',
    requestId: 1,
    query: '"lodz alias" #archiwum',
    caseId: 'case1',
    limit: 50
  });
  const elapsed = performance.now() - start;
  assert.equal(answers.at(-1).total, 1);
  assert.equal(answers.at(-1).ids[0], 'r35000');
  receive({
    op: 'search',
    requestId: 2,
    query: '',
    kinds: ['source'],
    limit: 50,
    offset: 50
  });
  assert.equal(answers.at(-1).ids.length, 50);
  assert.equal(answers.at(-1).total, 40000);
  console.log('Worker init + search 40,100 records:', Math.round(elapsed), 'ms');
});
test('Manifest and service worker assets resolve at a repository subpath', async () => {
  const manifest = JSON.parse(await readFile(new URL('./manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  for (const i of manifest.icons) {
    assert.ok(i.src.startsWith('./'));
    await readFile(new URL('./' + i.src, import.meta.url));
  }
  const code = await readFile(new URL('./sw.js', import.meta.url), 'utf8');
  const events = {};
  const cacheMap = new Map();
  let fetched = [];
  const scope = 'https://example.test/repo/';
  const caches = {
    open: async name => {
      if (!cacheMap.has(name)) cacheMap.set(name, new Map());
      const c = cacheMap.get(name);
      return {
        addAll: async requests => {
          for (const r of requests) {
            const relative = new URL(r.url).pathname.replace('/repo/', '') || 'index.html';
            await readFile(new URL('./' + relative, import.meta.url));
            c.set(r.url, new Response('cached:' + relative));
          }
        },
        match: async request => {
          const key = typeof request === 'string' ? request : request.url || request.href;
          return c.get(key);
        }
      };
    },
    keys: async () => [...cacheMap.keys()],
    delete: async key => cacheMap.delete(key)
  };
  const ctx = {
    self: {
      registration: {
        scope
      },
      clients: {
        claim: async () => {}
      },
      addEventListener: (n, fn) => events[n] = fn,
      skipWaiting: () => {}
    },
    location: {
      origin: 'https://example.test'
    },
    URL,
    Request,
    Response,
    caches,
    fetch: async r => {
      fetched.push(r);
      throw new Error('offline');
    }
  };
  vm.runInNewContext(code, ctx);
  let pending;
  events.install({
    waitUntil: p => pending = p
  });
  await pending;
  events.activate({
    waitUntil: p => pending = p
  });
  await pending;
  events.fetch({
    request: new Request(scope + 'app.js'),
    respondWith: p => pending = p
  });
  assert.match(await (await pending).text(), /cached:app\.js/);
  assert.equal(fetched.length, 0);
  events.fetch({
    request: {
      method: 'GET',
      url: scope + 'a-route',
      mode: 'navigate'
    },
    respondWith: p => pending = p
  });
  assert.match(await (await pending).text(), /cached:index.html/);
  let intercepted = false;
  events.fetch({
    request: new Request('https://external.test/private'),
    respondWith: () => intercepted = true
  });
  assert.equal(intercepted, false);
  assert.ok([...cacheMap.keys()][0].includes(scope));
});
