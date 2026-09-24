import {
  uuid
} from './ids.js';
import {
  validateRecord,
  references
} from './schema.js';
const DB_VERSION = 2;
// Each repository on a shared github.io origin gets its own database.
export const DB_NAME = 'shadowarchive:' + new URL('../', import.meta.url).pathname;
let db;
let activeSession = null;
export const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(DB_NAME) : null;
const req = q => new Promise((resolve, reject) => {
  q.onsuccess = () => resolve(q.result);
  q.onerror = () => reject(q.error);
});
const done = t => new Promise((resolve, reject) => {
  t.oncomplete = resolve;
  t.onabort = () => reject(t.error || new Error('Transakcja przerwana'));
  t.onerror = () => {};
});
export async function init({
  name = DB_NAME
} = {}) {
  db = await new Promise((resolve, reject) => {
    const q = indexedDB.open(name, DB_VERSION);
    q.onupgradeneeded = event => {
      const d = q.result;
      if (event.oldVersion < 1 || !d.objectStoreNames.contains('records')) {
        const r = d.createObjectStore('records', {
          keyPath: 'id'
        });
        r.createIndex('kind', 'kind');
        r.createIndex('caseIds', 'caseIds', {
          multiEntry: true
        });
        r.createIndex('updatedAt', 'updatedAt');
        r.createIndex('status', 'status');
        d.createObjectStore('blobs', {
          keyPath: 'id'
        });
        const l = d.createObjectStore('logs', {
          keyPath: 'id'
        });
        l.createIndex('caseIds', 'caseIds', {
          multiEntry: true
        });
        l.createIndex('recordId', 'recordId');
        l.createIndex('sessionId', 'sessionId');
        d.createObjectStore('settings', {
          keyPath: 'key'
        });
      }
      if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts', {
        keyPath: 'id'
      });
    };
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
    q.onblocked = () => window.dispatchEvent(new CustomEvent('db-blocked'));
  });
  db.onversionchange = () => {
    db.close();
    window.dispatchEvent(new CustomEvent('db-blocked'));
  };
  activeSession = (await setting('activeSession')) || null;
  return db;
}
export function setSession(id) {
  activeSession = id;
  return setting('activeSession', id);
}
export async function all(store = 'records') {
  return req(db.transaction(store).objectStore(store).getAll());
}
export async function get(id, store = 'records') {
  return req(db.transaction(store).objectStore(store).get(id));
}
export async function setting(key, value) {
  if (arguments.length === 1) return (await get(key, 'settings'))?.value;
  const t = db.transaction('settings', 'readwrite');
  const p = done(t);
  t.objectStore('settings').put({
    key,
    value
  });
  await p;
  return value;
}
export function makeLog(action, r, detail = '') {
  return {
    id: uuid(),
    recordId: r?.id || '',
    kind: r?.kind || '',
    title: r?.title || '',
    caseIds: r?.kind === 'case' ? [r.id] : (r?.caseIds || []),
    sessionId: activeSession,
    date: new Date().toISOString(),
    action,
    detail
  };
}
export async function addLog(action, r, detail = '') {
  const t = db.transaction('logs', 'readwrite');
  const p = done(t);
  t.objectStore('logs').put(makeLog(action, r, detail));
  await p;
}
export async function save(record, {
  blob = null,
  action
} = {}) {
  const errors = validateRecord(record);
  if (errors.length) throw new Error(errors.join('\n'));
  const t = db.transaction(['records', 'logs', 'blobs', 'drafts'], 'readwrite');
  const completed = done(t);
  const records = t.objectStore('records');
  let result, reason = '';
  const fail = message => {
    reason = message;
    t.abort();
  };
  const query = records.get(record.id);
  query.onsuccess = () => {
    const old = query.result;
    if ((old?.revision || 0) !== record.revision) {
      fail(
        'Rekord został zmieniony w innej karcie. Twój szkic zachowano. Zamknij formularz i otwórz aktualną wersję przed ponownym zapisem.'
      );
      return;
    }
    if (old?.blobId && old.blobId !== record.blobId) {
      fail('Oryginalny załącznik jest niezmienny. Dodaj inny plik jako nowy rekord.');
      return;
    }
    const write = () => {
      result = {
        ...record,
        revision: record.revision + 1,
        updatedAt: new Date().toISOString()
      };
      const fields = Object.keys(result).filter(k => !['revision', 'updatedAt'].includes(k) && JSON
        .stringify(old?.[k]) !== JSON.stringify(result[k]));
      let detail = fields.join(', ');
      if (old && record.kind === 'organization') {
        detail = fields.map(k =>
          `${k}: ${JSON.stringify(old[k] ?? '').slice(0,350)} → ${JSON.stringify(result[k] ?? '').slice(0,350)}`
        ).join('\n');
      }
      records.put(result);
      if (blob) t.objectStore('blobs').put(blob);
      t.objectStore('drafts').delete(record.id);
      t.objectStore('logs').put(makeLog(action || (old ? 'Edycja' : 'Utworzenie'), result, detail));
    };
    const ids = [...new Set(references(record))].filter(id => id !== record.id);
    let pending = ids.length;
    if (!pending) {
      write();
      return;
    }
    // Check references in the same transaction: concurrent deletion cannot create an orphan.
    for (const id of ids) {
      const ref = records.get(id);
      ref.onsuccess = () => {
        if (reason) return;
        if (!ref.result) {
          fail('Powiązany rekord nie istnieje: ' + id + '. Usuń lub popraw odwołanie.');
          return;
        }
        pending--;
        if (!pending) write();
      };
    }
  };
  try {
    await completed;
  } catch (e) {
    if (reason) throw new Error(reason);
    throw e;
  }
  channel?.postMessage({
    id: result.id
  });
  return result;
}
export async function trash(record) {
  return save({
    ...record,
    deletedAt: new Date().toISOString()
  }, {
    action: 'Przeniesienie do kosza'
  });
}
export async function restore(record) {
  const r = {
    ...record
  };
  delete r.deletedAt;
  return save(r, {
    action: 'Przywrócenie z kosza'
  });
}
export async function purge(id) {
  const t = db.transaction(['records', 'blobs', 'drafts', 'logs'], 'readwrite');
  const completed = done(t);
  let blocked = false,
    records = null,
    drafts = null;
  const check = () => {
    if (!records || !drafts) return;
    const target = records.find(r => r.id === id);
    if (!target?.deletedAt || records.some(r => r.id !== id && references(r).includes(id)) || drafts.some(
        d => d.id !== id && references(d.record).includes(id))) {
      blocked = true;
      t.abort();
      return;
    }
    t.objectStore('records').delete(id);
    t.objectStore('drafts').delete(id);
    if (target.blobId && !records.some(r => r.id !== id && r.blobId === target.blobId) && !drafts.some(
        d => d.id !== id && d.record.blobId === target.blobId)) t.objectStore('blobs').delete(target
      .blobId);
    t.objectStore('logs').put(makeLog('Usunięcie definitywne', target));
  };
  const rq = t.objectStore('records').getAll();
  const dq = t.objectStore('drafts').getAll();
  rq.onsuccess = () => {
    records = rq.result;
    check();
  };
  dq.onsuccess = () => {
    drafts = dq.result;
    check();
  };
  try {
    await completed;
  } catch (e) {
    if (blocked) throw new Error(
      'Rekord ma odwołania z innych kart lub szkiców (także w koszu). Usuń odwołania przed definitywnym usunięciem.'
      );
    throw e;
  }
  channel?.postMessage({
    id
  });
}
export async function saveDraft(record, blob = null) {
  const t = db.transaction(['drafts', 'blobs'], 'readwrite');
  const p = done(t);
  t.objectStore('drafts').put({
    id: record.id,
    record,
    at: new Date().toISOString()
  });
  if (blob) t.objectStore('blobs').put(blob);
  await p;
}
export async function deleteDraft(id) {
  const t = db.transaction('drafts', 'readwrite');
  const p = done(t);
  t.objectStore('drafts').delete(id);
  await p;
}
export async function snapshot() {
  const names = ['records', 'blobs', 'logs', 'drafts', 'settings'];
  const t = db.transaction(names);
  const p = done(t);
  const values = await Promise.all(names.map(n => req(t.objectStore(n).getAll())));
  await p;
  return Object.fromEntries(names.map((n, i) => [n, values[i]]));
}
/** Import always appends, never overwrites. Collision validation runs inside the transaction. */
export async function importBatch({
  records,
  blobs = [],
  logs = [],
  drafts = []
}, label = 'Import') {
  const t = db.transaction(['records', 'blobs', 'logs', 'drafts'], 'readwrite');
  const completed = done(t);
  for (const r of records) t.objectStore('records').add(r);
  for (const b of blobs) t.objectStore('blobs').add(b);
  for (const l of logs) t.objectStore('logs').add(l);
  for (const d of drafts) t.objectStore('drafts').add(d);
  const cases = records.filter(r => r.kind === 'case');
  for (const c of cases.length ? cases : [null]) t.objectStore('logs').put(makeLog(label, c,
    `${records.length} rekordów, ${blobs.length} plików`));
  await completed;
  channel?.postMessage({
    all: true
  });
}
export async function removeDemo() {
  const t = db.transaction(['records', 'blobs', 'drafts', 'logs'], 'readwrite');
  const p = done(t);
  const q = t.objectStore('records').getAll();
  let blocked = false;
  q.onsuccess = () => {
    const rows = q.result;
    const ids = new Set(rows.filter(r => r.demo).map(r => r.id));
    if (rows.some(r => !r.demo && references(r).some(id => ids.has(id)))) {
      blocked = true;
      t.abort();
      return;
    }
    for (const r of rows.filter(r => r.demo)) {
      t.objectStore('records').delete(r.id);
      t.objectStore('drafts').delete(r.id);
      if (r.blobId) t.objectStore('blobs').delete(r.blobId);
    }
    const l = t.objectStore('logs').openCursor();
    l.onsuccess = () => {
      const c = l.result;
      if (c) {
        if (ids.has(c.value.recordId)) c.delete();
        c.continue();
      }
    };
  };
  try {
    await p;
  } catch (e) {
    if (blocked) throw new Error('Twoje rekordy odwołują się do danych demo. Najpierw usuń te odwołania.');
    throw e;
  }
  channel?.postMessage({
    all: true
  });
}
