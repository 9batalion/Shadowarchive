import {
  uuid
} from './ids.js';
import {
  SCHEMA,
  allFields,
  newRecord,
  validateRecord,
  EPI
} from './schema.js';
import {
  state,
  save,
  rememberUndo
} from './state.js';
import * as db from './db.js';
import {
  search
} from './search.js';
import {
  fileRecord
} from './crypto.js';
import {
  $,
  $$,
  escape,
  icon,
  bytes,
  toast,
  errorMessage,
  markdown,
  localNow
} from './ui.js';
let changeVersion = 0;
let current = null,
  refs = {},
  blob = null,
  draftTimer, autoTimer, queue = Promise.resolve(),
  hasChanges = false,
  initial = null,
  lastCommitted = '',
  fileBusy = false,
  closed = true,
  conflicted = false;
const editor = () => $('#editor');
const fingerprint = r => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !['updatedAt',
  'revision'
].includes(k))));

function formStatus(s, error = false) {
  const el = $('#editor-status');
  if (el) {
    el.textContent = s;
    el.style.color = error ? 'var(--danger)' : '';
  }
  $('#save-state').textContent = s;
}

function fieldHTML(field, r) {
  const {
    key,
    label,
    type
  } = field;
  let value = r[key] ?? '';
  if (type === 'datetime-local' && value && /Z$|[+-]\d\d:\d\d$/.test(value)) {
    const d = new Date(value);
    value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  const wide = type === 'textarea' || type === 'refs' || key === 'title';
  let control = '';
  if (type === 'refs') {
    control = `<div class="ref-select" id="refs-${key}"></div>`;
  } else if (type === 'textarea') {
    control =
      `<textarea id="f-${key}" name="${key}" rows="${key==='content'?10:3}" spellcheck="true">${escape(value)}</textarea>${key==='content'&&r.kind==='note'?'<span class="hint">Markdown: # nagłówek, **pogrubienie**, tabele, [[Record:ID]]. HTML jest wyświetlany jako tekst.</span><button type="button" data-preview>Podgląd notatki</button><div id="note-preview" hidden></div>':''}`;
  } else if (type === 'select') {
    control =
      `<select id="f-${key}" name="${key}">${field.options.map(v=>`<option${v===value?' selected':''}>${escape(v)}</option>`).join('')}</select>`;
  } else if (type === 'checkbox') {
    control = `<input id="f-${key}" name="${key}" type="checkbox"${value?' checked':''}>`;
  } else {
    control =
      `<input id="f-${key}" name="${key}" type="${type}" value="${escape(key==='tags'?(r.tags||[]).join(', '):value)}"${key==='title'?' required maxlength="1000"':''}${type==='url'?' placeholder="https://…"':''} autocomplete="off">`;
  }
  return `<div class="form-field${wide?' wide':''}"><label for="${type==='refs'?'refs-'+key:'f-'+key}">${escape(label)}${key==='title'?' *':''}</label>${control}</div>`;
}

function renderRefs(field) {
  const box = $('#refs-' + field.key);
  if (!box) return;
  box.innerHTML = (refs[field.key] || []).map(id =>
      `<span class="chip">${escape(state.records.get(id)?.title||id)}<button type="button" data-remove-ref="${escape(id)}" data-key="${field.key}" aria-label="Usuń powiązanie">×</button></span>`
      ).join('') +
    `<button type="button" data-pick="${field.key}" aria-label="Wybierz: ${escape(field.label)}">＋ Wybierz</button>`;
}
export async function openEditor(kind, id, {
  draft = false,
  seed = {}
} = {}) {
  if (editor().open) await closeEditor();
  clearTimeout(draftTimer);
  clearTimeout(autoTimer);
  closed = false;
  conflicted = false;
  blob = null;
  fileBusy = false;
  hasChanges = false;
  refs = {};
  let r = id ? structuredClone(state.records.get(id)) : newRecord(kind, state.scope);
  if (!r && !draft) throw new Error('Nie znaleziono rekordu');
  if (draft) {
    const d = await db.get(id, 'drafts');
    if (d) {
      const stored = state.records.get(id);
      r = d.record;
      if (stored && stored.revision !== r.revision) {
        r = {
          ...r,
          id: uuid(),
          revision: 0,
          title: r.title + ' — odzyskany szkic',
          createdAt: new Date().toISOString()
        };
        await db.deleteDraft(id);
        toast('Szkic z innej rewizji otwarto jako nową kopię. Oryginał pozostaje bez zmian.');
      }
    }
  }
  r = {
    ...r,
    ...seed
  };
  current = r;
  initial = structuredClone(r);
  lastCommitted = fingerprint(r);
  if (!r.revision && Object.keys(seed).length) hasChanges = true;
  for (const f of allFields(r.kind).filter(f => f.type === 'refs')) refs[f.key] = [...(r[f.key] || [])];
  const fields = allFields(r.kind);
  editor().innerHTML =
    `<div class="dialog-head"><div><small>${SCHEMA[r.kind].single}${r.revision?' · Edycja':' · Nowy rekord'}</small><h2 id="editor-title">${escape(r.title||'Dodaj do archiwum')}</h2></div><button type="button" data-editor-close aria-label="Zamknij formularz">×</button></div><form id="record-form" novalidate><div class="dialog-body">${r.kind==='hypothesis'?'<div class="notice">Hipoteza pozostaje hipotezą, również po ręcznym ustawieniu statusu „Potwierdzona”.</div>':''}${r.kind==='source'?'<button type="button" data-paste>Wklej link ze schowka</button>':''}${r.kind==='evidence'?'<div class="notice">Dodaj własny zrzut ekranu. Przeglądarka nie pozwala tej aplikacji przechwytywać dowolnych stron ani obchodzić CORS.</div>':''}<div id="editor-errors" role="alert"></div><div class="form-grid">${fields.slice(0,10).map(f=>fieldHTML(f,r)).join('')}${fields.length>10?`<details class="form-section" open><summary>Szczegóły, źródła i powiązania</summary><div class="form-grid">${fields.slice(10).map(f=>fieldHTML(f,r)).join('')}</div></details>`:''}${SCHEMA[r.kind].file?`<div class="form-field wide"><label for="file-input">Oryginalny plik / screenshot</label><input type="file" id="file-input"${r.blobId?' disabled':''}><span class="hint">Plik nie jest modyfikowany. SHA-256 liczone lokalnie. Maksymalnie 150 MiB.${r.blobId?' Oryginał jest niezmienny. Inny plik dodaj jako nowy rekord.':''}</span><div id="file-status">${r.fileName?`${escape(r.fileName)} · ${bytes(r.fileSize||0)}<br><code class="mono">${escape(r.sha256)}</code>`:'Nie wybrano pliku'}</div></div>`:''}</div><p class="progress-note">Pola zapisują się automatycznie. Niekompletny formularz pozostaje szkicem do odzyskania.</p></div><div class="dialog-foot"><span id="editor-status" class="form-status" role="status">${r.revision?'Zapisano':'Nowy szkic'}</span><div class="actions"><button type="button" data-editor-close>Zamknij</button><button type="submit" class="primary">Zapisz</button></div></div></form>`;
  for (const f of fields.filter(f => f.type === 'refs')) renderRefs(f);
  editor().onclick = async e => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.hasAttribute('data-editor-close')) await closeEditor();
      if (b.dataset.pick) {
        const field = fields.find(f => f.key === b.dataset.pick);
        await picker(field);
      }
      if (b.dataset.removeRef) {
        refs[b.dataset.key] = refs[b.dataset.key].filter(x => x !== b.dataset.removeRef);
        renderRefs(fields.find(f => f.key === b.dataset.key));
        changed();
      }
      if (b.hasAttribute('data-preview')) {
        const p = $('#note-preview');
        p.hidden = !p.hidden;
        if (!p.hidden) p.innerHTML = markdown($('#f-content').value, state.records);
      }
      if (b.hasAttribute('data-paste')) {
        try {
          const text = await navigator.clipboard.readText();
          $('#f-url').value = text.trim();
          changed();
        } catch {
          toast('Schowek niedostępny. Przytrzymaj pole URL i wybierz Wklej.', true);
        }
      }
    } catch (e) {
      errorMessage(e);
    }
  };
  $('#record-form').addEventListener('input', changed);
  $('#record-form').addEventListener('change', changed);
  $('#record-form').onsubmit = async e => {
    e.preventDefault();
    clearTimeout(autoTimer);
    try {
      await commit();
      toast('Zapisano rekord');
    } catch (e) {
      showError(e);
    }
  };
  if ($('#file-input')) $('#file-input').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    fileBusy = true;
    formStatus('Obliczanie SHA-256…');
    try {
      blob = await fileRecord(file);
      current = {
        ...current,
        blobId: blob.id,
        fileName: blob.name,
        fileSize: blob.size,
        fileMime: blob.mime,
        sha256: blob.sha256,
        fileAddedAt: blob.addedAt
      };
      $('#file-status').innerHTML =
        `${escape(blob.name)} · ${bytes(blob.size)}<br><code class="mono">${blob.sha256}</code>`;
      hasChanges = true;
    } catch (e) {
      showError(e);
    } finally {
      fileBusy = false;
      changed();
    }
  };
  editor().oncancel = e => {
    e.preventDefault();
    closeEditor().catch(errorMessage);
  };
  editor().showModal();
  $('#f-title').focus();
  if (draft || hasChanges) changed();
}

function collect() {
  const r = {
    ...current,
    ...refs
  };
  for (const f of allFields(current.kind)) {
    if (f.type === 'refs') continue;
    const input = $('#f-' + f.key);
    if (!input) continue;
    r[f.key] = f.type === 'checkbox' ? input.checked : f.key === 'tags' ? [...new Set(input.value.split(',')
        .map(v => v.trim().replace(/^#/, '')).filter(Boolean))] : f.type === 'datetime-local' && input.value ?
      new Date(input.value).toISOString() : input.value;
  }
  if (r.kind === 'source' && r.url && !r.domain) {
    try {
      r.domain = new URL(r.url).hostname;
    } catch {}
  }
  if (r.kind === 'hypothesis') r.epistemic = EPI[2];
  if (r.kind === 'claim') r.epistemic = EPI[1];
  return r;
}

function changed() {
  if (closed) return;
  changeVersion++;
  hasChanges = true;
  formStatus('Zapisywanie…');
  clearTimeout(draftTimer);
  clearTimeout(autoTimer);
  draftTimer = setTimeout(() => persistDraft().catch(showError), 160);
  if (!conflicted) autoTimer = setTimeout(() => commit(false).catch(showError), 1100);
}
async function persistDraft() {
  if (closed || !hasChanges) return;
  const r = collect();
  await db.saveDraft(r, blob);
  if (validateRecord(r).length) formStatus('Szkic zapisany');
}

function showError(e) {
  formStatus('Błąd zapisu — szkic zachowany', true);
  const el = $('#editor-errors');
  if (el) el.innerHTML = `<div class="notice error">${escape(e.message)}</div>`;
  if (/innej karcie/.test(e.message)) conflicted = true;
}
export async function commit(explicit = true) {
  if (closed) return;
  const run = async () => {
    if (fileBusy) throw new Error('Poczekaj na obliczenie SHA-256 pliku.');
    const r = collect();
    const errors = validateRecord(r);
    if (errors.length) {
      await db.saveDraft(r, blob);
      formStatus('Szkic zapisany');
      if (explicit) throw new Error(errors.join('\n'));
      return false;
    }
    if (fingerprint(r) === lastCommitted && r.revision) {
      formStatus('Zapisano');
      return true;
    }
    formStatus('Zapisywanie…');
    const version = changeVersion,
      previous = {
        ...current
      },
      savedBlob = blob;
    const saved = await save(r, {
      blob: savedBlob
    });
    if (previous.status !== r.status && previous.revision) rememberUndo(previous);
    const attachmentChanged = blob !== savedBlob;
    const attachmentFields = attachmentChanged ? Object.fromEntries(['blobId', 'fileName', 'fileSize',
      'fileMime', 'sha256', 'fileAddedAt'
    ].map(k => [k, current[k]])) : {};
    current = {
      ...saved,
      ...attachmentFields
    };
    if (!attachmentChanged) blob = null;
    lastCommitted = fingerprint(saved);
    hasChanges = version !== changeVersion;
    $('#editor-errors').innerHTML = '';
    if (hasChanges) {
      await persistDraft();
      formStatus('Zapisywanie…');
    } else formStatus('Zapisano');
    return true;
  };
  queue = queue.catch(() => {}).then(run);
  return queue;
}
export async function closeEditor() {
  clearTimeout(autoTimer);
  clearTimeout(draftTimer);
  if (!closed && hasChanges) {
    try {
      await commit(false);
    } catch (e) {
      await persistDraft();
      showError(e);
    }
  }
  closed = true;
  editor().close();
  window.dispatchEvent(new CustomEvent('editor-closed'));
}
export async function flushEditor() {
  if (closed) return;
  clearTimeout(autoTimer);
  clearTimeout(draftTimer);
  await persistDraft();
  if (!conflicted) await commit(false);
}
export function isEditing() {
  return !closed;
}
export function hasUnsaved() {
  return !closed && hasChanges;
}
async function picker(field) {
  const d = $('#picker-dialog');
  d.innerHTML =
    `<div class="dialog-head"><h2 id="picker-title">${escape(field.label)}</h2><button data-close aria-label="Zamknij wybór">×</button></div><div class="dialog-body"><input type="search" id="picker-query" placeholder="Szukaj nazwy, ID lub wariantu…" aria-label="Wyszukaj powiązany rekord" style="width:100%"><div class="picker-results" id="picker-results"></div><p class="hint muted">Wpisz fragment nazwy, aby zawęzić listę. Pokazujemy do 30 wyników.</p></div>`;
  d.querySelector('[data-close]').onclick = () => d.close();
  let seq = 0;
  const render = async () => {
    const n = ++seq;
    const result = await search({
      query: $('#picker-query').value,
      kinds: field.kinds,
      limit: 30
    });
    if (n !== seq) return;
    $('#picker-results').innerHTML = result.ids.filter(id => id !== current.id).map(id => {
      const r = state.records.get(id);
      return `<button type="button" data-id="${escape(id)}"${refs[field.key]?.includes(id)?' disabled':''}>${icon(SCHEMA[r.kind].icon)}<span>${escape(r.title)}</span><small>${SCHEMA[r.kind].single}</small></button>`;
    }).join('') || '<p class="muted">Brak wyników. Najpierw utwórz odpowiedni rekord.</p>';
  };
  d.onclick = e => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    refs[field.key] ||= [];
    refs[field.key].push(b.dataset.id);
    renderRefs(field);
    changed();
    d.close();
  };
  $('#picker-query').oninput = render;
  d.showModal();
  $('#picker-query').focus();
  await render();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushEditor().catch(() => {});
});
window.addEventListener('beforeunload', e => {
  if (hasUnsaved()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
