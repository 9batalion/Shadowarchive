import {
  SCHEMA,
  EPI,
  references
} from './schema.js';
import {
  state,
  rows
} from './state.js';
import * as db from './db.js';
import {
  $,
  escape,
  fmtDate,
  badge,
  heading,
  empty,
  safeURL,
  download,
  bytes
} from './ui.js';
import {
  caseTabs
} from './views.js';

function section(title, body) {
  return `<section><h2>${title}</h2>${body||'<p>Brak wpisów w zgromadzonym materiale.</p>'}</section>`;
}
export function createReport(caseId) {
  const c = state.records.get(caseId);
  if (!c || c.kind !== 'case') throw new Error('Wybierz sprawę do raportu');
  const records = Array.from(state.records.values()).filter(r => !r.deletedAt && r.caseIds?.includes(caseId));
  const ids = new Set(records.flatMap(r => references(r)));
  const sourceList = Array.from(state.records.values()).filter(r => r.kind === 'source' && !r.deletedAt && (r
    .caseIds?.includes(caseId) || ids.has(r.id)));
  const sourceLabels = new Map(sourceList.map((r, i) => [r.id, 'S' + String(i + 1).padStart(3, '0')]));
  const citations = r => (r.sourceIds || []).map(id => sourceLabels.has(id) ?
    `<a href="#src-${escape(id)}">[${sourceLabels.get(id)}]</a>` : '[Źródło poza raportem]').join(' ');
  const get = kind => records.filter(r => r.kind === kind);
  const info = (list) => list.length ? '<ul>' + list.map(r =>
    `<li><strong>${escape(r.title)}</strong>${r.content?`<p>${escape(r.content)}</p>`:''}${r.reasoning?`<p>Uzasadnienie: ${escape(r.reasoning)}</p>`:''}${citations(r)} ${r.confidence?badge(r.confidence):''}<small> · ID ${escape(r.id)}</small></li>`
    ).join('') + '</ul>' : '';
  const attachmentList = records.filter(r => ['document', 'evidence', 'media'].includes(r.kind));
  const entities = kind => get(kind).map(r =>
    `<li><strong>${escape(r.title)}</strong>${r.role?' — '+escape(r.role):''}${r.registryId?' · '+escape(r.registryId):''}${r.description?`<p>${escape(r.description)}</p>`:''} ${citations(r)}</li>`
    ).join('');
  const timeline = get('event').sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).map(r =>
    `<li><strong>${fmtDate(r.date)}${r.endDate?' — '+fmtDate(r.endDate):''}${r.time?' · '+escape(r.time):''} · ${escape(r.title)}</strong><p>${escape(r.description||'')}</p>${badge(r.confidence||'NIEWERYFIKOWANE')} ${citations(r)||'<em>Brak wskazanego źródła.</em>'}</li>`
    ).join('');
  return `<article class="report-paper" id="report-paper"><div class="report-cover"><div class="report-kicker">SHADOWARCHIVE / RAPORT OSINT</div><h1 class="report-title">${escape(c.title)}</h1><p><strong>ID sprawy:</strong> ${escape(c.id)}<br><strong>Data opracowania:</strong> ${fmtDate(new Date().toISOString(),true)}<br><strong>Status sprawy:</strong> ${escape(c.status)}</p><p>Opracowanie materiałów zgromadzonych przez użytkownika. Kategorie opisują charakter informacji; ich treść i ocenę weryfikuje autor raportu.</p>${c.demo?'<p><strong>DANE FIKCYJNE — RAPORT DEMONSTRACYJNY</strong></p>':''}</div>` +
    section('1. Cel i zakres',
      `<p><strong>Cel:</strong> ${escape(c.goal||'Nie określono')}</p><p><strong>Zakres:</strong> ${escape(c.scope||'Nie określono')}</p><p><strong>Pytania badawcze:</strong>\n${escape(c.questions||'Nie określono')}</p>`
      ) +
    section('2. Metodologia',
      `<p>${escape(c.methodology||'Autor nie uzupełnił opisu metodologii. Raport porządkuje wpisane rekordy i ich źródła; nie weryfikuje automatycznie twierdzeń.')}</p>`
      ) +
    section('3. Fakty potwierdzone', info(get('finding').filter(r => r.epistemic === EPI[3]))) +
    section('4. Twierdzenia źródeł', info([...get('claim'), ...get('finding').filter(r => r.epistemic === EPI[
      1])])) +
    section('5. Informacje nieweryfikowane', info(get('finding').filter(r => r.epistemic === EPI[0]))) +
    section('6. Hipotezy', get('hypothesis').map(r =>
      `<div><h3>${escape(r.title)}</h3>${badge('HIPOTEZA')} ${badge(r.status)}<p>${escape(r.content||'')}</p><p><strong>Za:</strong> ${escape(r.argumentsFor||'Brak argumentów')}</p><p><strong>Przeciw:</strong> ${escape(r.argumentsAgainst||'Brak argumentów')}</p><p><strong>Alternatywy:</strong> ${escape(r.alternatives||'Nie opisano')}</p><p><strong>Brakujące informacje:</strong> ${escape(r.missingInfo||'Nie opisano')}</p><p><strong>Kolejne kroki:</strong> ${escape(r.nextSteps||'Nie określono')}</p>${citations(r)}</div>`
      ).join('') + info(get('finding').filter(r => r.epistemic === EPI[2]))) +
    section('7. Chronologia', timeline ? `<ol>${timeline}</ol>` : '') +
    section('8. Osoby', entities('person') ? `<ul>${entities('person')}</ul>` : '') +
    section('9. Organizacje', entities('organization') ? `<ul>${entities('organization')}</ul>` : '') +
    section('10. Relacje wpisane przez autora', get('relation').map(r =>
      `<p><strong>${escape(state.records.get(r.fromIds?.[0])?.title||'?')}</strong> — ${escape(r.relationType||r.title)} → <strong>${escape(state.records.get(r.toIds?.[0])?.title||'?')}</strong><br>${fmtDate(r.date)} · ${badge(r.status)}<br>${escape(r.description||'')} ${citations(r)||'Brak źródła; relacja wymaga udokumentowania.'}</p>`
      ).join('')) +
    section('11. Sprzeczności', get('contradiction').map(r =>
      `<div><h3>${escape(r.title)}</h3><p>A: ${escape(r.claimA||'')} ${(r.sourceAIds||[]).map(id=>`[${sourceLabels.get(id)||id}]`).join(' ')}</p><p>B: ${escape(r.claimB||'')} ${(r.sourceBIds||[]).map(id=>`[${sourceLabels.get(id)||id}]`).join(' ')}</p><p>Różnice: ${escape(r.differences||'')}</p><p>Wniosek autora: ${escape(r.conclusion||'Brak')}</p>${badge(r.status)}</div>`
      ).join('')) +
    section('12. Wnioski analityczne', info(get('finding').filter(r => r.epistemic === EPI[4])) + (c
      .conclusions ? `<p>${escape(c.conclusions)}</p>` : '')) +
    section('13. Ograniczenia i otwarte kwestie',
      `<p>${escape(c.limitations||'Autor nie określił ograniczeń.')}</p><p>${escape(c.openQuestions||'Brak opisanych otwartych kwestii.')}</p>${c.findings?`<h3>Notatki robocze sprawy — nieklasyfikowane</h3><p>${escape(c.findings)}</p>`:''}`
      ) +
    section('14. Wykaz źródeł', sourceList.map(s =>
      `<div class="source-entry" id="src-${escape(s.id)}"><h3>[${sourceLabels.get(s.id)}] ${escape(s.title)}</h3><p>Autor: ${escape(s.author||'Nie ustalono')} · Wydawca: ${escape(s.publisher||'Nie ustalono')}<br>Publikacja: ${fmtDate(s.publicationDate)} · Zdarzenie: ${fmtDate(s.eventDate)} · Pozyskanie: ${fmtDate(s.acquiredAt,true)}<br>Typ: ${escape(s.sourceType||'')} · Weryfikacja: ${escape(s.status||'Nieweryfikowane')}<br>${safeURL(s.url)?`<a href="${escape(s.url)}" rel="noopener noreferrer">${escape(s.url)}</a>`:''}${s.archiveOrg||s.archiveToday||s.archiveUrl?'<br>Archiwum: '+escape(s.archiveOrg||s.archiveToday||s.archiveUrl):''}</p></div>`
      ).join('')) +
    section('15. Załączniki i materiały', attachmentList.map(r =>
      `<div class="source-entry"><h3>${escape(r.title)}</h3><p>Typ: ${SCHEMA[r.kind].single}${r.kind==='media'?`<br>Publikacja: ${fmtDate(r.publicationDate)}<br>Powstanie materiału: ${fmtDate(r.recordingDate)}`:''}<br>${escape(r.fileName||'Rekord bez lokalnego pliku')}${r.fileSize?` · ${bytes(r.fileSize)}`:''}${r.sha256?`<br>SHA-256: <span class="mono">${escape(r.sha256)}</span>`:''}<br>${escape(r.url||'')}${citations(r)}</p></div>`
      ).join('')) +
    '<p class="report-kicker">KONIEC RAPORTU · Wygenerowano lokalnie w ShadowArchive</p></article>';
}
export async function reportView(caseId = state.scope) {
  if (!caseId) {
    const options = rows('case', {allCases: true}).map(r => '<option value="' + escape(r.id) + '">' + escape(r.title) + '</option>').join('');
    $('#main').innerHTML = heading('Raporty', 'Wybierz sprawę, aby przygotować raport do wydruku lub eksportu.') + '<section class="panel"><label for="report-case">Sprawa</label><select id="report-case"><option value="">Wybierz…</option>' + options + '</select></section>';
    $('#report-case').onchange = e => { if (e.target.value) location.hash = 'report/' + e.target.value; };
    return;
  }
  const c = state.records.get(caseId);
  if (!c) { $('#main').innerHTML = empty('Brak sprawy', 'Wybierz istniejącą sprawę.'); return; }
  const html = createReport(caseId);
  $('#main').innerHTML = heading('Raport sprawy', 'Sprawdź ustalenia i źródła przed udostępnieniem.', '<button id="report-html">Eksport HTML</button><button class="primary" id="report-print">Drukuj / Zapisz PDF</button>') + caseTabs(caseId, 'report') + html;
  $('#report-print').onclick = () => window.print();
  $('#report-html').onclick = async () => {
    const css = await (await fetch(new URL('./print.css', import.meta.url))).text();
    const full = `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"><title>${escape(c.title)} — Raport OSINT</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#172b46;max-width:940px;margin:40px auto;padding:20px}h2{border-bottom:1px solid #ccc;margin-top:32px}p{white-space:pre-wrap;overflow-wrap:anywhere}.badge{border:1px solid #ccd;padding:3px 6px;border-radius:4px;font-size:12px}.report-kicker{font-size:12px;letter-spacing:2px}.mono{font-family:monospace;overflow-wrap:anywhere}@media print{${css}}</style><body>${html}</body></html>`;
    download(new Blob([full], {type: 'text/html;charset=utf-8'}), `ShadowArchive-raport-${c.shortName || c.id}.html`);
    await db.addLog('Eksport raportu HTML', c);
  };
}
