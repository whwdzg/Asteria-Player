/* Asteria Player service worker: network-first navigation, runtime asset cache. */
const VERSION = 'asteria-v1';
// Resolve every cache URL against the worker location so the same build works
// at a domain root and under a GitHub Pages project subpath.
const BASE = new URL('./', self.location.href);
const CORE = ['', 'index.html', 'manifest.webmanifest'].map((path) => new URL(path, BASE).href);

async function precache() {
  const cache = await caches.open(VERSION);
  const urls = new Set(CORE);
  try {
    const response = await fetch(new URL('sw-assets.json', BASE), { cache: 'no-store' });
    if (response.ok) {
      const manifest = await response.json();
      for (const asset of manifest.assets || []) {
        urls.add(new URL(asset, BASE).href);
      }
    }
  } catch {
    // The app still works online if the precache manifest is unavailable.
  }
  // Cache files independently: one missing optional asset must not abort install.
  await Promise.allSettled([...urls].map((url) => cache.add(url)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('asteria-') && key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isMedia(url) {
  return /\.(mp3|flac|wav|m4a|aac|ogg|opus|mp4|m4v|webm|mkv|mov|avi)$/i.test(url.pathname)
    || url.pathname.includes('/demo/audio/')
    || url.pathname.includes('/demo/video/');
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await cache.match(new URL('index.html', BASE).href);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await update) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range') || isMedia(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
