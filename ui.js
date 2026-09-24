import {
  SCHEMA,
  EPI
} from './schema.js';
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
export const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [c]));
export const safeURL = s => {
  try {
    const u = new URL(s);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
};
const paths = {
  folder: 'M3 7h6l2-3h10v16H3z',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 6 0 0 1 16 0v3',
  building: 'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M8 21v-3h4v3',
  link: 'M10 14l4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  file: 'M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h6',
  camera: 'M3 7h5l2-3h4l2 3h5v14H3zM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  play: 'M5 3v18l16-9z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l4 2',
  graph: 'M9 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0M14 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 7l7 1M7 8l3 9M17 11l-4 6',
  bulb: 'M8 16a7 7 0 1 1 8 0v3H8zM9 22h6M12 12v6',
  split: 'M5 3v6c0 5 14 1 14 7v5M19 3v6c0 5-14 1-14 7v5M2 18l3 3 3-3M16 18l3 3 3-3',
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M16 8l-3 5-5 3 3-5z',
  check: 'M4 12l5 5L20 5M20 13v8H3V4h11',
  note: 'M4 3h16v18H4zM8 7h8M8 11h8M8 15h5',
  quote: 'M4 6h6v7H5l-1 5M14 6h6v7h-5l-1 5',
  flag: 'M5 22V3h14l-3 5 3 5H5',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-6 5-6 13 0 18M12 3c6 5 6 13 0 18',
  pin: 'M15 4l5 5-4 2-2 6-3-3-7 7 7-7-4-4 6-2z',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M15 15l6 6',
  list: 'M7 5h14M7 12h14M7 19h14M3 5h.1M3 12h.1M3 19h.1',
  timer: 'M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 9v5l3 2M9 2h6M12 2v4',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  shield: 'M12 2l9 4v7c0 5-9 9-9 9s-9-4-9-9V6zM7 12l3 3 7-7',
  settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 2h6l1 4 4 1 2 5-3 3v5l-5 2-3-3H6l-4-4 2-4-1-5 5-1z',
  trash: 'M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M9 10v7M15 10v7',
  chart: 'M3 3v18h19M7 16l4-6 4 3 6-9',
  download: 'M12 3v12M6 9l6 6 6-6M3 16v5h18v-5',
  arrow: 'M5 12h14M14 7l5 5-5 5',
  plus: 'M12 4v16M4 12h16',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4zM12 14v4'
};
export const icon = name =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.file}"/></svg>`;
export const fmtDate = (value, withTime = false) => {
  if (!value) return 'Brak daty';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? String(value) : new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    ...(withTime ? {
      timeStyle: 'short'
    } : {})
  }).format(d);
};
export const bytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(1)} KiB` :
  `${(n/1048576).toFixed(1)} MiB`;
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function badge(value) {
  const s = String(value || '');
  const cl = s === EPI[3] || s === 'POTWIERDZONY FAKT' ? 'fact' : s === EPI[2] ? 'hypothesis' : s === EPI[1] ?
    'claim' : s === EPI[4] ? 'conclusion' : /obalon|sprzeczn/i.test(s) ? 'danger' :
    /nieweryfik|now|sprawdzeni/i.test(s) ? 'unknown' : 'neutral';
  return s ? `<span class="badge ${cl}">${escape(s)}</span>` : '';
}
export const linkRecord = r => r ?
  `<a href="#record/${encodeURIComponent(r.id)}">${escape(r.title||'Bez tytułu')}${r.deletedAt?' (w koszu)':''}</a>` :
  '<span class="muted">Brak rekordu</span>';
export const tags = items => (items || []).map(t =>
  `<a class="chip" href="#search?q=${encodeURIComponent('#'+t)}">#${escape(t)}</a>`).join('');
export const empty = (title, message, action = '') =>
  `<div class="empty">${icon('folder')}<h3>${escape(title)}</h3><p>${escape(message)}</p>${action}</div>`;
export const heading = (title, subtitle = '', actions = '') =>
  `<div class="page-heading"><div><div class="eyebrow">Archiwum badawcze</div><h1>${escape(title)}</h1>${subtitle?`<p>${escape(subtitle)}</p>`:''}</div><div class="actions">${actions}</div></div>`;
export const addButton = kind =>
  `<button class="primary" data-action="add" data-kind="${kind}">${icon('plus')} Dodaj ${kind==='person'?'osobę':kind==='case'?'sprawę':kind==='source'?'źródło':'rekord'}</button>`;
let toastTimer;
export function toast(message, error = false) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  el.style.background = error ? '#943146' : '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.hidden = true, error ? 8500 : 4200);
}
export function errorMessage(e) {
  console.error(e);
  toast(e?.message || String(e), true);
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function dialog(title, html, footer = '') {
  const el = $('#utility-dialog');
  if (el.open) el.close();
  el.innerHTML =
    `<div class="dialog-head"><h2 id="utility-title">${escape(title)}</h2><button data-close aria-label="Zamknij">×</button></div><div class="dialog-body">${html}</div>${footer?`<div class="dialog-foot">${footer}</div>`:''}`;
  el.querySelector('[data-close]').onclick = () => el.close();
  el.showModal();
  return el;
}
export async function confirmAction(title, message, button = 'Potwierdź') {
  return new Promise(resolve => {
    const d = dialog(title, `<p>${escape(message)}</p>`,
      `<button data-no>Anuluj</button><button class="primary" data-yes>${escape(button)}</button>`);
    let yes = false;
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = () => {
      yes = true;
      d.close();
    };
    d.addEventListener('close', () => resolve(yes), {
      once: true
    });
  });
}
/** Minimal Markdown renderer: no raw HTML, images or arbitrary URL schemes. */
export function markdown(text, records = new Map()) {
  const safeInline = s => {
    const tokens = [];
    const token = html => {
      tokens.push(html);
      return '\u0000' + (tokens.length - 1) + '\u0000';
    };
    let out = String(s).replace(/`([^`]+)`/g, (_, v) => token(`<code>${escape(v)}</code>`)).replace(
      /\[\[(?:(Person|Source|Company|Case|Note|Record):)?([^\]]+)\]\]/gi, (_, kind, id) => {
        const r = records.get(id);
        return token(r ? linkRecord(r) :
          `<span class="muted">[[${escape(kind?kind+':':'')}${escape(id)}]]</span>`);
      }).replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, url) => token(safeURL(url) ?
      `<a href="${escape(safeURL(url))}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>` :
      escape(label)));
    out = escape(out).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g,
      '<em>$1</em>');
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[+i]);
  };
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let html = '',
    i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      html += `<pre><code>${escape(code.join('\n'))}</code></pre>`;
      i++;
      continue;
    }
    if (/^#{1,6} /.test(l)) {
      const level = l.match(/^#+/)[0].length;
      html += `<h${level}>${safeInline(l.slice(level+1))}</h${level}>`;
      i++;
      continue;
    }
    if (i + 1 < lines.length && l.includes('|') && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const cells = s => s.replace(/^\||\|$/g, '').split('|').map(x => x.trim());
      html += '<table><thead><tr>' + cells(l).map(c => `<th>${safeInline(c)}</th>`).join('') +
        '</tr></thead><tbody>';
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        html += '<tr>' + cells(lines[i++]).map(c => `<td>${safeInline(c)}</td>`).join('') + '</tr>';
      }
      html += '</tbody></table>';
      continue;
    }
    if (/^\s*([-*]|\d+\.) /.test(l)) {
      const ordered = /^\s*\d+\./.test(l),
        tag = ordered ? 'ol' : 'ul';
      html += `<${tag}>`;
      while (i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i])) html +=
        `<li>${safeInline(lines[i++].replace(/^\s*([-*]|\d+\.) /,''))}</li>`;
      html += `</${tag}>`;
      continue;
    }
    if (l.startsWith('> ')) {
      html += `<blockquote>${safeInline(l.slice(2))}</blockquote>`;
      i++;
      continue;
    }
    if (!l.trim()) {
      i++;
      continue;
    }
    const p = [];
    do {
      p.push(safeInline(lines[i++]));
    } while (i < lines.length && lines[i].trim() && !/^(#|>|```|[-*] |\d+\. )/.test(lines[i]));
    html += `<p>${p.join('<br>')}</p>`;
  }
  return `<div class="markdown">${html}</div>`;
}
export const recordType = r => SCHEMA[r?.kind]?.single || 'Rekord';
