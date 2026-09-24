import {
  normal,
  references
} from './schema.js';
export function canonicalURL(s) {
  try {
    const u = new URL(s);
    u.hash = '';
    for (const k of [...u.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    return u.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}
export function quality(records, universe = records) {
  const active = records.filter(r => !r.deletedAt);
  const issues = [];
  let checks = 0,
    passed = 0;
  const present = new Set(universe.filter(r => !r.deletedAt).map(r => r.id));
  const check = (r, condition, label) => {
    checks++;
    if (condition) passed++;
    else issues.push({
      id: r.id,
      title: r.title,
      kind: r.kind,
      label
    });
  };
  for (const r of active) {
    if (references(r).some(id => !present.has(id))) issues.push({
      id: r.id,
      title: r.title,
      kind: r.kind,
      label: 'Odwołanie do brakującego rekordu lub rekordu w koszu'
    });
    if (r.kind === 'source') {
      check(r, !!r.publicationDate, 'Źródło bez daty publikacji');
      check(r, !!(r.archiveOrg || r.archiveToday || r.archiveUrl), 'Źródło bez archiwizacji');
      check(r, !r.deadLink, 'Ręcznie oznaczony martwy link');
    }
    if (r.kind === 'event') check(r, !!r.sourceIds?.length, 'Wydarzenie bez źródła');
    if (r.kind === 'hypothesis') check(r, !!(r.argumentsFor || r.argumentsAgainst),
    'Hipoteza bez argumentów');
    if (r.kind === 'relation') check(r, !!r.sourceIds?.length, 'Relacja bez źródła');
    if (['document', 'evidence'].includes(r.kind)) check(r, !!(r.sourceIds?.length || r.url || r.provenance),
      'Dokument bez pochodzenia');
    if (r.kind === 'person') check(r, !!(r.aliases || r.variants || r.transliterations || r.originalName || r
      .polishName || r.russianName || r.ukrainianName || r.englishName), 'Osoba bez wariantów nazw');
  }
  return {
    issues,
    checks,
    passed,
    percent: checks ? Math.round(passed / checks * 100) : null
  };
}
export function duplicates(records) {
  const buckets = new Map(),
    pairs = new Map();
  const add = (key, r, reason) => {
    if (!key) return;
    const group = buckets.get(key) || [];
    for (const other of group.slice(0, 10)) {
      if (other.id === r.id) continue;
      const pair = [r.id, other.id].sort();
      pairs.set(pair.join('|'), {
        a: pair[0],
        b: pair[1],
        reason
      });
    }
    if (group.length < 10) group.push(r);
    buckets.set(key, group);
  };
  for (const r of records.filter(r => !r.deletedAt)) {
    if (r.url) add('url:' + canonicalURL(r.url), r, 'Zbieżny URL (bez znaczników śledzących)');
    if (r.sha256) add('hash:' + r.sha256, r, 'Identyczny SHA-256');
    if (['person', 'organization'].includes(r.kind)) {
      for (const n of [r.title, r.fullName, r.originalName, r.aliases, r.variants, r.transliterations, r
          .previousNames, r.polishName, r.russianName, r.ukrainianName, r.englishName
        ].filter(Boolean).flatMap(x => x.split(/[,;\n]/))) {
        const key = normal(n).replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).sort().join(' ');
        if (key.length > 3) add(r.kind + ':' + key, r, 'Zbieżna nazwa lub wariant');
      }
    }
    const title = normal(r.title).replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
    if (title.length > 16) add('title:' + r.kind + ':' + title.slice(0, 28), r,
      'Podobny początek tytułu — porównaj ręcznie');
  }
  return {
    total: pairs.size,
    pairs: [...pairs.values()].slice(0, 250)
  };
}
export function analytics(records) {
  const active = records.filter(r => !r.deletedAt);
  const count = (key) => {
    const m = new Map();
    for (const r of active)
      for (const id of r[key] || []) m.set(id, (m.get(id) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 10);
  };
  const domains = new Map();
  for (const r of active.filter(r => r.kind === 'source')) {
    let d = r.domain;
    try {
      d ||= new URL(r.url).hostname;
    } catch {}
    if (d) domains.set(d, (domains.get(d) || 0) + 1);
  }
  const events = active.filter(r => r.kind === 'event' && r.date).sort((a, b) => a.date.localeCompare(b
  .date));
  const gaps = [];
  for (let i = 1; i < events.length; i++) {
    const days = Math.round((new Date(events[i].date) - new Date(events[i - 1].endDate || events[i - 1]
      .date)) / 86400000);
    if (days > 30) gaps.push({
      from: events[i - 1].date,
      to: events[i].date,
      days
    });
  }
  return {
    people: count('personIds'),
    organizations: count('organizationIds'),
    sources: count('sourceIds'),
    tags: count('tags'),
    domains: [...domains].sort((a, b) => b[1] - a[1]).slice(0, 10),
    gaps: gaps.sort((a, b) => b.days - a.days).slice(0, 15),
    pending: active.filter(r => r.kind === 'hypothesis' && !['Obalona', 'Nieweryfikowalna', 'Potwierdzona']
      .includes(r.status)),
    leads: active.filter(r => r.kind === 'lead' && !['Odrzucony', 'Zweryfikowany', 'Przeniesiony do sprawy']
      .includes(r.status)),
    contradictions: active.filter(r => r.kind === 'contradiction' && r.status !== 'Zweryfikowane')
  };
}
