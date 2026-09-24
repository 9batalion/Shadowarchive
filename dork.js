import {
  state,
  rows,
  save
} from './state.js';
import {
  newRecord
} from './schema.js';
import {
  $,
  escape,
  heading,
  toast,
  localNow
} from './ui.js';
const quote = s => '"' + s.replace(/"/g, '').trim() + '"';
export function buildQuery(data) {
  const tokens = [],
    notes = [];
  const engine = data.engine || 'Google';
  for (const key of ['exact', 'person', 'organization'])
    if (data[key]?.trim()) tokens.push(quote(data[key]));
  if (data.domain?.trim()) tokens.push(quote(data.domain));
  if (data.site?.trim()) tokens.push('site:' + data.site.replace(/^https?:\/\//, '').replace(/\/$/, '')
  .trim());
  const alts = (data.alternatives || '').split(',').map(s => s.trim()).filter(Boolean);
  if (alts.length) {
    if (engine === 'DuckDuckGo') {
      notes.push('Alternatywy: DuckDuckGo nie gwarantuje operatora OR. Uruchom osobne zapytania dla: ' + alts
        .join(', '));
    } else tokens.push('(' + alts.map(quote).join(engine === 'Yandex' ? ' | ' : ' OR ') + ')');
  }
  if (data.filetype) {
    if (engine === 'Yandex' && !['pdf', 'xls', 'ods', 'rtf', 'ppt', 'odp', 'swf', 'odt', 'odg', 'doc']
      .includes(data.filetype)) notes.push(
      'Ten format nie jest wymieniony jako obsługiwany przez Yandex. Typ pliku pominięto.');
    else tokens.push((engine === 'Yandex' ? 'mime:' : 'filetype:') + data.filetype);
  }
  if (data.from || data.to) {
    if (engine === 'Google') {
      if (data.from) tokens.push('after:' + data.from);
      if (data.to) tokens.push('before:' + data.to);
      notes.push(
        'Granice after/before sprawdź w wynikach wyszukiwarki. Data indeksowania nie musi być datą zdarzenia.'
        );
    } else if (engine === 'Yandex') {
      const a = data.from?.replaceAll('-', ''),
        b = data.to?.replaceAll('-', '');
      tokens.push('date:' + (a && b ? a + '..' + b : a ? '>=' + a : '<=' + b));
    } else notes.push(
      `Zakres dat ${data.from||'od początku'} — ${data.to||'do dziś'} ustaw ręcznie w filtrach ${engine}. Nie dodano niepotwierdzonych operatorów dat.`
      );
  }
  if (data.language) {
    if (engine === 'Yandex') tokens.push('lang:' + data.language);
    else if (engine === 'Bing') tokens.push('language:' + data.language);
    else notes.push('Język ' + data.language + ' ustaw w preferencjach / filtrach wyszukiwarki.');
  }
  for (const s of (data.exclude || '').split(',').map(s => s.trim()).filter(Boolean)) tokens.push('-' + quote(
    s));
  return {
    query: tokens.join(' '),
    notes
  };
}
export function dorkView() {
  const engineOptions = ['Google', 'Yandex', 'Bing', 'Brave', 'DuckDuckGo'].map(v => `<option>${v}</option>`).join('');
  const caseOptions = rows('case', {allCases: true}).map(r => `<option value="${r.id}"${r.id === state.scope ? ' selected' : ''}>${escape(r.title)}</option>`).join('');
  const textFields = [['exact','Fraza dokładna'],['person','Osoba'],['organization','Organizacja'],['domain','Domena jako fraza'],['site','Ograniczenie site:'],['alternatives','Słowa alternatywne (przecinki)'],['exclude','Wykluczenia (przecinki)']].map(([n,l]) => `<div class="form-field"><label for="dork-${n}">${l}</label><input id="dork-${n}" name="${n}" autocomplete="off"></div>`).join('');
  const typeOptions = ['pdf','doc','docx','xls','xlsx','csv','txt','ppt','pptx','rtf','odt'].map(v => `<option>${v}</option>`).join('');
  const languages = [['pl','Polski'],['en','Angielski'],['ru','Rosyjski'],['uk','Ukraiński'],['de','Niemiecki'],['fr','Francuski']].map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
  $('#main').innerHTML = heading('Dork Builder', 'Zbuduj zapytanie, skopiuj je i wykonaj samodzielnie w wyszukiwarce.') + `
    <div class="detail-layout"><section class="panel"><form id="dork-form"><div class="form-grid">
      <div class="form-field"><label for="dork-engine">Wyszukiwarka</label><select name="engine" id="dork-engine">${engineOptions}</select></div>
      <div class="form-field"><label for="dork-case">Sprawa dla zapytania</label><select name="caseId" id="dork-case"><option value="">Bez przypisanej sprawy</option>${caseOptions}</select></div>
      ${textFields}
      <div class="form-field"><label for="dork-type">Typ pliku</label><select id="dork-type" name="filetype"><option value="">Dowolny</option>${typeOptions}</select></div>
      <div class="form-field"><label for="dork-from">Data od</label><input type="date" id="dork-from" name="from"></div>
      <div class="form-field"><label for="dork-to">Data do</label><input type="date" id="dork-to" name="to"></div>
      <div class="form-field"><label for="dork-language">Język</label><select id="dork-language" name="language"><option value="">Dowolny</option>${languages}</select></div>
    </div></form></section><aside><section class="panel"><h2>Gotowe zapytanie</h2><pre id="dork-output" class="code-query"></pre><div id="dork-notes"></div><div class="actions"><button class="primary" id="dork-copy">Kopiuj</button><button id="dork-save">Zapisz w Search Log</button></div><p class="progress-note">Zapis ma status „Zaplanowane”. Po wykonaniu wyszukiwania dopisz wynik i ustaw „Wykonane”.</p><div id="dork-duplicates"></div></section></aside></div>`;
  let result;
  const render = () => {
    const data = Object.fromEntries(new FormData($('#dork-form')));
    result = buildQuery(data);
    $('#dork-output').textContent = result.query || 'Wypełnij pola po lewej.';
    $('#dork-notes').innerHTML = result.notes.map(n => `<p class="notice warning">${escape(n)}</p>`).join(
      '');
    const same = rows('search', {
      allCases: true
    }).filter(r => r.query === result.query && r.engine === data.engine);
    $('#dork-duplicates').innerHTML = same.length ?
      `<div class="notice">To zapytanie jest już zapisane ${same.length} razy. Sprawdź Search Log przed powtórzeniem.</div>` :
      '';
  };
  $('#dork-form').onsubmit = e => e.preventDefault();
  $('#dork-form').oninput = render;
  $('#dork-copy').onclick = async () => {
    if (!result.query) return toast('Najpierw wypełnij zapytanie.');
    try {
      await navigator.clipboard.writeText(result.query);
      toast('Skopiowano zapytanie');
    } catch {
      const selection = window.getSelection(),
        range = document.createRange();
      range.selectNodeContents($('#dork-output'));
      selection.removeAllRanges();
      selection.addRange(range);
      toast('Zaznaczono zapytanie. Użyj systemowego Kopiuj.');
    }
  };
  $('#dork-save').onclick = async () => {
    if (!result.query) return toast('Wpisz treść zapytania.');
    const data = Object.fromEntries(new FormData($('#dork-form'))),
      r = newRecord('search', data.caseId);
    r.title = result.query.slice(0, 140);
    r.query = result.query;
    r.engine = data.engine;
    r.result = result.notes.join('\n');
    r.dorkParameters = data;
    await save(r);
    toast('Zapisano zaplanowane zapytanie');
    render();
  };
  render();
}
