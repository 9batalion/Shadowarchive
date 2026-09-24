import {
  SCHEMA,
  allFields,
  EPI,
  REF_KEYS,
  references,
  normal
} from './schema.js';
import {
  state,
  rows
} from './state.js';
import * as db from './db.js';
import {
  search
} from './search.js';
import {
  $,
  escape,
  icon,
  fmtDate,
  today,
  badge,
  tags,
  linkRecord,
  empty,
  heading,
  addButton,
  markdown,
  safeURL,
  bytes
} from './ui.js';
import {
  quality,
  duplicates,
  analytics
} from './quality.js';
const recent = items => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
const inScope = r => !state.scope || r.id === state.scope || r.caseIds?.includes(state.scope);
const options = (items, value = '', emptyText = 'Wszystkie') => `<option value="">${emptyText}</option>` +
  items.map(([v, l]) => `<option value="${escape(v)}"${v===value?' selected':''}>${escape(l)}</option>`).join(
    '');
export function recordList(items, {
  limit = 5,
  task = false
} = {}) {
  if (!items.length) return '<p class="muted progress-note">Brak rekordów w tym widoku.</p>';
  return `<ul class="record-list">${items.slice(0,limit).map(r=>`<li>${task?`<button class="task-check" data-action="task-done" data-id="${escape(r.id)}" aria-label="Oznacz zadanie jako wykonane">${icon('check')}</button>`:`<span class="row-icon">${icon(SCHEMA[r.kind].icon)}</span>`}<div class="body">${linkRecord(r)}<small>${escape(r.deadline?fmtDate(r.deadline):r.domain||r.author||SCHEMA[r.kind].single)}${r.deadline&&r.deadline<today()?' · Zaległe':''}</small>${r.status?badge(r.status):''}</div></li>`).join('')}</ul>`;
}

function panel(title, content, href = '') {
  return `<section class="panel"><div class="panel-header"><h2>${title}</h2>${href?`<a href="${href}">Zobacz wszystkie</a>`:''}</div>${content}</section>`;
}

function stat(label, count, note, ico) {
  return `<div class="stat"><div class="stat-label">${icon(ico)}${label}</div><strong>${count.toLocaleString('pl-PL')}</strong><small>${note}</small></div>`;
}

function caseCard(r) {
  const counts = {};
  for (const item of state.records.values())
    if (!item.deletedAt && item.caseIds?.includes(r.id)) counts[item.kind] = (counts[item.kind] || 0) + 1;
  return `<article class="case-card"><button class="pin-button${r.pinned?' pinned':''}" data-action="pin" data-id="${escape(r.id)}" aria-label="${r.pinned?'Odepnij':'Przypnij'} sprawę">${icon('pin')}</button><div>${badge(r.status)}</div><h3>${linkRecord(r)}</h3><p>${escape(r.description||r.goal||'Dodaj cel i zakres dochodzenia.')}</p><div class="foot"><span>Źródła: ${counts.source||0} · Osoby: ${counts.person||0}</span><span>${fmtDate(r.updatedAt)}</span></div></article>`;
}
export async function dashboard() {
  const all = rows(),
    cases = recent(rows('case', {
      allCases: true
    })).filter(r => !['Zakończona', 'Archiwalna'].includes(r.status)).sort((a, b) => Number(!!b.pinned) -
      Number(!!a.pinned));
  const tasks = rows('task').filter(r => !['Wykonane', 'Anulowane'].includes(r.status));
  const leads = recent(rows('lead').filter(r => ['Nowy', 'Do sprawdzenia'].includes(r.status)));
  const hs = recent(rows('hypothesis').filter(r => !['Potwierdzona', 'Obalona', 'Nieweryfikowalna']
    .includes(r.status)));
  const sources = recent(rows('source'));
  const unverified = all.filter(r => ['source', 'claim', 'finding', 'media', 'evidence'].includes(r.kind) &&
    (/nieweryfik|nie oceniono/i.test(r.status || r.authenticity || r.confidence || '')));
  const [lastBackup, drafts, activeSession] = await Promise.all([db.setting('lastBackup'), db.all('drafts'),
    db.setting('activeSession')
  ]);
  const days = lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / 86400000) : null;
  const active = state.records.get(activeSession);
  const doToday = tasks.filter(r => r.deadline && r.deadline <= today()).sort((a, b) => a.deadline
    .localeCompare(b.deadline));
  $('#main').innerHTML = heading('Pulpit pracy', new Intl.DateTimeFormat('pl-PL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date()),
      `<button data-action="start-session">${icon('timer')} Rozpocznij sesję OSINT</button>`) + (active && active.status === 'Trwa' && !active.endedAt ?
      `<div class="session-banner"><div><strong>Sesja trwa · ${escape(active.title)}</strong><br><small>Od ${fmtDate(active.startedAt,true)}</small></div><button data-action="end-session">Zakończ sesję</button></div>` :
      '') +
    `<div class="stats">${stat('Aktywne sprawy',cases.length,'Twoje otwarte dochodzenia','folder')}${stat('Źródła',sources.length,'Materiały w wybranym zakresie','link')}${stat('Nowe tropy',leads.length,'Czekają na sprawdzenie','compass')}${stat('Do weryfikacji',unverified.length,'Źródła, twierdzenia i materiały','shield')}</div>` +
    `<div class="backup-card">${icon('shield')}<div class="body"><strong>${days===null?'Zadbaj o pierwszą kopię bezpieczeństwa':`Ostatni backup: ${days===0?'dzisiaj':days+' dni temu'}`}</strong><p>${days===null||days>=((await db.setting('backupDays'))||7)?'Zalecana kopia bezpieczeństwa. Zapisz pełny eksport wraz z plikami poza przeglądarką.':'Ostatnio wyeksportowano pełną bazę. Upewnij się, że pobrany plik został zachowany.'}</p><button data-action="backup">${icon('download')} Utwórz backup</button></div><a href="#settings" class="muted" aria-label="Ustawienia kopii zapasowych">${icon('settings')}</a></div>` +
    `<div class="dashboard-grid"><div class="left-column">${panel('Aktywne sprawy',cases.length?`<div class="case-grid">${cases.slice(0,4).map(caseCard).join('')}</div>`:empty('Pierwsza sprawa zaczyna się od pytania','Utwórz sprawę, określ cel i dodaj pierwsze źródło.',addButton('case')+' <button data-action="demo">Zobacz fikcyjny przykład</button>'),'#list/case')}${panel('Ostatnio dodane źródła',recordList(sources),'#list/source')}${panel('Ostatnio edytowane',recordList(recent(all),{limit:5}),'#search')}${drafts.length?panel('Szkice do odzyskania',`<ul class="record-list">${drafts.slice(0,8).map(d=>`<li><div class="body"><strong>${escape(d.record.title||'Szkic bez tytułu')}</strong><small>${fmtDate(d.at,true)}</small></div><button data-action="draft" data-id="${escape(d.id)}">Kontynuuj</button><button data-action="delete-draft" data-id="${escape(d.id)}" aria-label="Usuń szkic">×</button></li>`).join('')}</ul>`):''}</div><div class="right-column">${panel('Dzisiaj',recordList(doToday,{task:true,limit:6})+`<div class="mini-metrics"><span><strong>${tasks.length}</strong> otwartych zadań</span><a href="#tasks">Plan pracy</a></div>`)}${panel('Otwarte hipotezy',recordList(hs,{limit:3}),'#list/hypothesis')}${panel('Najnowsze tropy',recordList(leads,{limit:3}),'#list/lead')}${panel('Wymagają uwagi',`<ul class="metric-list"><li><a href="#list/source">Źródła bez archiwizacji</a><strong>${sources.filter(s=>!s.archiveOrg&&!s.archiveToday&&!s.archiveUrl).length}</strong></li><li><a href="#quality">Braki danych</a><strong>${quality(all,[...state.records.values()]).issues.length}</strong></li><li><a href="#list/contradiction">Sprzeczności</a><strong>${rows('contradiction').length}</strong></li></ul>`)}</div></div><div class="mini-metrics">${[['case','spraw'],['person','osób'],['organization','organizacji'],['source','źródeł'],['document','dokumentów'],['media','mediów'],['event','zdarzeń'],['hypothesis','hipotez'],['relation','relacji']].map(([k,l])=>`<a href="#list/${k}"><strong>${rows(k).length}</strong> ${l}</a>`).join('')}</div>`;
}
let listSequence = 0;
export async function listView(kind = '', initialQuery = '', trash = false) {
  const title = trash ? 'Kosz' : kind ? SCHEMA[kind].label : 'Wyszukiwarka';
  $('#main').innerHTML = heading(title, trash ?
      'Przywróć rekord lub usuń go definitywnie. Odwołania chronią przed przypadkowym usunięciem.' : kind ?
      'Każdy materiał ma swoje miejsce i pochodzenie.' :
      'Szukaj fraz w cudzysłowie, wariantów nazw, ID i tagów #tag.', kind ? addButton(kind) : '') +
    `<div class="toolbar"><input id="list-query" type="search" value="${escape(initialQuery)}" placeholder="Szukaj, np. &quot;dokładna fraza&quot; #archiwum" aria-label="Szukaj rekordów">${!kind?`<select id="list-kind" aria-label="Typ rekordu">${options(Object.entries(SCHEMA).map(([k,s])=>[k,s.label]),'','Wszystkie typy')}</select>`:''}<select id="list-status" aria-label="Status">${options([...new Set(rows(kind,{trash}).map(r=>r.status).filter(Boolean))].sort().map(s=>[s,s]),'','Każdy status')}</select><label>Od <input id="list-from" type="date" aria-label="Data od"></label><label>Do <input id="list-to" type="date" aria-label="Data do"></label></div><div id="list-result"></div><div class="pagination"><span id="list-count"></span><div class="actions"><button id="list-prev">Poprzednia</button><button id="list-next">Następna</button></div></div>`;
  let page = 0,
    total = 0;
  const load = async () => {
    const sequence = ++listSequence;
    const result = await search({
      query: $('#list-query').value,
      kinds: kind ? [kind] : $('#list-kind')?.value ? [$('#list-kind').value] : [],
      caseId: state.scope,
      status: $('#list-status').value,
      from: $('#list-from').value,
      to: $('#list-to').value,
      trash,
      offset: page * 50,
      limit: 50
    });
    if (sequence !== listSequence || !$('#list-result')) return;
    total = result.total;
    const records = result.ids.map(id => state.records.get(id)).filter(Boolean);
    $('#list-result').innerHTML = records.length ? (kind === 'case' && !trash ?
        `<div class="case-grid">${records.map(caseCard).join('')}</div>` : recordTable(records, trash)
        ) : empty('Brak wyników', 'Zmień filtr albo dodaj pierwszy rekord.', kind ? addButton(kind) :
        '');
    $('#list-count').textContent =
      `Rekordy: ${total.toLocaleString('pl-PL')} · strona ${page+1} z ${Math.max(1,Math.ceil(total/50))}`;
    $('#list-prev').disabled = page === 0;
    $('#list-next').disabled = (page + 1) * 50 >= total;
  };
  let timer;
  $('#list-query').oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 0;
      load();
    }, 150);
  };
  for (const id of ['list-kind', 'list-status', 'list-from', 'list-to'])
    if ($('#' + id)) $('#' + id).onchange = () => {
      page = 0;
      load();
    };
  $('#list-prev').onclick = () => {
    page--;
    load();
  };
  $('#list-next').onclick = () => {
    page++;
    load();
  };
  await load();
}
export function recordTable(records, trash = false) {
  return `<div class="table-wrap"><table><thead><tr><th>Nazwa / tytuł</th><th>Status / kategoria</th><th class="hide-mobile">Tagi</th><th class="hide-mobile">Ostatnia zmiana</th>${trash?'<th>Operacje</th>':''}</tr></thead><tbody>${records.map(r=>`<tr><td class="title-cell">${linkRecord(r)}<small>${SCHEMA[r.kind].single}${r.kind==='source'&&r.author?' · '+escape(r.author):''}</small></td><td>${badge(r.status||r.epistemic)}</td><td class="hide-mobile">${tags(r.tags)}</td><td class="hide-mobile nowrap">${fmtDate(r.updatedAt)}</td>${trash?`<td><div class="actions"><button data-action="restore" data-id="${r.id}">Przywróć</button><button class="danger" data-action="purge" data-id="${r.id}">Usuń definitywnie</button></div></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
export function caseTabs(id, active = 'record') {
  return `<nav class="tabs" aria-label="Widoki sprawy">${[['record','Karta'],['case-records','Materiały'],['timeline','Oś czasu'],['graph','Graf'],['analysis','Analiza'],['quality','Jakość danych'],['report','Raport'],['journal','Dziennik']].map(([r,t])=>`<a class="${active===r?'active':''}" href="#${r}/${encodeURIComponent(id)}">${t}</a>`).join('')}</nav>`;
}

function renderField(f, r) {
  const v = r[f.key];
  if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '';
  if (f.key === 'title' || f.key === 'tags') return '';
  let content;
  if (f.type === 'refs') content =
    `<div class="chips">${v.map(id=>`<span class="chip">${linkRecord(state.records.get(id))}</span>`).join('')}</div>`;
  else if (f.type === 'checkbox') content = v ? 'Tak' : 'Nie';
  else if (f.type === 'url') content = safeURL(v) ?
    `<a href="${escape(v)}" rel="noopener noreferrer" target="_blank">${escape(v)}</a>` : escape(v);
  else if (r.kind === 'note' && f.key === 'content') content = markdown(v, state.records);
  else if (f.type === 'date' || f.type === 'datetime-local') content = fmtDate(v, f.type ===
  'datetime-local');
  else if (['epistemic', 'confidence', 'status'].includes(f.key)) content = badge(v);
  else content = escape(v);
  return `<div class="field-view${['textarea','refs','url'].includes(f.type)?' wide':''}"><dt>${escape(f.label)}</dt><dd>${content}</dd></div>`;
}
export async function detail(id) {
  const r = state.records.get(id);
  if (!r) {
  $('#main').innerHTML = empty('Nie znaleziono rekordu',
      'Rekord mógł zostać usunięty lub nie znajduje się w tej bazie.');
    return;
  }
  if (r.kind === 'case') state.scope = id;
  const related = Array.from(state.records.values()).filter(o => !o.deletedAt && o.id !== r.id && (
    references(o).includes(r.id) || (r.relatedIds || []).includes(o.id)));
  const log = (await db.all('logs')).filter(l => l.recordId === r.id).sort((a, b) => b.date.localeCompare(a
    .date));
  const relatedPanel = panel('Powiązane rekordy', recordList(related, {limit:12}) + '<small>' + related.length + ' powiązań zwrotnych</small>');
  const historyEntries = log.slice(0,8).map(l => `<p class="progress-note"><strong>${escape(l.action)}</strong> · ${fmtDate(l.date,true)}<br>${escape(l.detail || '')}</p>`).join('');
  const historyPanel = panel(r.kind === 'organization' ? 'Historia zmian danych' : 'Historia rekordu', historyEntries || '<p class="muted">Brak wpisów.</p>');
  $('#main').innerHTML = `<a class="back-link" href="#list/${r.kind}">← ${SCHEMA[r.kind].label}</a>` +
    heading(r.title, SCHEMA[r.kind].single,
      `${!r.deletedAt?`<button data-action="edit" data-id="${escape(id)}">Edytuj</button><button data-action="export-record" data-id="${escape(id)}">Eksport rekordu</button><button class="danger" data-action="trash" data-id="${escape(id)}">${icon('trash')} Do kosza</button>`:`<button data-action="restore" data-id="${escape(id)}">Przywróć</button>`}`
      ) +
    `<div class="detail-header"><div class="detail-meta"><span class="mono">${escape(id)}</span>${badge(r.status)}${['hypothesis','claim','finding'].includes(r.kind)?badge(r.epistemic):''}<span>Utworzono ${fmtDate(r.createdAt)}</span><span>Zmieniono ${fmtDate(r.updatedAt,true)}</span>${r.demo?badge('Dane fikcyjne'):''}</div><div class="chips section-space">${tags(r.tags)}</div>${r.kind==='case'?caseTabs(id):''}</div>${r.deletedAt?'<div class="notice warning">Ten rekord znajduje się w koszu. Nie jest uwzględniany w aktywnych analizach.</div>':''}${r.kind==='hypothesis'?'<div class="notice">Zmiana statusu hipotezy nie zmienia jej kategorii na fakt.</div>':''}<div class="detail-layout"><section class="panel"><dl class="field-grid">${allFields(r.kind).map(f=>renderField(f,r)).join('')}</dl>${r.blobId?`<h2>Oryginalny plik</h2><div class="file-info"><strong>${escape(r.fileName)}</strong><br>${bytes(r.fileSize)} · ${escape(r.fileMime)}<br>Dodano ${fmtDate(r.fileAddedAt,true)}<p><small>SHA-256</small><br><code>${escape(r.sha256)}</code></p><button data-action="download-file" data-id="${escape(id)}">Pobierz oryginał</button> <button data-action="verify-file" data-id="${escape(id)}">Sprawdź integralność</button></div><div id="file-preview"></div>`:''}${r.kind==='source'&&r.url?archiveButtons(r.url):''}${r.kind==='contradiction'?contradictionSources(r):''}${r.kind==='session'?await sessionSummary(r):''}</section><aside>${relatedPanel}${historyPanel}</aside></div>`;
  if (r.blobId && r.fileMime?.startsWith('image/') && !r.fileMime.includes('svg')) {
    const b = await db.get(r.blobId, 'blobs');
    if (b && $('#file-preview')) {
      const url = URL.createObjectURL(b.data),
        img = document.createElement('img');
      img.src = url;
      img.alt = r.fileName;
      img.className = 'file-preview';
      img.onload = () => URL.revokeObjectURL(url);
      $('#file-preview').append(img);
    }
  }
}

function archiveButtons(url) {
  return `<div class="section-space"><h3>Sprawdź archiwa</h3><p class="progress-note">Otwarcie archiwum przekazuje mu adres URL. Zapis archiwalny uzupełnij ręcznie po sprawdzeniu.</p><div class="actions"><a class="chip" target="_blank" rel="noopener noreferrer" href="https://web.archive.org/web/*/${escape(url)}">Archive.org — znajdź kopie</a><a class="chip" target="_blank" rel="noopener noreferrer" href="https://archive.ph/${encodeURIComponent(url)}">Archive.today — sprawdź adres</a></div></div>`;
}

function contradictionSources(r) {
  return `<div class="section-space"><h2>Porównanie pochodzenia</h2><div class="field-grid">${[['A',r.sourceAIds],['B',r.sourceBIds]].map(([label,ids])=>`<div><h3>Źródło ${label}</h3>${(ids||[]).map(id=>{const s=state.records.get(id);return s?`<p>${linkRecord(s)}<br><small>Autor: ${escape(s.author||'Nie ustalono')}<br>Publikacja: ${fmtDate(s.publicationDate)}<br>Pozyskanie: ${fmtDate(s.acquiredAt,true)}</small></p>`:'Brak';}).join('')}</div>`).join('')}</div></div>`;
}
async function sessionSummary(r) {
  const logs = (await db.all('logs')).filter(l => l.sessionId === r.id).sort((a, b) => a.date.localeCompare(
    b.date));
  const created = kind => logs.filter(l => l.action === 'Utworzenie' && l.kind === kind).length;
  return `<div class="section-space"><h2>Przebieg sesji</h2><p>${logs.length} czynności · ${created('source')} dodanych źródeł · ${created('person')} osób · ${created('lead')} tropów</p>${logs.slice(0,200).map(l=>`<p class="progress-note">${fmtDate(l.date,true)} · ${escape(l.action)} · ${escape(l.title)}</p>`).join('')}${logs.length>200?'<p>Pozostałe wpisy są w dzienniku i backupie.</p>':''}</div>`;
}
export async function timeline() {
  const events = rows('event');
  $('#main').innerHTML = heading('Oś czasu', 'Data zdarzenia jest niezależna od daty publikacji źródła.',
      addButton('event')) + (state.scope ? caseTabs(state.scope, 'timeline') : '') +
    `<div class="toolbar"><select id="timeline-zoom" aria-label="Zakres okresu"><option value="month">Miesiąc</option><option value="day">Dzień</option><option value="year">Rok</option><option value="decade">Dekada</option></select><input id="timeline-person" type="search" list="timeline-people" aria-label="Osoba" placeholder="Osoba — nazwa lub alias"><datalist id="timeline-people">${rows('person').slice(0,50).map(r=>`<option value="${escape(r.title)}">`).join('')}</datalist><input id="timeline-org" type="search" list="timeline-orgs" aria-label="Organizacja" placeholder="Organizacja — nazwa"><datalist id="timeline-orgs">${rows('organization').slice(0,50).map(r=>`<option value="${escape(r.title)}">`).join('')}</datalist><select id="timeline-category" aria-label="Kategoria">${options([...new Set(events.map(e=>e.category).filter(Boolean))].sort().map(c=>[c,c]),'','Każda kategoria')}</select><input id="timeline-query" type="search" aria-label="Szukaj zdarzeń" placeholder="Szukaj w zdarzeniach…"><label>Od <input type="date" id="timeline-from"></label><label>Do <input type="date" id="timeline-to"></label></div><div id="timeline-content"></div><button id="timeline-more" hidden>Pokaż kolejne zdarzenia</button>`;
  let limit = 100;
  const render = () => {
    const person = $('#timeline-person').value,
      org = $('#timeline-org').value,
      cat = $('#timeline-category').value,
      q = $('#timeline-query').value.toLowerCase(),
      from = $('#timeline-from').value,
      to = $('#timeline-to').value,
      zoom = $('#timeline-zoom').value;
    const personMatches = new Set(rows('person', {
      allCases: true
    }).filter(p => normal([p.id, p.title, p.aliases, p.variants, p.originalName, p.transliterations]
      .join(' ')).includes(normal(person))).map(p => p.id));
    const orgMatches = new Set(rows('organization', {
      allCases: true
    }).filter(o => normal([o.id, o.title, o.fullName, o.previousNames].join(' ')).includes(normal(
      org))).map(o => o.id));
    const filtered = events.filter(r => (!person || r.personIds?.some(id => personMatches.has(id))) && (!
      org || r.organizationIds?.some(id => orgMatches.has(id))) && (!cat || r.category === cat) && (!
      q || (r.title + ' ' + r.description).toLowerCase().includes(q)) && (!from || (r.endDate || r
      .date) >= from) && (!to || r.date <= to)).sort((a, b) => (a.date || '9999').localeCompare(b
      .date || '9999') || (a.time || '').localeCompare(b.time || ''));
    const groups = new Map();
    for (const e of filtered.slice(0, limit)) {
      const key = !e.date ? 'Bez ustalonej daty' : zoom === 'day' ? fmtDate(e.date) : zoom === 'month' ? e
        .date.slice(0, 7) : zoom === 'year' ? e.date.slice(0, 4) :
        `${Math.floor(Number(e.date.slice(0,4))/10)*10}–${Math.floor(Number(e.date.slice(0,4))/10)*10+9}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    $('#timeline-content').innerHTML = [...groups].map(([period, list]) =>
      `<div class="timeline-group"><div class="timeline-period">${escape(period)}</div><div class="timeline-events">${list.map(e=>`<article class="timeline-event"><small>${fmtDate(e.date)}${e.time?' · '+escape(e.time):''}${e.endDate?' — '+fmtDate(e.endDate):''}</small><h3>${linkRecord(e)}</h3><p>${escape(e.description||'')}</p><div class="chips">${badge(e.confidence)}${(e.sourceIds||[]).map(id=>`<span class="chip">${linkRecord(state.records.get(id))}</span>`).join('')}${!e.sourceIds?.length?badge('Brak źródła'):''}</div></article>`).join('')}</div></div>`
      ).join('') || empty('Brak wydarzeń', 'Dodaj datę, opis i źródła zdarzenia.', addButton('event'));
    $('#timeline-more').hidden = filtered.length <= limit;
  };
  for (const id of ['timeline-zoom', 'timeline-person', 'timeline-org', 'timeline-category',
      'timeline-query', 'timeline-from', 'timeline-to'
    ]) $('#' + id).oninput = () => {
    limit = 100;
    render();
  };
  $('#timeline-more').onclick = () => {
    limit += 100;
    render();
  };
  render();
}
export async function taskView() {
  const tasks = rows('task');
  $('#main').innerHTML = heading('Plan pracy', 'Codzienne zadania i dalsze kroki dochodzenia.', addButton(
      'task')) +
    `<div class="toolbar"><select id="task-view" aria-label="Widok zadań"><option value="today">Dzisiaj</option><option value="upcoming">Najbliższe 7 dni</option><option value="late">Zaległe</option><option value="undated">Bez terminu</option><option value="case">Według sprawy</option><option value="all">Wszystkie otwarte</option><option value="done">Wykonane</option></select></div><div id="task-content"></div>`;
  const render = () => {
    const mode = $('#task-view').value,
      now = today(),
      end = new Date();
    end.setDate(end.getDate() + 7);
    const soon = end.toISOString().slice(0, 10);
    const list = tasks.filter(r => mode === 'done' ? r.status === 'Wykonane' : !['Wykonane', 'Anulowane']
      .includes(r.status)).filter(r => mode === 'today' ? r.deadline === now : mode === 'late' ? r
      .deadline && r.deadline < now : mode === 'upcoming' ? r.deadline > now && r.deadline <= soon :
      mode === 'undated' ? !r.deadline : true).sort((a, b) => (a.deadline || '9999').localeCompare(b
      .deadline || '9999'));
    if (mode === 'case') {
      const groups = new Map();
      for (const r of list)
        for (const id of r.caseIds?.length ? r.caseIds : ['']) {
          if (!groups.has(id)) groups.set(id, []);
          groups.get(id).push(r);
        }
      $('#task-content').innerHTML = [...groups].map(([id, l]) => panel(escape(state.records.get(id)
        ?.title || 'Bez przypisanej sprawy'), recordList(l, {
        limit: 100,
        task: true
      }))).join('') || empty('Brak zadań', 'Dodaj kolejne kroki do swojej sprawy.', addButton('task'));
    } else $('#task-content').innerHTML = list.length ? panel(`${list.length} zadań`, recordList(list, {
      limit: 200,
      task: mode !== 'done'
    })) : empty('Brak zadań w tym widoku', 'Wybierz inny okres lub utwórz zadanie.', addButton('task'));
  };
  $('#task-view').onchange = render;
  render();
}
export async function qualityView() {
  const list = rows(),
    q = quality(list, [...state.records.values()]),
    dups = duplicates(list);
  $('#main').innerHTML = heading('Jakość danych',
      'Kompletność dokumentacji; ten wskaźnik nie oznacza prawdopodobieństwa prawdy.') + (state.scope ?
      caseTabs(state.scope, 'quality') : '') +
    `<section class="panel"><h2>${q.percent===null?'Brak danych do oceny':q.percent+'% kompletności sprawdzanych pól'}</h2><div class="quality-bar"><span style="width:${q.percent||0}%"></span></div><p class="muted">Spełniono ${q.passed} z ${q.checks} kontroli. Oceniane są daty, pochodzenie, argumenty, archiwizacja i warianty nazw.</p></section><div class="section-space"><h2>Braki wymagające sprawdzenia (${q.issues.length})</h2>${q.issues.length?`<div class="table-wrap"><table><thead><tr><th>Rekord</th><th>Co uzupełnić</th></tr></thead><tbody>${q.issues.slice(0,250).map(i=>`<tr><td>${linkRecord(state.records.get(i.id))}</td><td>${escape(i.label)}</td></tr>`).join('')}</tbody></table></div>${q.issues.length>250?'<p class="progress-note">Pokazano 250 pozycji. Zawęź do jednej sprawy, aby przejrzeć pozostałe.</p>':''}`:empty('Brak wykrytych braków','Sprawdź również treść i wiarygodność materiałów.')}</div><div class="section-space"><h2>Potencjalne duplikaty (${dups.total})</h2><p class="muted">Porównaj ręcznie. Aplikacja nie scala i nie usuwa rekordów automatycznie.</p>${dups.pairs.length?`<div class="table-wrap"><table><thead><tr><th>Rekord A</th><th>Rekord B</th><th>Powód wskazania</th></tr></thead><tbody>${dups.pairs.map(p=>`<tr><td>${linkRecord(state.records.get(p.a))}</td><td>${linkRecord(state.records.get(p.b))}</td><td>${escape(p.reason)}</td></tr>`).join('')}</tbody></table></div>`:empty('Nie wskazano duplikatów','Kontrola obejmuje URL, hashe, warianty nazw i podobne początki tytułów.')}</div>`;
}
export async function analysisView() {
  const list = rows(),
    a = analytics(list),
    q = quality(list, [...state.records.values()]);
  const ranked = (entries, record = false) =>
    `<ul class="metric-list">${entries.map(([v,n])=>`<li><span>${record?linkRecord(state.records.get(v)):escape(v)}</span><strong>${n}</strong></li>`).join('')||'<li>Brak danych</li>'}</ul>`;
  $('#main').innerHTML = heading('Analiza sprawy',
      'Zestawienia wskazują częstotliwość odwołań i braki materiału. Nie oceniają osób.') + (state.scope ?
      caseTabs(state.scope, 'analysis') :
      '<div class="notice">Wybierz sprawę w górnym pasku, aby zawęzić analizę.</div>') +
    `<div class="settings-grid">${panel('Najczęściej wskazywane osoby',ranked(a.people,true))}${panel('Organizacje',ranked(a.organizations,true))}${panel('Domeny źródeł',ranked(a.domains))}${panel('Tagi',ranked(a.tags))}${panel('Najczęściej cytowane źródła',ranked(a.sources,true))}${panel('Luki chronologii powyżej 30 dni',a.gaps.map(g=>`<p class="progress-note">${fmtDate(g.from)} — ${fmtDate(g.to)} · <strong>${g.days} dni</strong></p>`).join('')||'<p class="muted">Nie wykryto takich odstępów. Brak wpisów nie dowodzi braku wydarzeń.</p>')}${panel('Hipotezy wymagające danych',recordList(a.pending,{limit:10}))}${panel('Nierozwiązane tropy',recordList(a.leads,{limit:10}))}${panel('Sprzeczności',recordList(a.contradictions,{limit:10}))}${panel('Zdarzenia i relacje bez źródeł',recordList(q.issues.filter(i=>['event','relation'].includes(i.kind)).map(i=>state.records.get(i.id)),{limit:10}))}</div>`;
}
export async function journalView() {
  const logs = (await db.all('logs')).filter(inScope).sort((a, b) => b.date.localeCompare(a.date));
  const manual = rows('activity');
  $('#main').innerHTML = heading('Dziennik czynności',
      'Automatyczne zdarzenia i ręczne wpisy. Historia operacyjna, nie niezmienialny rejestr dowodowy.',
      addButton('activity')) + (state.scope ? caseTabs(state.scope, 'journal') : '') + panel(
      'Ręczne czynności', recordList(recent(manual), {
        limit: 15
      })) +
    `<div class="section-space"><div class="toolbar"><input id="journal-query" type="search" placeholder="Szukaj czynności lub tytułu…" aria-label="Filtr dziennika"></div><div id="journal-content"></div><button id="journal-more">Pokaż kolejne wpisy</button></div>`;
  let limit = 100;
  const render = () => {
    const q = $('#journal-query').value.toLowerCase();
    const result = logs.filter(l => (l.title + ' ' + l.action + ' ' + l.detail).toLowerCase().includes(
    q));
    $('#journal-content').innerHTML =
      `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Czynność</th><th>Rekord / zmienione pola</th></tr></thead><tbody>${result.slice(0,limit).map(l=>`<tr><td class="nowrap">${fmtDate(l.date,true)}</td><td>${escape(l.action)}</td><td>${state.records.has(l.recordId)?linkRecord(state.records.get(l.recordId)):escape(l.title||'Baza danych')}<small>${escape(l.detail)}</small></td></tr>`).join('')}</tbody></table></div>`;
    $('#journal-more').hidden = result.length <= limit;
  };
  $('#journal-query').oninput = () => {
    limit = 100;
    render();
  };
  $('#journal-more').onclick = () => {
    limit += 100;
    render();
  };
  render();
}
export async function tagsView() {
  const links = [...new Set(rows('', {allCases:true}).flatMap(r => r.tags || []))].sort().map(t => `<a href="#search?q=${encodeURIComponent('#' + t)}" class="chip">#${escape(t)}</a>`).join('');
  $('#main').innerHTML = heading('Tagi', 'Wspólny słownik tagów w całym archiwum.') + `<section class="panel"><div class="tag-cloud">${links || '<p class="muted">Dodaj własne tagi w dowolnym rekordzie.</p>'}</div></section>`;
}
