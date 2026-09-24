import {
  SCHEMA
} from './schema.js';
import {
  state,
  rows
} from './state.js';
import {
  $,
  escape,
  heading,
  addButton,
  linkRecord,
  badge
} from './ui.js';
import {
  caseTabs
} from './views.js';
let cleanup = () => {};
const colors = {
  person: '#497cd2',
  organization: '#299990',
  source: '#c59042',
  document: '#8864b4',
  event: '#ba667b',
  case: '#536880',
  domain: '#548c62',
  location: '#bd7847',
  profile: '#637fba',
  website: '#529ba8',
  media: '#8b6fad',
  evidence: '#6d80a1'
};
export function destroyGraph() {
  cleanup();
  cleanup = () => {};
}
export function graphView() {
  destroyGraph();
  const relations = rows('relation');
  $('#main').innerHTML = heading('Mapa powiązań',
      'Wyłącznie relacje dodane ręcznie. Kliknij węzeł lub linię, aby sprawdzić jej pochodzenie.', addButton(
        'relation')) + (state.scope ? caseTabs(state.scope, 'graph') : '') +
    `<div class="toolbar"><input id="graph-query" type="search" placeholder="Nazwa węzła — jego bezpośrednie otoczenie" aria-label="Filtr węzłów grafu"><select id="graph-limit" aria-label="Maksymalna liczba węzłów"><option>60</option><option>120</option><option>250</option></select><button id="graph-minus" aria-label="Oddal graf">−</button><button id="graph-plus" aria-label="Przybliż graf">＋</button><button id="graph-reset">Dopasuj widok</button></div><p class="progress-note" id="graph-count"></p><div class="graph-wrap"><canvas id="graph-canvas" tabindex="0" aria-label="Interaktywny graf relacji. Przeciągnij węzeł, tło lub użyj przycisków przybliżania. Dostępna lista tekstowa poniżej."></canvas><div class="graph-help">Przeciągnij węzeł lub tło · kółko myszy: zoom</div></div><div id="graph-inspector" class="panel section-space"><p class="muted">Wybierz węzeł lub relację.</p></div><details class="section-space"><summary>Lista relacji dostępna z klawiatury</summary><div id="graph-accessible"></div></details>`;
  const canvas = $('#graph-canvas'),
    ctx = canvas.getContext('2d');
  let nodes = [],
    edges = [],
    scale = 1,
    pan = {
      x: 0,
      y: 0
    },
    drag = null,
    last = null,
    moved = false,
    w = 0,
    h = 0,
    selected = null;
  const bg = () => getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
  const textColor = () => getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  const screen = n => ({
    x: w / 2 + pan.x + n.x * scale,
    y: h / 2 + pan.y + n.y * scale
  });

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg();
    ctx.fillRect(0, 0, w, h);
    for (const e of edges) {
      const a = screen(e.a),
        b = screen(e.b);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = e.record.sourceIds?.length ? '#98a9c0' : '#c4a76c';
      ctx.lineWidth = selected === e.record.id ? 3 : 1.2;
      ctx.setLineDash(e.record.sourceIds?.length ? [] : [5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const angle = Math.atan2(b.y - a.y, b.x - a.x),
        end = {
          x: b.x - Math.cos(angle) * 18,
          y: b.y - Math.sin(angle) * 18
        };
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - Math.cos(angle - .45) * 8, end.y - Math.sin(angle - .45) * 8);
      ctx.lineTo(end.x - Math.cos(angle + .45) * 8, end.y - Math.sin(angle + .45) * 8);
      ctx.fillStyle = '#98a9c0';
      ctx.fill();
    }
    for (const n of nodes) {
      const p = screen(n);
      ctx.beginPath();
      ctx.arc(p.x, p.y, selected === n.id ? 17 : 13, 0, Math.PI * 2);
      ctx.fillStyle = colors[n.record.kind] || '#74849a';
      ctx.fill();
      ctx.strokeStyle = bg();
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = textColor();
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      const name = n.record.title;
      ctx.fillText(name.length > 26 ? name.slice(0, 24) + '…' : name, p.x, p.y + 29);
    }
  }

  function select(id) {
    selected = id;
    const r = state.records.get(id);
    if (!r) return;
    $('#graph-inspector').innerHTML =
      `<h3>${linkRecord(r)}</h3><p>${escape(r.description||SCHEMA[r.kind].single)}</p>${badge(r.status||r.epistemic)}${r.kind==='relation'?`<p>${linkRecord(state.records.get(r.fromIds?.[0]))} → ${linkRecord(state.records.get(r.toIds?.[0]))}</p><p>Źródła: ${(r.sourceIds||[]).map(id=>linkRecord(state.records.get(id))).join(', ')||'Brak — wymaga uzupełnienia'}</p>`:''}<button data-action="edit" data-id="${escape(id)}">Edytuj kartę</button>`;
    draw();
  }

  function build() {
    const q = $('#graph-query').value.trim().toLowerCase(),
      limit = +$('#graph-limit').value;
    let rels = relations.filter(r => state.records.has(r.fromIds?.[0]) && state.records.has(r.toIds?.[0]) && !
      state.records.get(r.fromIds[0]).deletedAt && !state.records.get(r.toIds[0]).deletedAt);
    if (q) rels = rels.filter(r => [r.fromIds[0], r.toIds[0]].some(id => state.records.get(id).title
      .toLowerCase().includes(q)));
    const ids = new Set();
    const shown = [];
    for (const r of rels) {
      const [a, b] = [r.fromIds[0], r.toIds[0]];
      if (ids.size + Number(!ids.has(a)) + Number(!ids.has(b)) > limit) continue;
      ids.add(a);
      ids.add(b);
      shown.push(r);
      if (shown.length >= 700) break;
    }
    const degrees = new Map();
    for (const r of shown)
      for (const id of [r.fromIds[0], r.toIds[0]]) degrees.set(id, (degrees.get(id) || 0) + 1);
    const sorted = [...ids].sort((a, b) => (degrees.get(b) || 0) - (degrees.get(a) || 0));
    nodes = sorted.map((id, i) => {
      const a = i * 2.399963,
        rad = Math.sqrt(i) * 25;
      return {
        id,
        record: state.records.get(id),
        x: Math.cos(a) * rad,
        y: Math.sin(a) * rad
      };
    });
    const map = new Map(nodes.map(n => [n.id, n]));
    edges = shown.map(r => ({
      record: r,
      a: map.get(r.fromIds[0]),
      b: map.get(r.toIds[0])
    }));
    for (let step = 0; step < 80; step++) {
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j],
            dx = b.x - a.x,
            dy = b.y - a.y,
            d = Math.max(1, Math.hypot(dx, dy)),
            f = Math.min(2, 110 / (d * d));
          a.x -= dx * f;
          a.y -= dy * f;
          b.x += dx * f;
          b.y += dy * f;
        }
      for (const e of edges) {
        const dx = e.b.x - e.a.x,
          dy = e.b.y - e.a.y,
          d = Math.max(1, Math.hypot(dx, dy)),
          f = (d - 115) / d * .02;
        e.a.x += dx * f;
        e.a.y += dy * f;
        e.b.x -= dx * f;
        e.b.y -= dy * f;
      }
    }
    fit();
    $('#graph-count').textContent =
      `${nodes.length} węzłów · ${edges.length} widocznych relacji z ${rels.length}. Limit renderowania chroni płynność; zawęź nazwą lub sprawą. Linie przerywane: brak źródła.`;
    $('#graph-accessible').innerHTML = shown.map(r =>
        `<p>${linkRecord(r)} · ${linkRecord(state.records.get(r.fromIds[0]))} → ${linkRecord(state.records.get(r.toIds[0]))} ${badge(r.status)}</p>`
        ).join('') ||
      '<p class="muted">Brak relacji. Dodaj ją przyciskiem powyżej; współwystępowanie nie tworzy połączeń.</p>';
    draw();
  }

  function fit() {
    const maxX = Math.max(180, ...nodes.map(n => Math.abs(n.x))),
      maxY = Math.max(130, ...nodes.map(n => Math.abs(n.y)));
    scale = Math.min(1.4, (w - 100) / (maxX * 2), (h - 100) / (maxY * 2));
    pan = {
      x: 0,
      y: 0
    };
    draw();
  }
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    };
  };
  const hit = p => nodes.find(n => {
    const s = screen(n);
    return Math.hypot(s.x - p.x, s.y - p.y) < 22;
  });
  canvas.onpointerdown = e => {
    const p = pos(e);
    drag = hit(p) || 'pan';
    last = p;
    moved = false;
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = e => {
    if (!drag) return;
    const p = pos(e),
      dx = p.x - last.x,
      dy = p.y - last.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    if (drag === 'pan') {
      pan.x += dx;
      pan.y += dy;
    } else {
      drag.x += dx / scale;
      drag.y += dy / scale;
    }
    last = p;
    draw();
  };
  canvas.onpointerup = e => {
    if (!moved) {
      const p = pos(e),
        n = hit(p);
      if (n) select(n.id);
      else {
        const edge = edges.find(ed => {
          const a = screen(ed.a),
            b = screen(ed.b),
            dx = b.x - a.x,
            dy = b.y - a.y,
            t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
          return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < 7;
        });
        if (edge) select(edge.record.id);
      }
    }
    drag = null;
  };
  canvas.onpointercancel = () => drag = null;
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    scale = Math.max(.12, Math.min(5, scale * (e.deltaY > 0 ? .9 : 1.1)));
    draw();
  }, {
    passive: false
  });
  canvas.onkeydown = e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-'].includes(e.key)) {
      e.preventDefault();
      if (e.key === '+') scale *= 1.1;
      else if (e.key === '-') scale *= .9;
      else if (e.key === 'ArrowLeft') pan.x -= 25;
      else if (e.key === 'ArrowRight') pan.x += 25;
      else if (e.key === 'ArrowUp') pan.y -= 25;
      else pan.y += 25;
      draw();
    }
  };
  $('#graph-minus').onclick = () => {
    scale = Math.max(.12, scale * .8);
    draw();
  };
  $('#graph-plus').onclick = () => {
    scale = Math.min(5, scale * 1.2);
    draw();
  };
  $('#graph-reset').onclick = fit;
  let timer;
  $('#graph-query').oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(build, 200);
  };
  $('#graph-limit').onchange = build;
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  build();
  cleanup = () => {
    ro.disconnect();
    clearTimeout(timer);
  };
}
