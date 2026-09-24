import * as db from './db.js';
import {
  passwordProof,
  base64,
  unbase64
} from './crypto.js';
import {
  $,
  escape,
  toast
} from './ui.js';
import {
  flushEditor
} from './editor.js';
let config = null,
  lastActivity = Date.now(),
  timer = null,
  locked = false;
export async function initLock() {
  config = await db.setting('sessionLock');
  if (config) await lock();
  for (const type of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(type, () =>
    lastActivity = Date.now(), {
      passive: true
    });
  timer = setInterval(() => {
    if (config && !locked && Date.now() - lastActivity > config.minutes * 60000) lock();
  }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (config && document.visibilityState === 'visible' && Date.now() - lastActivity > config.minutes *
      60000) lock();
  });
}
export async function configureLock(password, minutes) {
  if (password.length < 6) throw new Error('Hasło blokady musi mieć co najmniej 6 znaków.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  config = {
    salt: base64(salt),
    proof: await passwordProof(password, salt),
    minutes: Math.max(1, Math.min(120, +minutes || 15))
  };
  await db.setting('sessionLock', config);
  lastActivity = Date.now();
}
export async function disableLock(password) {
  if (!config) return;
  if (await passwordProof(password, unbase64(config.salt)) !== config.proof) throw new Error(
    'Nieprawidłowe hasło blokady');
  config = null;
  await db.setting('sessionLock', null);
}
export async function lock() {
  if (!config) {
    toast('Najpierw ustaw hasło blokady w Ustawieniach.');
    return;
  }
  if (locked) return;
  await flushEditor().catch(() => {});
  locked = true;
  $('#app-shell').inert = true;
  const d = $('#lock-dialog');
  d.innerHTML =
    `<div class="dialog-head"><h2 id="lock-title">Archiwum zablokowane</h2></div><form id="unlock-form"><div class="dialog-body"><p>Wprowadź hasło sesji, aby wrócić do pracy.</p><label for="unlock-password">Hasło blokady</label><input id="unlock-password" type="password" autocomplete="current-password" required style="width:100%;margin-top:8px"><p id="unlock-message" role="alert"></p><p class="progress-note">Blokada zasłania interfejs. Lokalna baza nie jest zaszyfrowana.</p></div><div class="dialog-foot"><button class="primary" type="submit">Odblokuj</button></div></form>`;
  d.oncancel = e => e.preventDefault();
  d.showModal();
  $('#unlock-password').focus();
  $('#unlock-form').onsubmit = async e => {
    e.preventDefault();
    const p = $('#unlock-password').value;
    const button = d.querySelector('button');
    button.disabled = true;
    try {
      if (await passwordProof(p, unbase64(config.salt)) !== config.proof) {
        $('#unlock-message').textContent = 'Nieprawidłowe hasło';
        return;
      }
      locked = false;
      lastActivity = Date.now();
      $('#app-shell').inert = false;
      d.close();
      d.innerHTML = '';
    } finally {
      button.disabled = false;
    }
  };
}
export const isLocked = () => locked;
