/** Bounded-memory multi-file backups. Every 16 MiB slice is an explicit download. */
import {
  uuid
} from './ids.js';
import {
  snapshotForExport,
  validateBackup,
  parseImport
} from './transfer.js';
import {
  base64,
  unbase64,
  encrypt,
  decrypt
} from './crypto.js';
import {
  download
} from './ui.js';
const CHUNK = 16 * 1024 * 1024;
export async function createBundle(caseId = '') {
  const snapshot = await snapshotForExport(caseId),
    id = uuid();
  const parts = [];
  for (const file of snapshot.blobs) {
    const count = Math.max(1, Math.ceil(file.size / CHUNK));
    for (let i = 0; i < count; i++) parts.push({
      id: uuid(),
      blobId: file.id,
      index: i,
      count,
      offset: i * CHUNK,
      size: Math.min(CHUNK, Math.max(0, file.size - i * CHUNK)),
      fileName: file.name
    });
  }
  const manifest = {
    format: 'shadowarchive-bundle',
    formatVersion: 1,
    id,
    parts,
    snapshot: {
      ...snapshot,
      blobs: snapshot.blobs.map(({
        data,
        ...rest
      }) => rest)
    }
  };
  return {
    manifest,
    files: new Map(snapshot.blobs.map(b => [b.id, b]))
  };
}
export async function bundleManifestData(bundle, password = '') {
  return password ? encrypt(bundle.manifest, password) : bundle.manifest;
}
export async function downloadBundleManifest(bundle, password = '') {
  const data = await bundleManifestData(bundle, password);
  download(new Blob([JSON.stringify(data)], {
    type: 'application/json'
  }), `ShadowArchive-${bundle.manifest.id}-manifest${password?'.encrypted':''}.json`);
}
export async function bundlePartData(bundle, part, password = '') {
  const file = bundle.files.get(part.blobId),
    bytes = await file.data.slice(part.offset, part.offset + part.size).arrayBuffer();
  let data = {
    format: 'shadowarchive-part',
    formatVersion: 1,
    bundleId: bundle.manifest.id,
    id: part.id,
    blobId: part.blobId,
    index: part.index,
    data: base64(bytes)
  };
  if (password) data = await encrypt(data, password);
  return data;
}
export async function downloadBundlePart(bundle, part, password = '') {
  const data = await bundlePartData(bundle, part, password);
  download(new Blob([JSON.stringify(data)], {
    type: 'application/json'
  }), `ShadowArchive-${bundle.manifest.id}-part-${part.id}${password?'.encrypted':''}.json`);
}
async function readJSON(file, password) {
  if (file.size > 520 * 1024 * 1024) throw new Error('Zbyt duży plik importu.');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Niepoprawny JSON: ' + file.name);
  }
  return data.format === 'shadowarchive-encrypted' ? decrypt(data, password) : data;
}
export async function parseImportFiles(files, password = '', progress = () => {}) {
  const list = Array.from(files);
  if (list.length === 1) {
    const data = await readJSON(list[0], password);
    if (data.format === 'shadowarchive-bundle' && !data.parts?.length) return validateBackup({
      ...data.snapshot,
      blobs: []
    }, progress);
    return parseImport(list[0], password, progress);
  }
  // Read one part at a time and release its Base64 text before reading the next.
  let manifest = null;
  const chunks = new Map();
  let bundleId = null;
  for (let i = 0; i < list.length; i++) {
    const data = await readJSON(list[i], password);
    if (data.format === 'shadowarchive-bundle') {
      if (manifest) throw new Error('Wybrano więcej niż jeden manifest. Importuj jedną kopię naraz.');
      if (data.formatVersion !== 1 || typeof data.id !== 'string' || !Array.isArray(data.parts) || !data
        .snapshot) throw new Error('Niepoprawny manifest kopii.');
      manifest = data;
    } else if (data.format === 'shadowarchive-part') {
      if (data.formatVersion !== 1 || typeof data.id !== 'string' || typeof data.bundleId !== 'string' ||
        typeof data.blobId !== 'string' || !Number.isInteger(data.index) || typeof data.data !== 'string')
        throw new Error('Niepoprawna część kopii.');
      if (bundleId && bundleId !== data.bundleId) throw new Error('Części pochodzą z różnych kopii.');
      if (chunks.has(data.id)) throw new Error('Powtórzona część kopii.');
      bundleId = data.bundleId;
      const bytes = unbase64(data.data);
      if (bytes.length > CHUNK) throw new Error('Część przekracza 16 MiB.');
      chunks.set(data.id, {
        blobId: data.blobId,
        index: data.index,
        bytes: new Blob([bytes])
      });
    } else throw new Error('Wybierz manifest oraz wszystkie części tej samej kopii.');
    progress(`Odczyt części: ${i+1}/${list.length}`);
  }
  if (!manifest || manifest.id !== bundleId && manifest.parts.length) throw new Error(
    'Brakuje zgodnego manifestu.');
  if (chunks.size !== manifest.parts.length) throw new Error('Nie wybrano wszystkich części kopii.');
  const partIds = new Set();
  for (const p of manifest.parts) {
    const chunk = chunks.get(p.id);
    if (partIds.has(p.id) || !chunk || chunk.blobId !== p.blobId || chunk.index !== p.index || chunk.bytes
      .size !== p.size) throw new Error('Brak lub niezgodna część kopii.');
    partIds.add(p.id);
  }
  const blobs = [];
  for (const b of manifest.snapshot.blobs || []) {
    const parts = manifest.parts.filter(p => p.blobId === b.id).sort((a, b) => a.index - b.index);
    if (!parts.length || parts.some((p, i) => p.index !== i || p.count !== parts.length || p.offset !== i *
        CHUNK)) throw new Error('Niepoprawna kolejność części pliku.');
    blobs.push({
      ...b,
      data: new Blob(parts.map(p => chunks.get(p.id).bytes), {
        type: b.mime
      })
    });
  }
  return validateBackup({
    ...manifest.snapshot,
    blobs
  }, progress, {
    binaryBlobs: true
  });
}
