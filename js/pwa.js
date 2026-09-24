import {
  $,
  toast
} from './ui.js';
import {
  flushEditor
} from './editor.js';
let registration, installPrompt;
export async function initPWA() {
  window.addEventListener('online', network);
  window.addEventListener('offline', network);
  network();
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
  });
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  try {
    registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), {
      scope: new URL('../', import.meta.url).pathname,
      updateViaCache: 'none'
    });
    if (registration.waiting) $('#update-banner').hidden = false;
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) $('#update-banner')
          .hidden = false;
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      if (sessionStorage.getItem('sa-update')) {
        sessionStorage.removeItem('sa-update');
        location.reload();
      }
    });
  } catch (e) {
    toast('Nie uruchomiono trybu offline: ' + e.message, true);
  }
}

function network() {
  $('#network-banner').hidden = navigator.onLine;
}
export async function applyUpdate() {
  await flushEditor();
  if (registration?.waiting) {
    sessionStorage.setItem('sa-update', '1');
    registration.waiting.postMessage({
      type: 'SKIP_WAITING'
    });
  }
}
export async function checkUpdate() {
  if (!navigator.onLine) return toast('Sprawdzenie aktualizacji wymaga połączenia.');
  if (!registration) return toast('Service Worker nie jest dostępny.', true);
  await registration.update();
  toast(registration.waiting ? 'Dostępna aktualizacja — użyj paska u góry.' :
    'Sprawdzono aktualizacje. Nowy pakiet, jeśli jest dostępny, pojawi się u góry po pobraniu.');
}
export async function install() {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
  } else toast(
    'iPhone / iPad: Safari → Udostępnij → Do ekranu początkowego. Desktop / Android: użyj opcji instalacji w menu przeglądarki.'
    );
}
