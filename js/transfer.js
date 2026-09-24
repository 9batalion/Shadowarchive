import {
  uuid
} from './ids.js';
import * as db from './db.js';
import {
  SCHEMA,
  REF_KEYS,
  references,
  validateRecord,
  VERSION
} from './schema.js';
import {
  base64,
  unbase64,
  sha256,
  encrypt,
  decrypt
} from './crypto.js';
import {
  download
} from './ui.js';
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
/** Select a self-contained dependency closure without reading file bytes into memory. */
export async function snapshotForExport(caseId = '') {
  const snap = await db.snapshot();
  let selected = snap.records;
  const drafts = snap.drafts.filter(d => !caseId || d.id === caseId || d.record.caseIds?.includes(caseId));
  if (caseId) {
    const map = new Map(snap.records.map(r => [r.id, r]));
    const ids = new Set(snap.records.filter(r => r.id === caseId || r.caseIds?.includes(caseId)).map(r => r
      .id));
    for (const d of drafts)
      for (const id of references(d.record))
        if (map.has(id)) ids.add(id);
    const queue = [...ids];
    for (let i = 0; i < queue.length; i++)
      for (const id of references(map.get(queue[i]) || {}))
        if (!ids.has(id) && map.has(id)) {
          ids.add(id);
          queue.push(id);
        }
    selected = snap.records.filter(r => ids.has(r.id));
  }
  const ids = new Set(selected.map(r => r.id));
  const blobIds = new Set([...selected, ...drafts.map(d => d.record)].map(r => r.blobId).filter(Boolean));
  const rootIsCase = snap.records.find(r => r.id === caseId)?.kind === 'case';
  return {
    format: 'shadowarchive',
    formatVersion: 1,
    appVersion: VERSION,
    scope: caseId ? (rootIsCase ? 'case' : 'records') : 'full',
    rootCaseId: rootIsCase ? caseId : null,
    exportedAt: new Date().toISOString(),
    records: selected,
    blobs: snap.blobs.filter(b => blobIds.has(b.id)),
    logs: snap.logs.filter(l => !caseId || ids.has(l.recordId) || l.caseIds?.includes(caseId)),
    drafts,
    preferences: snap.settings.filter(s => ['theme', 'backupDays'].includes(s.key))
  };
}
export async function buildBackup(caseId = '', onProgress = () => {}) {
  const snap = await snapshotForExport(caseId);
  const total = snap.blobs.reduce((n, b) => n + b.size, 0);
  if (total > 350 * 1024 * 1024) throw new Error(
    'Pojedynczy JSON przekracza bezpieczny limit 350 MiB załączników. Wybierz pełny backup w częściach — obejmuje całą bazę.'
    );
  const blobs = [];
  for (let i = 0; i < snap.blobs.length; i++) {
    const b = snap.blobs[i];
    blobs.push({
      ...b,
      data: base64(await b.data.arrayBuffer())
    });
    onProgress(`Pakowanie plików: ${i+1}/${snap.blobs.length}`);
  }
  return {
    ...snap,
    blobs
  };
}
export async function exportBackup({
  caseId = '',
  password = '',
  onProgress
} = {}) {
  let data = await buildBackup(caseId, onProgress);
  if (password) data = await encrypt(data, password);
  download(new Blob([JSON.stringify(data)], {
    type: 'application/json'
  }), `ShadowArchive-${caseId?'sprawa':'backup'}-${stamp()}${password?'.encrypted':''}.json`);
  if (!caseId) await db.setting('lastBackup', new Date().toISOString());
  await db.addLog(password ? 'Eksport szyfrowany' : 'Eksport JSON', caseId ? await db.get(caseId) : null,
    'Pobrano plik; zapis na dysku potwierdza użytkownik.');
  return data;
}

function assertPlain(value, depth = 0) {
  if (depth > 35) throw new Error('Zbyt głęboka struktura JSON');
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Niedozwolony klucz JSON');
      assertPlain(value[key], depth + 1);
    }
  }
}
export async function validateBackup(data, onProgress = () => {}, {
  binaryBlobs = false
} = {}) {
  assertPlain(data);
  if (data?.format !== 'shadowarchive' || data.formatVersion !== 1 || !Array.isArray(data.records) || !Array
    .isArray(data.blobs || [])) throw new Error('Nieobsługiwany backup. Wymagany format ShadowArchive v1.');
  if (!Array.isArray(data.logs || []) || !Array.isArray(data.drafts || [])) throw new Error(
    'Niepoprawna lista dziennika lub szkiców');
  if (data.records.length > 200000) throw new Error('Import ma zbyt wiele rekordów (maks. 200 000).');
  const ids = new Set(),
    blobIds = new Set();
  for (const r of data.records) {
    const e = validateRecord(r);
    if (e.length) throw new Error(`${r.title||r.id}: ${e.join('; ')}`);
    if (ids.has(r.id)) throw new Error('Powtórzony ID w pliku: ' + r.id);
    ids.add(r.id);
  }
  const existing = new Set((await db.all()).map(r => r.id));
  for (const r of data.records)
    for (const id of references(r))
      if (!ids.has(id) && !existing.has(id)) throw new Error(
        `Brak rekordu wskazanego przez „${r.title}”: ${id}`);
  const blobs = [];
  for (const b of data.blobs || []) {
    if (!b || typeof b.id !== 'string' || typeof b.name !== 'string' || typeof b.mime !== 'string' || !(
        typeof b.data === 'string' || binaryBlobs && b.data instanceof Blob) || !Number.isInteger(b.size) ||
      b.size < 0 || b.size > 150 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(b.sha256)) throw new Error(
      'Niepoprawne metadane pliku');
    if (blobIds.has(b.id)) throw new Error('Powtórzony ID pliku');
    blobIds.add(b.id);
    const bytes = binaryBlobs && b.data instanceof Blob ? new Uint8Array(await b.data.arrayBuffer()) :
      unbase64(b.data);
    if (bytes.length !== b.size || await sha256(bytes) !== b.sha256) throw new Error(
      'Błąd integralności SHA-256: ' + b.name);
    blobs.push({
      ...b,
      data: new Blob([bytes], {
        type: b.mime
      })
    });
    onProgress(`Weryfikacja plików: ${blobs.length}/${data.blobs.length}`);
  }
  const bmap = new Map(blobs.map(b => [b.id, b]));
  for (const r of data.records) {
    if (r.blobId) {
      const b = bmap.get(r.blobId);
      if (!b || r.sha256 !== b.sha256 || r.fileSize !== b.size || r.fileName !== b.name || r.fileMime !== b
        .mime) throw new Error('Brak lub niespójny załącznik: ' + r.title);
    }
  }
  for (const l of data.logs || []) {
    if (!l || typeof l.id !== 'string' || typeof l.action !== 'string' || typeof l.date !== 'string' || !
      Array.isArray(l.caseIds) || l.caseIds.some(x => typeof x !== 'string')) throw new Error(
      'Niepoprawny wpis dziennika');
  }
  const draftIds = new Set();
  for (const d of data.drafts || []) {
    if (!d || typeof d.id !== 'string' || !d.record || d.id !== d.record.id || draftIds.has(d.id))
    throw new Error('Niepoprawny lub powtórzony szkic');
    draftIds.add(d.id);
    const errors = validateRecord(d.record, {
      strict: false,
      draft: true
    });
    if (errors.length) throw new Error('Niepoprawny szkic: ' + errors.join('; '));
    if (d.record.blobId && !bmap.has(d.record.blobId)) throw new Error('Brak pliku szkicu: ' + d.record
      .title);
  }
  return {
    ...data,
    blobs
  };
}
export async function parseImport(file, password = '', onProgress = () => {}) {
  if (file.size > 520 * 1024 * 1024) throw new Error('Plik importu przekracza 520 MiB.');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Plik nie jest poprawnym JSON.');
  }
  if (data.format === 'shadowarchive-encrypted') {
    if (!password) throw new Error('Podaj hasło szyfrowanego backupu.');
    data = await decrypt(data, password);
  }
  return validateBackup(data, onProgress);
}
export async function importBackup(validated) {
  const existing = new Set((await db.all()).map(r => r.id));
  const existingBlobs = new Set((await db.all('blobs')).map(b => b.id));
  const remap = new Map(),
    bmap = new Map();
  for (const r of validated.records) remap.set(r.id, existing.has(r.id) ? uuid() : r.id);
  for (const b of validated.blobs) bmap.set(b.id, existingBlobs.has(b.id) ? uuid() : b.id);
  const mapRecord = r => {
    const n = {
      ...r,
      id: remap.get(r.id) || r.id
    };
    if (n.id !== r.id) n.importedOriginalId = r.id;
    for (const key of REF_KEYS)
      if (Array.isArray(n[key])) n[key] = n[key].map(id => remap.get(id) || id);
    if (n.blobId) n.blobId = bmap.get(n.blobId) || n.blobId;
    return n;
  };
  const records = validated.records.map(mapRecord);
  const blobs = validated.blobs.map(b => ({
    ...b,
    id: bmap.get(b.id)
  }));
  const logs = (validated.logs || []).map(l => ({
    ...l,
    id: uuid(),
    recordId: remap.get(l.recordId) || l.recordId,
    sessionId: remap.get(l.sessionId) || l.sessionId,
    caseIds: (l.caseIds || []).map(id => remap.get(id) || id)
  }));
  const drafts = (validated.drafts || []).map(d => {
    let r = mapRecord(d.record);
    if (!remap.has(d.id)) r = {
      ...r,
      id: uuid(),
      revision: 0
    };
    return {
      ...d,
      id: r.id,
      record: r
    };
  });
  await db.importBatch({
    records,
    blobs,
    logs,
    drafts
  });
  return {
    count: records.length,
    remapped: [...remap].filter(([a, b]) => a !== b).length
  };
}
export function exportCSV(records) {
  const fields = ['id', 'kind', 'title', 'epistemic', 'confidence', 'status', 'caseIds', 'tags', 'url',
    'date', 'publicationDate', 'sourceIds', 'createdAt', 'updatedAt', 'sha256', 'record_json'
  ];
  const cell = v => {
    let s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const rows = [fields.join(',')];
  for (const r of records) rows.push(fields.map(f => cell(f === 'record_json' ? r : r[f] ?? '')).join(','));
  download(new Blob(['\uFEFF' + rows.join('\r\n')], {
    type: 'text/csv;charset=utf-8'
  }), `ShadowArchive-rekordy-${stamp()}.csv`);
}
export function exportMarkdown(records) {
  const lines = ['# ShadowArchive — eksport rekordów', '', `Data eksportu: ${new Date().toISOString()}`, ''];
  for (const r of records) {
    lines.push(`## ${r.title}`, `- ID: ${r.id}`, `- Typ: ${SCHEMA[r.kind].single}`,
      `- Kategoria: ${r.epistemic}`, '');
    for (const [key, value] of Object.entries(r))
      if (!['title', 'id', 'kind', 'epistemic'].includes(key) && value !== '' && value !== null && value !==
        undefined) lines.push(`**${key}**: ${Array.isArray(value)?value.join(', '):String(value)}`, '');
  }
  download(new Blob([lines.join('\n')], {
    type: 'text/markdown;charset=utf-8'
  }), `ShadowArchive-rekordy-${stamp()}.md`);
}
