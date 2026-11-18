// Wersja testowa: najpierw uruchamiamy service worker (udaje backend), dopiero potem aplikację.
export async function ready() {
  if (!('serviceWorker' in navigator)) {
    document.body.innerHTML = '<p style="font-family:sans-serif;padding:40px">Ta przeglądarka nie obsługuje wersji testowej (service worker). Otwórz stronę w Chrome, Edge, Firefox lub Safari.</p>';
    throw new Error('brak service workera');
  }
  const base = new URL('./', import.meta.url);
  await navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname });
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return;
  const ok = await Promise.race([
    new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', () => r(true), { once: true })),
    new Promise((r) => setTimeout(() => r(false), 2000)),
  ]);
  if (!ok) {
    // np. po Ctrl+Shift+R strona omija service workera – zwykłe przeładowanie to naprawia
    if (!sessionStorage.getItem('kd-test-reload')) { sessionStorage.setItem('kd-test-reload', '1'); location.reload(); }
    throw new Error('service worker nie przejął strony');
  }
}
