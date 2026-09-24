import {
  normal
} from './schema.js';
const index = new Map();

function add(r) {
  index.set(r.id, {
    id: r.id,
    kind: r.kind,
    title: r.title,
    status: r.status || '',
    tags: r.tags || [],
    cases: r.caseIds || [],
    deleted: !!r.deletedAt,
    date: r.date || r.publicationDate || r.createdAt,
    updated: r.updatedAt,
    text: normal(Object.values(r).filter(v => typeof v === 'string' || Array.isArray(v)).flat().join(' '))
  });
}
self.onmessage = ({
  data: m
}) => {
  if (m.op === 'init') {
    index.clear();
    m.records.forEach(add);
    postMessage({
      ready: true
    });
    return;
  }
  if (m.op === 'put') {
    add(m.record);
    return;
  }
  if (m.op === 'remove') {
    index.delete(m.id);
    return;
  }
  if (m.op !== 'search') return;
  const words = (normal(m.query).match(/"[^"]+"|\S+/g) || []).map(w => w.replace(/^"|"$/g, ''));
  const out = [];
  for (const r of index.values()) {
    if (r.deleted !== !!m.trash) continue;
    if (m.kinds?.length && !m.kinds.includes(r.kind)) continue;
    if (m.caseId && r.id !== m.caseId && !r.cases.includes(m.caseId)) continue;
    if (m.status && r.status !== m.status) continue;
    if (m.from && r.date < m.from) continue;
    if (m.to && r.date.slice(0, 10) > m.to) continue;
    if (!words.every(w => w.startsWith('#') ? r.tags.some(t => normal(t) === w.slice(1)) : r.text.includes(
        w))) continue;
    out.push(r);
  }
  out.sort((a, b) => b.updated.localeCompare(a.updated));
  postMessage({
    requestId: m.requestId,
    total: out.length,
    ids: out.slice(m.offset || 0, (m.offset || 0) + (m.limit || 60)).map(r => r.id)
  });
};
