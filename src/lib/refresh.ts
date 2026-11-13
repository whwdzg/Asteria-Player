/**
 * Force a fresh app boot: verify the active language resources, ask the
 * service worker to update, clear runtime caches and reload with a cache-busting
 * query. This keeps the active language JSON and hashed JS assets in sync.
 */
export async function refreshWithLatest(language: string): Promise<void> {
  const base = document.baseURI;
  const token = Date.now().toString();
  const paths = [
    '',
    'index.html',
    'locales/manifest.json',
    `locales/${encodeURIComponent(language)}.json`,
    'sw-assets.json',
  ];
  await Promise.all(paths.map(async (path) => {
    const url = new URL(path, base);
    url.searchParams.set('__update', token);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${path || 'index.html'}`);
  }));

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  }

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  const next = new URL(window.location.href);
  next.searchParams.set('__update', token);
  window.location.replace(next.toString());
}
