import {
  SCHEMA,
  VERSION,
  newRecord
} from './schema.js';
import * as db from './db.js';
import {
  state,
  rows,
  reload,
  save,
  put,
  rememberUndo,
  undo
} from './state.js';
import {
  $,
  $$,
  escape,
  icon,
  dialog,
  toast,
  errorMessage,
  confirmAction,
  download,
  heading,
  fmtDate,
  empty,
  localNow
} from './ui.js';
import {
  openEditor,
  flushEditor,
  commit,
  isEditing
} from './editor.js';
import {
  dashboard,
  listView,
  detail,
  timeline,
  taskView,
  qualityView,
  analysisView,
  journalView,
  tagsView,
  caseTabs,
  recordTable
} from './views.js';
import {
  graphView,
  destroyGraph
} from './graph.js';
import {
  reportView
} from './report.js';
import {
  dorkView
} from './dork.js';
import {
  settingsView,
  backupDialog,
  importDialog,
  applyTheme
} from './settings.js';
import {
  initPWA,
  applyUpdate,
  checkUpdate,
  install
} from './pwa.js';
import {
  initLock,
  lock,
  isLocked
} from './security.js';
import {
  addDemo
} from './demo.js';
import {
  sha256
} from './crypto.js';
let renderToken = 0,
  rendering = false,
  renderAgain = false;
const groups = [
  ['PRZESTRZEŃ PRACY', [
    ['dashboard', 'Pulpit pracy', 'dashboard'],
    ['list/case', 'Sprawy', 'folder'],
    ['tasks', 'Zadania', 'check'],
    ['list/lead', 'Tropy', 'compass']
  ]],
  ['MATERIAŁY', [
    ['list/source', 'Źródła', 'link'],
    ['list/person', 'Osoby', 'person'],
    ['list/organization', 'Organizacje', 'building'],
    ['list/document', 'Dokumenty', 'file'],
    ['list/evidence', 'Materiały / capture', 'camera'],
    ['list/media', 'Nagrania i obrazy', 'play'],
    ['list/note', 'Notatki', 'note']
  ]],
  ['ANALIZA', [
    ['timeline', 'Oś czasu', 'clock'],
    ['graph', 'Mapa powiązań', 'graph'],
    ['list/relation', 'Relacje', 'graph'],
    ['list/finding', 'Ustalenia', 'flag'],
    ['list/claim', 'Twierdzenia', 'quote'],
    ['list/hypothesis', 'Hipotezy', 'bulb'],
    ['list/contradiction', 'Sprzeczności', 'split'],
    ['analysis', 'Analiza sprawy', 'chart'],
    ['quality', 'Jakość danych', 'shield'],
    ['report', 'Raporty', 'file']
  ]],
  ['WARSZTAT', [
    ['dork', 'Dork Builder', 'search'],
    ['list/search', 'Search Log', 'list'],
    ['list/domain', 'Domeny', 'globe'],
    ['list/website', 'Strony WWW', 'globe'],
    ['list/profile', 'Profile publiczne', 'person'],
    ['list/location', 'Lokalizacje', 'pin'],
    ['journal', 'Dziennik czynności', 'list'],
    ['list/session', 'Sesje OSINT', 'timer'],
    ['tags', 'Tagi', 'flag'],
    ['trash', 'Kosz', 'trash'],
    ['settings', 'Ustawienia', 'settings']
  ]]
];

function navigation() {
  const active = location.hash.slice(1).split('?')[0];
  $('#navigation').innerHTML = groups.map(([label, links]) =>
    `<div class="nav-group">${label}</div>${links.map(([route,label,ico])=>`<a class="nav-link${active===route||(!active&&route==='dashboard')?' active':''}" href="#${route}">${icon(ico)}<span>${label}</span>${route==='list/case'?`<span class="count">${rows('case',{allCases:true}).length}</span>`:''}</a>`).join('')}`
    ).join('');
  const cases = rows('case', {
    allCases: true
  });
  $('#case-scope').innerHTML = '<option value="">Wszystkie sprawy</option>' + cases.sort((a, b) => a.title
    .localeCompare(b.title, 'pl')).map(r =>
    `<option value="${escape(r.id)}"${r.id===state.scope?' selected':''}>${escape(r.shortName||r.title)}</option>`
    ).join('');
  $('#mobile-scope').innerHTML = $('#case-scope').innerHTML;
}
export async function render() {
  renderAgain = true;
  if (rendering) return;
  rendering = true;
  try {
    do {
      renderAgain = false;
      await renderOnce();
    } while (renderAgain);
  } finally {
    rendering = false;
  }
}
async function renderOnce() {
  const n = ++renderToken;
  destroyGraph();
  const raw = location.hash.slice(1) || 'dashboard';
  const [path, qs] = raw.split('?');
  const [view, idEncoded] = path.split('/');
  const id = idEncoded ? decodeURIComponent(idEncoded) : '';
  state.route = view;
  const params = new URLSearchParams(qs);
  if (id && ['timeline', 'graph', 'analysis', 'quality', 'report', 'journal', 'case-records'].includes(
    view) && state.records.get(id)?.kind === 'case') state.scope = id;
  navigation();
  document.body.classList.remove('nav-open');
  try {
    if (view === 'dashboard') await dashboard();
    else if (view === 'list' && SCHEMA[id]) await listView(id);
    else if (view === 'search') await listView('', params.get('q') || '');
    else if (view === 'record') await detail(id);
    else if (view === 'timeline') await timeline();
    else if (view === 'graph') graphView();
    else if (view === 'tasks') await taskView();
    else if (view === 'quality') await qualityView();
    else if (view === 'analysis') await analysisView();
    else if (view === 'journal') await journalView();
    else if (view === 'tags') await tagsView();
    else if (view === 'report') await reportView(id || state.scope);
    else if (view === 'dork') dorkView();
    else if (view === 'settings') await settingsView();
    else if (view === 'trash') await listView('', '', true);
    else if (view === 'case-records') {
      $('#main').innerHTML = heading('Materiały sprawy', state.records.get(id)?.title || '') + caseTabs(id,
          'case-records') +
        `<div class="toolbar"><select id="case-material-kind"><option value="">Wszystkie typy</option>${Object.entries(SCHEMA).filter(([k])=>k!=='case').map(([k,s])=>`<option value="${k}">${s.label}</option>`).join('')}</select><button class="primary" data-action="quick-add">Dodaj materiał</button></div><div id="case-material-list"></div><button id="case-material-more">Pokaż więcej</button>`;
      let limit = 100;
      const update = () => {
        const list = rows($('#case-material-kind').value).filter(r => r.kind !== 'case').sort((a, b) => b
          .updatedAt.localeCompare(a.updatedAt));
        $('#case-material-list').innerHTML = list.length ? recordTable(list.slice(0, limit)) : empty(
          'Brak materiałów', 'Dodaj źródła i podmioty do tej sprawy.');
        $('#case-material-more').hidden = list.length <= limit;
      };
      $('#case-material-kind').onchange = () => {
        limit = 100;
        update();
      };
      $('#case-material-more').onclick = () => {
        limit += 100;
        update();
      };
      update();
    } else await dashboard();
    if (n === renderToken) {
      navigation();
      document.title = ($('#main h1')?.textContent || 'Archiwum') + ' · ShadowArchive';
    }
  } catch (e) {
    errorMessage(e);
    $('#main').innerHTML = empty('Nie udało się otworzyć widoku', e.message,
      '<button data-action="refresh">Spróbuj ponownie</button>');
  }
}

function quickAdd() {
  const d = dialog('Dodaj do archiwum',
    `<div class="quick-grid">${['case','source','person','organization','document','evidence','media','note','lead','hypothesis','task','event','relation','claim','finding','contradiction','domain','profile','website','location','activity'].map(k=>`<button data-action="add" data-kind="${k}">${icon(SCHEMA[k].icon)}${SCHEMA[k].single}</button>`).join('')}</div>`
    );
}
async function startSession() {
  const existing = await db.setting('activeSession');
  if (existing && state.records.get(existing)?.status === 'Trwa') {
    toast('Masz już otwartą sesję. Zakończ ją przed rozpoczęciem kolejnej.');
    location.hash = 'record/' + existing;
    return;
  }
  const cases = rows('case', {
    allCases: true
  });
  if (!cases.length) {
    toast('Najpierw utwórz sprawę.');
    await openEditor('case');
    return;
  }
  const d = dialog('Rozpocznij sesję OSINT',
    `<label for="session-case">Wybierz sprawę</label><select id="session-case" style="width:100%;margin-top:8px">${cases.map(r=>`<option value="${r.id}"${r.id===state.scope?' selected':''}>${escape(r.title)}</option>`).join('')}</select><p class="progress-note">Aplikacja zapisze czas i czynności wykonane w tym archiwum. Wyszukiwania poza aplikacją dopisz w Search Log lub dzienniku.</p>`,
    `<button class="primary" id="session-start">Rozpocznij</button>`);
  $('#session-start').onclick = async () => {
    try {
      const caseId = $('#session-case').value,
        c = state.records.get(caseId),
        r = newRecord('session', caseId);
      r.title = (c.shortName || c.title) + ' · ' + new Date().toLocaleDateString('pl-PL');
      r.startedAt = new Date().toISOString();
      r.status = 'Trwa';
      const saved = await save(r);
      await db.setSession(saved.id);
      state.scope = caseId;
      d.close();
      await render();
      toast('Rozpoczęto sesję OSINT');
    } catch (e) {
      errorMessage(e);
    }
  };
}
async function endSession() {
  const id = await db.setting('activeSession'),
    r = state.records.get(id);
  if (!r) return toast('Brak aktywnej sesji');
  const d = dialog('Zakończ sesję OSINT',
    `<p>${escape(r.title)}</p><label for="session-summary">Podsumowanie i następne kroki</label><textarea id="session-summary" rows="5" style="width:100%;margin-top:8px"></textarea>`,
    `<button class="primary" id="session-end">Zapisz i zakończ</button>`);
  $('#session-end').onclick = async () => {
    try {
      await save({
        ...r,
        endedAt: new Date().toISOString(),
        status: 'Zakończona',
        summary: $('#session-summary').value
      });
      await db.setSession(null);
      d.close();
      await render();
      toast('Zakończono sesję');
    } catch (e) {
      errorMessage(e);
    }
  };
}
async function action(e) {
  const b = e.target.closest('[data-action]');
  if (!b || isLocked()) return;
  const a = b.dataset.action,
    id = b.dataset.id,
    r = id ? state.records.get(id) : null;
  try {
    if (a === 'menu') {
      document.body.classList.toggle('nav-open');
      return;
    }
    if (a === 'global-search') {
      if (location.hash === '#search') $('#list-query')?.focus();
      else location.hash = 'search';
      return;
    }
    if (a === 'quick-add') return quickAdd();
    if (a === 'add') {
      if ($('#utility-dialog').open) $('#utility-dialog').close();
      return openEditor(b.dataset.kind);
    }
    if (a === 'edit') return openEditor(r.kind, id);
    if (a === 'refresh') return render();
    if (a === 'pin') {
      await save({
        ...r,
        pinned: !r.pinned
      });
      return render();
    }
    if (a === 'task-done') {
      rememberUndo(r);
      await save({
        ...r,
        status: 'Wykonane'
      });
      toast('Zadanie wykonane. Możesz cofnąć tę zmianę.');
      return render();
    }
    if (a === 'trash') {
      const originalRoute = location.hash;
      if (!await confirmAction('Przenieść do kosza?',
          `„${r.title}” pozostanie w bazie z możliwością przywrócenia. Powiązane rekordy pozostaną na swoich miejscach.`,
          'Do kosza')) return;
      rememberUndo(r);
      put(await db.trash(r));
      toast('Przeniesiono do kosza');
      if (r.kind === 'case' && state.scope === r.id) state.scope = '';
      if (location.hash === originalRoute) location.hash = 'list/' + r.kind;
      else await render();
      return;
    }
    if (a === 'restore') {
      put(await db.restore(r));
      toast('Przywrócono rekord');
      return render();
    }
    if (a === 'purge') {
      if (await confirmAction('Usunięcie definitywne',
          `Usunąć „${r.title}” i jego plik? Tej operacji nie można cofnąć.`, 'Usuń definitywnie')) {
        await db.purge(id);
        await reload();
        await render();
        toast('Usunięto rekord');
      }
      return;
    }
    if (a === 'undo') {
      await undo();
      toast('Cofnięto operację');
      return render();
    }
    if (a === 'backup') return backupDialog();
    if (a === 'export-record') return backupDialog(id);
    if (a === 'import') return importDialog();
    if (a === 'download-file') {
      const file = await db.get(r.blobId, 'blobs');
      if (!file) throw new Error('Brak pliku w bazie');
      download(file.data, file.name);
      await db.addLog('Pobranie oryginalnego pliku', r);
      return;
    }
    if (a === 'verify-file') {
      const file = await db.get(r.blobId, 'blobs');
      if (!file) throw new Error('Brak pliku w bazie');
      b.disabled = true;
      try {
        const digest = await sha256(await file.data.arrayBuffer());
        if (digest !== r.sha256) throw new Error('Niezgodność SHA-256! Zabezpiecz backup i sprawdź plik.');
        toast('SHA-256 zgodny. Plik zachował integralność.');
        await db.addLog('Kontrola SHA-256', r, 'Hash zgodny');
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (a === 'draft') {
      const d = await db.get(id, 'drafts');
      if (d) return openEditor(d.record.kind, id, {
        draft: true
      });
    }
    if (a === 'delete-draft') {
      if (await confirmAction('Usunąć szkic?',
          'Zostanie usunięty tylko szkic formularza. Zapisany rekord pozostanie w bazie.', 'Usuń szkic')) {
        await db.deleteDraft(id);
        await render();
      }
      return;
    }
    if (a === 'demo') {
      await addDemo();
      await reload();
      await render();
      toast('Dodano fikcyjną sprawę demonstracyjną');
      return;
    }
    if (a === 'remove-demo') {
      if (await confirmAction('Usunąć dane demo?',
          'Usunięte zostaną wszystkie rekordy oznaczone jako demo, także Twoje edycje tych rekordów.',
          'Usuń demo')) {
        await db.removeDemo();
        if (!state.records.has(state.scope)) state.scope = '';
        await reload();
        if (!state.records.has(state.scope)) state.scope = '';
        await render();
        toast('Usunięto dane demo');
      }
      return;
    }
    if (a === 'start-session') return startSession();
    if (a === 'end-session') return endSession();
    if (a === 'lock') return lock();
    if (a === 'install') return install();
    if (a === 'check-update') return checkUpdate();
    if (a === 'update-app') return applyUpdate();
    if (a === 'dismiss-update') $('#update-banner').hidden = true;
  } catch (e) {
    errorMessage(e);
  }
}
async function init() {
  if (!window.isSecureContext || !crypto.subtle) {
    const warning = document.createElement('div');
    warning.className = 'notice warning';
    warning.style.margin = '0';
    warning.textContent =
      'Połączenie HTTP: dostępna praca z rekordami. Szyfrowanie, SHA-256 i tryb offline wymagają HTTPS (GitHub Pages) lub localhost.';
    document.querySelector('.workspace').prepend(warning);
  }
  if (!('indexedDB' in window)) {
    throw new Error('IndexedDB nie jest dostępna w tej przeglądarce.');
  }
  await db.init();
  await reload();
  applyTheme(await db.setting('theme') || 'system');
  $('#app-version').textContent = 'v' + VERSION;
  $('#footer-version').textContent = 'v' + VERSION;
  $('#search-icon').innerHTML = icon('search');
  document.addEventListener('click', action);
  $('#case-scope').onchange = async e => {
    state.scope = e.target.value;
    const view = location.hash.slice(1).split('/')[0];
    if (['record', 'case-records'].includes(view)) location.hash = state.scope ? 'record/' + state
      .scope : 'dashboard';
    else if (['timeline', 'graph', 'analysis', 'quality', 'report', 'journal'].includes(view) &&
      location.hash.includes('/')) location.hash = view + (state.scope ? '/' + state.scope : '');
    else await render();
  };
  $('#mobile-scope').onchange = $('#case-scope').onchange;
  window.addEventListener('hashchange', () => render());
  window.addEventListener('refresh-view', () => render());
  window.addEventListener('editor-closed', () => render());
  window.addEventListener('records-changed', () => {
    if (!isEditing()) navigation();
  });
  window.addEventListener('db-blocked', () => toast(
    'Zamknij pozostałe karty aplikacji i odśwież, aby zakończyć aktualizację bazy.', true));
  let changeTimer;
  db.channel?.addEventListener('message', () => {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(async () => {
      await reload();
      if (!isEditing()) await render();
      else toast('Dane zmieniły się w innej karcie. Zapis sprawdzi zgodność rewizji.');
    }, 200);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => applyTheme(await db
    .setting('theme') || 'system'));
  document.addEventListener('keydown', e => {
    if (isLocked()) return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        location.hash = 'search';
        setTimeout(() => $('#list-query')?.focus(), 0);
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        quickAdd();
      }
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isEditing()) commit().then(() => toast('Zapisano')).catch(errorMessage);
        else toast('Zmiany w aplikacji zapisywane są automatycznie.');
      }
    }
  });
  await render();
  await initPWA();
  await initLock();
}
init().catch(e => {
  errorMessage(e);
  $('#main').innerHTML = empty('Nie udało się otworzyć lokalnej bazy', e.message);
});
