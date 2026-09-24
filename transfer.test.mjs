import test, {
  after
} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as db from './db.js';
import {
  newRecord,
  EPI
} from './schema.js';
import {
  fileRecord,
  sha256,
  encrypt,
  decrypt
} from './crypto.js';
import {
  buildBackup,
  validateBackup,
  importBackup,
  snapshotForExport
} from './transfer.js';
import {
  createBundle,
  bundleManifestData,
  bundlePartData,
  parseImportFiles
} from './multipart.js';
after(() => db.channel?.close());
const make = (kind, title, extra = {}) => ({
  ...newRecord(kind),
  title,
  ...extra
});
const jsonFile = (name, data) => new File([JSON.stringify(data)], name, {
  type: 'application/json'
});
await db.init({
  name: 'node-integrity-test'
});
let c, draft, doc;
test('Atomic save and encrypted full backup roundtrip with original file', async () => {
  c = await db.save(make('case', 'Case A'));
  const blob = await fileRecord(new File(['unaltered\noriginal\0bytes'], 'original.txt', {
    type: 'text/plain'
  }));
  doc = await db.save(make('document', 'Evidence', {
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
  const pack = await buildBackup();
  const encrypted = await encrypt(pack, 'Roundtrip long test password');
  const plain = await decrypt(encrypted, 'Roundtrip long test password');
  const validated = await validateBackup(plain);
  assert.equal(await validated.blobs[0].data.text(), 'unaltered\noriginal\0bytes');
  const result = await importBackup(validated);
  assert.equal(result.remapped, 2);
  const copied = (await db.all()).find(r => r.importedOriginalId === doc.id);
  assert.notEqual(copied.blobId, doc.blobId);
  assert.equal(await (await db.get(copied.blobId, 'blobs')).data.text(), 'unaltered\noriginal\0bytes');
});
test('Partial draft includes its original attachment in backup and import', async () => {
  const b = await fileRecord(new File(['draft screenshot'], 'draft.png', {
    type: 'image/png'
  }));
  draft = make('document', '', {
    caseIds: [c.id],
    blobId: b.id,
    fileName: b.name,
    fileSize: b.size,
    fileMime: b.mime,
    sha256: b.sha256,
    fileAddedAt: b.addedAt
  });
  await db.saveDraft(draft, b);
  const backup = await buildBackup(c.id);
  assert.ok(backup.drafts.some(d => d.id === draft.id));
  assert.ok(backup.blobs.some(file => file.id === b.id));
  const v = await validateBackup(backup);
  await importBackup(v);
  assert.ok((await db.all('drafts')).some(d => d.record.blobId !== b.id && d.record.title === ''));
});
test('Validation rejects missing files, changed bytes, unsafe records and invalid drafts', async () => {
  const backup = await buildBackup(c.id);
  let broken = structuredClone(backup);
  broken.blobs = [];
  await assert.rejects(() => validateBackup(broken));
  broken = structuredClone(backup);
  broken.blobs[0].data = 'YWJj';
  await assert.rejects(() => validateBackup(broken));
  broken = structuredClone(backup);
  broken.drafts[0].record.tags = 'invalid';
  await assert.rejects(() => validateBackup(broken));
  broken = structuredClone(backup);
  broken.records[0].relatedIds = ['missing'];
  await assert.rejects(() => validateBackup(broken));
  broken = JSON.parse(
    '{"format":"shadowarchive","formatVersion":1,"records":[],"__proto__":{"polluted":true}}');
  await assert.rejects(() => validateBackup(broken));
  assert.equal({}.polluted, undefined);
});
test('Import transaction rolls back all writes on a duplicate key', async () => {
  const count = (await db.all()).length;
  const fresh = make('case', 'Must roll back');
  await assert.rejects(() => db.importBatch({
    records: [fresh, {
      ...c
    }]
  }));
  assert.equal((await db.all()).length, count);
  assert.equal(await db.get(fresh.id), undefined);
});
test('Multipart backup reconstructs a file across 16 MiB boundaries; detects incomplete or corrupted sets',
  async () => {
    const bytes = new Uint8Array(17 * 1024 * 1024 + 37);
    for (let i = 0; i < bytes.length; i += 997) bytes[i] = i % 251;
    const b = await fileRecord(new File([bytes], 'boundary.bin', {
      type: 'application/octet-stream'
    }));
    const big = await db.save(make('document', 'Boundary file', {
      caseIds: [c.id],
      blobId: b.id,
      fileName: b.name,
      fileSize: b.size,
      fileMime: b.mime,
      sha256: b.sha256,
      fileAddedAt: b.addedAt
    }), {
      blob: b
    });
    const bundle = await createBundle(c.id);
    assert.equal(bundle.manifest.parts.filter(p => p.blobId === b.id).length, 2);
    const files = [jsonFile('manifest.json', await bundleManifestData(bundle))];
    for (const part of bundle.manifest.parts) files.push(jsonFile(part.id + '.json', await bundlePartData(
      bundle, part)));
    const valid = await parseImportFiles(files);
    assert.equal(valid.blobs.find(x => x.id === b.id).size, bytes.length);
    assert.equal(await sha256(await valid.blobs.find(x => x.id === b.id).data.arrayBuffer()), b.sha256);
    await assert.rejects(() => parseImportFiles(files.slice(0, -1)));
    const malformed = JSON.parse(await files.at(-1).text());
    malformed.index += 3;
    const wrong = [...files.slice(0, -1), jsonFile('bad.json', malformed)];
    await assert.rejects(() => parseImportFiles(wrong));
  });
test('Encrypted multipart files require the correct password and reconstruct unchanged content', async () => {
  const bundle = await createBundle(doc.id);
  const password = 'Multipart secure test password';
  const files = [jsonFile('manifest.enc.json', await bundleManifestData(bundle, password))];
  for (const part of bundle.manifest.parts) files.push(jsonFile(part.id + '.enc.json',
    await bundlePartData(bundle, part, password)));
  const valid = await parseImportFiles(files, password);
  assert.equal(await valid.blobs[0].data.text(), 'unaltered\noriginal\0bytes');
  await assert.rejects(() => parseImportFiles(files, 'wrong password'));
});
