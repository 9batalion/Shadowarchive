import * as db from './db.js';
import * as search from './search.js';
export const state = {
  records: new Map(),
  scope: '',
  route: 'dashboard',
  lastUndo: null
};
export async function reload() {
  const rows = await db.all();
  state.records = new Map(rows.map(r => [r.id, r]));
  search.initialize(rows);
  return rows;
}
export function rows(kind, {
  allCases = false,
  trash = false
} = {}) {
  return Array.from(state.records.values()).filter(r => !!r.deletedAt === trash && (!kind || r.kind ===
    kind) && (allCases || !state.scope || r.id === state.scope || r.caseIds?.includes(state.scope)));
}
export function put(r) {
  state.records.set(r.id, r);
  search.update(r);
  window.dispatchEvent(new CustomEvent('records-changed', {
    detail: r
  }));
}
export async function save(r, opts) {
  const result = await db.save(r, opts);
  put(result);
  return result;
}
export function rememberUndo(record) {
  state.lastUndo = structuredClone(record);
  document.querySelector('#undo-button').disabled = false;
}
export async function undo() {
  const old = state.lastUndo;
  if (!old) return;
  const current = await db.get(old.id);
  if (!current) throw new Error('Rekord nie jest już dostępny.');
  if (current.revision !== old.revision + 1) throw new Error(
    'Rekord zmienił się po tej operacji. Aby zachować późniejsze zmiany, edytuj go ręcznie.');
  const result = await save({
    ...old,
    revision: current.revision
  }, {
    action: 'Cofnięcie operacji'
  });
  state.lastUndo = null;
  document.querySelector('#undo-button').disabled = true;
  return result;
}
