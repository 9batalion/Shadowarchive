import {
  createBundle,
  downloadBundleManifest,
  downloadBundlePart,
  parseImportFiles
} from './multipart.js';
import {
  state,
  rows,
  reload
} from './state.js';
import * as db from './db.js';
import {
  exportBackup,
  parseImport,
  importBackup,
  exportCSV,
  exportMarkdown
} from './transfer.js';
import {
  configureLock,
  disableLock,
  lock
} from './security.js';
import {
  $,
  escape,
  heading,
  dialog,
  toast,
  errorMessage,
  bytes,
  confirmAction
} from './ui.js';
export async function settingsView() {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const theme = await db.setting('theme') || 'system';
  const sessionLock = await db.setting('sessionLock');
  const last = await db.setting('lastBackup');
  $('#main').innerHTML = heading('Ustawienia i kopie zapasowe',
      'Dane pozostają w tej przeglądarce. Pełny backup zawiera rekordy, pliki, szkice i dziennik.') +
    `<div class="settings-grid"><section class="panel"><h2>Kopie bezpieczeństwa</h2><p>Ostatni pełny eksport: ${last?new Date(last).toLocaleString('pl-PL'):'jeszcze nie wykonano'}.</p><div class="actions"><button class="primary" data-action="backup">Pełny backup</button><button id="case-export"${!state.scope?' disabled':''}>Eksport bieżącej sprawy</button></div><label for="backup-days">Przypominaj po liczbie dni</label><input type="number" id="backup-days" min="1" max="90" value="${(await db.setting('backupDays'))||7}"><p>Przeglądarka może usunąć dane witryny. Po pobraniu sprawdź, czy kopia znajduje się w wybranym folderze. Backup aplikacji nie jest automatyczną synchronizacją między urządzeniami.</p><label for="export-scope">Zakres CSV / Markdown</label><select id="export-scope"><option value="current">Bieżąca sprawa / widok wszystkich</option><option value="all">Wszystkie aktywne rekordy</option></select><div class="actions"><button id="csv-export">Eksport CSV</button><button id="md-export">Eksport Markdown</button><a class="chip" href="#report">Raport HTML / PDF</a></div></section><section class="panel"><h2>Import i przywracanie</h2><p>Obsługiwany jest pełny backup, eksport sprawy i pakiet rekordów ShadowArchive JSON. Szyfrowane pliki wymagają hasła.</p><p>Import najpierw sprawdza strukturę i SHA-256. Istniejące rekordy nie są nadpisywane. Przy kolizji ID import tworzy kopie z nowymi identyfikatorami i przepisuje ich odwołania.</p><button class="primary" data-action="import">Wybierz plik do importu</button><div class="notice">CSV i Markdown służą do wymiany oraz czytania danych. Pełną kopię odtwarza się z JSON.</div></section><section class="panel"><h2>Pamięć urządzenia</h2><p>${estimate?`Wykorzystanie pamięci domeny: ${bytes(estimate.usage||0)} z dostępnych około ${bytes(estimate.quota||0)}.`:'Przeglądarka nie udostępnia informacji o limicie.'}</p><p>Status trwałego przechowywania: ${persisted?'przyznane':'nieprzyznane / niedostępne'}.</p><button id="persist-storage">Poproś o trwałe przechowywanie</button><p>Decyzję podejmuje przeglądarka. Nawet trwała pamięć nie zastępuje kopii poza urządzeniem.</p><button data-action="install">Zainstaluj aplikację PWA</button> <button data-action="check-update">Sprawdź aktualizację</button></section><section class="panel"><h2>Wygląd</h2><label for="theme-setting">Motyw</label><select id="theme-setting"><option value="system"${theme==='system'?' selected':''}>Zgodny z systemem</option><option value="light"${theme==='light'?' selected':''}>Jasny</option><option value="dark"${theme==='dark'?' selected':''}>Ciemny</option></select><p>Skróty klawiaturowe:</p><ul class="progress-note"><li>Ctrl / Cmd + K — wyszukiwarka</li><li>Ctrl / Cmd + N — szybkie dodawanie</li><li>Ctrl / Cmd + S — zapis otwartego formularza</li><li>Esc — zamknięcie okna z zachowaniem szkicu</li></ul></section><section class="panel"><h2>Blokada sesji</h2><p>Stan: ${sessionLock?'włączona':'wyłączona'}. Hasło nie jest przechowywane; zapisywany jest wynik PBKDF2.</p><div class="notice warning">Blokada zasłania interfejs. Dane w IndexedDB pozostają jawne. Nie chroni przed osobą mającą dostęp do profilu przeglądarki, rozszerzeniami ani narzędziami deweloperskimi.</div><label for="lock-password">${sessionLock?'Aktualne hasło (do wyłączenia) lub nowe hasło':'Nowe hasło (minimum 6 znaków)'}</label><input id="lock-password" type="password" autocomplete="new-password"><label for="lock-minutes">Blokada po minutach bezczynności</label><input id="lock-minutes" type="number" min="1" max="120" value="${sessionLock?.minutes||15}"><div class="actions"><button id="lock-save">${sessionLock?'Zmień ustawienia / hasło':'Włącz blokadę'}</button>${sessionLock?'<button id="lock-disable">Wyłącz blokadę</button><button data-action="lock">Zablokuj teraz</button>':''}</div></section><section class="panel"><h2>Szyfrowany backup</h2><p>Opcja w oknie pełnego backupu: AES-256-GCM, PBKDF2-SHA-256 (600 000 iteracji), losowy salt i nowy IV dla każdej kopii.</p><p>Szyfrowanie obejmuje eksport, także załączniki. Lokalna baza i szkice nie są zaszyfrowane. Nie ma odzyskiwania hasła backupu.</p><h3>Dane demonstracyjne</h3><p>Fikcyjna sprawa „Projekt Latarnia”.</p><div class="actions"><button data-action="demo">Dodaj dane demo</button><button data-action="remove-demo" class="danger">Usuń dane demo</button></div><p class="progress-note">Usuwanie demo zostanie zatrzymane, jeżeli Twoje rekordy odwołują się do jego danych.</p></section></div>`;
  $('#theme-setting').onchange = async e => {
    await db.setting('theme', e.target.value);
    applyTheme(e.target.value);
  };
  $('#backup-days').onchange = async e => {
    const n = Math.max(1, Math.min(90, +e.target.value || 7));
    e.target.value = n;
    await db.setting('backupDays', n);
    toast('Zapisano termin przypomnienia');
  };
  $('#persist-storage').onclick = async () => {
    const yes = await navigator.storage?.persist?.();
    toast(yes ? 'Przeglądarka przyznała trwałe przechowywanie.' :
      'Przeglądarka nie przyznała trwałej pamięci. Zachowuj kopie poza aplikacją.');
    await settingsView();
  };
  $('#case-export').onclick = () => backupDialog(state.scope);
  $('#csv-export').onclick = async () => {
    exportCSV(rows('', {
      allCases: $('#export-scope').value === 'all'
    }));
    await db.addLog('Eksport CSV', state.records.get(state.scope));
    toast('Pobrano CSV');
  };
  $('#md-export').onclick = async () => {
    exportMarkdown(rows('', {
      allCases: $('#export-scope').value === 'all'
    }));
    await db.addLog('Eksport Markdown', state.records.get(state.scope));
    toast('Pobrano Markdown');
  };
  $('#lock-save').onclick = async () => {
    try {
      await configureLock($('#lock-password').value, $('#lock-minutes').value);
      toast('Zapisano blokadę');
      await settingsView();
    } catch (e) {
      errorMessage(e);
    }
  };
  if ($('#lock-disable')) $('#lock-disable').onclick = async () => {
    try {
      await disableLock($('#lock-password').value);
      toast('Wyłączono blokadę');
      await settingsView();
    } catch (e) {
      errorMessage(e);
    }
  };
}
export function applyTheme(theme) {
  const dark = theme === 'dark' || theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export async function backupDialog(caseId = '') {
  const d = dialog(caseId ? 'Eksport sprawy / rekordu' : 'Pełna kopia bezpieczeństwa',
    `<p>Eksport obejmuje oryginalne pliki, ich hashe, historię i szkice.${caseId?' Dołączone zostaną rekordy wskazane w odwołaniach, także spoza tej sprawy.':''}</p><label for="backup-format">Format kopii</label><select id="backup-format" style="width:100%;margin:8px 0 16px"><option value="json">Jeden plik JSON</option><option value="parts">Pełny backup w częściach (duże archiwum)</option></select><label><input type="checkbox" id="backup-encrypt"> Zaszyfruj kopię hasłem</label><div id="backup-password-fields" hidden><label for="backup-password">Hasło (minimum 12 znaków)</label><input id="backup-password" type="password" autocomplete="new-password" style="width:100%;margin:8px 0"><label for="backup-confirm">Powtórz hasło</label><input id="backup-confirm" type="password" autocomplete="new-password" style="width:100%;margin:8px 0"><p class="notice warning">Zachowaj hasło poza aplikacją. Bez niego nie można odtworzyć tej kopii.</p></div><p id="backup-progress" role="status" class="progress-note"></p>`,
    `<button data-backup-cancel>Anuluj</button><button class="primary" id="backup-download">Pobierz kopię</button>`
    );
  $('#backup-encrypt').onchange = e => $('#backup-password-fields').hidden = !e.target.checked;
  d.querySelector('[data-backup-cancel]').onclick = () => d.close();
  $('#backup-download').onclick = async () => {
    const button = $('#backup-download');
    const password = $('#backup-encrypt').checked ? $('#backup-password').value : '';
    if ($('#backup-encrypt').checked && (password.length < 12 || password !== $('#backup-confirm')
        .value)) {
      toast('Hasło musi mieć minimum 12 znaków, a oba pola muszą być zgodne.', true);
      return;
    }
    button.disabled = true;
    d.querySelector('[data-close]').disabled = true;
    d.querySelector('[data-backup-cancel]').disabled = true;
    d.oncancel = e => e.preventDefault();
    try {
      $('#backup-progress').textContent = 'Przygotowywanie danych…';
      if ($('#backup-format').value === 'parts') {
        const bundle = await createBundle(caseId);
        d.close();
        setTimeout(() => multipartDialog(bundle, password, caseId).catch(errorMessage), 0);
        return;
      }
      await exportBackup({
        caseId,
        password,
        onProgress: s => $('#backup-progress').textContent = s
      });
      d.close();
      toast('Pobrano kopię. Sprawdź zapis pliku w wybranym folderze.');
      window.dispatchEvent(new CustomEvent('refresh-view'));
    } catch (e) {
      $('#backup-progress').textContent = e.message;
      errorMessage(e);
    } finally {
      button.disabled = false;
      d.querySelector('[data-close]').disabled = false;
      d.querySelector('[data-backup-cancel]').disabled = false;
      d.oncancel = null;
    }
  };
}
export async function importDialog() {
  const d = dialog('Import danych',
    `<label for="import-file">Backup / sprawa / rekordy (JSON); dla kopii w częściach zaznacz manifest i wszystkie części</label><input id="import-file" type="file" multiple accept=".json,application/json" style="width:100%;margin:10px 0"><label for="import-password">Hasło (tylko dla kopii szyfrowanej)</label><input id="import-password" type="password" autocomplete="off" style="width:100%;margin:10px 0"><p id="import-status" role="status" class="progress-note"></p><div id="import-preview"></div>`,
    `<button data-import-cancel>Anuluj</button><button class="primary" id="import-validate">Sprawdź plik</button><button class="primary" id="import-confirm" hidden>Importuj sprawdzone dane</button>`
    );
  let validated = null;
  d.querySelector('[data-import-cancel]').onclick = () => d.close();
  const reset = () => {
    validated = null;
    $('#import-confirm').hidden = true;
    $('#import-validate').hidden = false;
    $('#import-preview').innerHTML = '';
  };
  $('#import-file').onchange = reset;
  $('#import-password').oninput = reset;
  $('#import-validate').onclick = async () => {
    const file = $('#import-file').files[0];
    if (!file) return toast('Wybierz plik JSON.', true);
    $('#import-validate').disabled = true;
    $('#import-status').textContent = 'Sprawdzanie danych i integralności plików…';
    try {
      validated = await parseImportFiles($('#import-file').files, $('#import-password').value, s => $(
        '#import-status').textContent = s);
      const collisions = validated.records.filter(r => state.records.has(r.id)).length;
      $('#import-preview').innerHTML =
        `<div class="notice"><strong>Walidacja zakończona</strong><br>${validated.records.length} rekordów · ${validated.blobs.length} plików · ${(validated.logs||[]).length} wpisów dziennika<br>${collisions} kolizji ID — te rekordy zostaną dodane jako nowe kopie.<br>Ustawienia bezpieczeństwa i hasła sesji nie są importowane.</div>`;
      $('#import-confirm').hidden = false;
      $('#import-validate').hidden = true;
      $('#import-status').textContent = 'Gotowe do importu.';
    } catch (e) {
      $('#import-status').textContent = e.message;
      errorMessage(e);
    } finally {
      $('#import-validate').disabled = false;
    }
  };
  $('#import-confirm').onclick = async () => {
    if (!validated) return;
    $('#import-confirm').disabled = true;
    try {
      const result = await importBackup(validated);
      await reload();
      d.close();
      toast(`Zaimportowano ${result.count} rekordów. Kopie z nowymi ID: ${result.remapped}.`);
      window.dispatchEvent(new CustomEvent('refresh-view'));
    } catch (e) {
      errorMessage(e);
    } finally {
      $('#import-confirm').disabled = false;
    }
  };
}

async function multipartDialog(bundle, password, caseId) {
  const total = bundle.manifest.parts.length + 1;
  const d = dialog('Pobierz wszystkie części kopii',
    `<p>Manifest zawiera rekordy i metadane. Części zawierają oryginalne pliki w porcjach do 16 MiB. Zapisz komplet w jednym folderze. Przy imporcie zaznacz wszystkie pliki razem.</p><p>Do pobrania: ${total} plików${password?' · całość zaszyfrowana':''}.</p><div id="bundle-downloads" class="record-list"><button id="bundle-manifest">1. Pobierz manifest</button>${bundle.manifest.parts.map((p,i)=>`<div style="margin-top:10px"><button data-part="${p.id}">${i+2}. ${escape(p.fileName)} · część ${p.index+1}/${p.count}</button></div>`).join('')}</div><p id="bundle-status" class="progress-note" role="status">Pobrano: 0 / ${total}</p>`,
    `<button id="bundle-finish" class="primary" disabled>Potwierdzam zapis całego kompletu</button>`);
  const completed = new Set();
  const update = () => {
    $('#bundle-status').textContent =
      `Pobrano: ${completed.size} / ${total}. Sprawdź pliki w wybranym folderze.`;
    $('#bundle-finish').disabled = completed.size !== total;
  };
  const run = async (button, id, fn) => {
    button.disabled = true;
    try {
      await fn();
      completed.add(id);
      button.textContent = '✓ ' + button.textContent.replace(/^✓ /, '');
      update();
    } catch (e) {
      errorMessage(e);
    } finally {
      button.disabled = false;
    }
  };
  $('#bundle-manifest').onclick = e => run(e.currentTarget, 'manifest', () => downloadBundleManifest(bundle,
    password));
  for (const button of d.querySelectorAll('[data-part]')) button.onclick = () => run(button, button.dataset
    .part, () => downloadBundlePart(bundle, bundle.manifest.parts.find(p => p.id === button.dataset.part),
      password));
  $('#bundle-finish').onclick = async () => {
    if (!caseId) await db.setting('lastBackup', new Date().toISOString());
    await db.addLog('Eksport kopii w częściach', state.records.get(caseId),
      `${total} plików; użytkownik potwierdził zapis kompletu`);
    d.close();
    toast('Zapisano informację o pełnym backupie');
    window.dispatchEvent(new CustomEvent('refresh-view'));
  };
}
