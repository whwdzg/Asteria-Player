import type { Track } from './types';
import { getPwaLibraryUsage } from './pwaLibrary';

export interface StorageUsage {
  media: number;
  covers: number;
  sidecars: number;
  pwa: number;
  cache: number;
  settings: number;
  other: number;
  total: number;
  quota: number;
  persisted: boolean;
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes)} B`;
}

function textBytes(value: string | undefined): number {
  if (!value) return 0;
  return new Blob([value]).size;
}

function dataUrlBytes(value: string): number {
  if (!value.startsWith('data:')) return 0;
  const comma = value.indexOf(',');
  if (comma < 0) return 0;
  const payload = value.length - comma - 1;
  return value.slice(0, comma).includes(';base64')
    ? Math.floor(payload * 0.75) - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0)
    : payload;
}

async function blobSize(url: string | undefined): Promise<number> {
  if (!url?.startsWith('blob:')) return 0;
  try {
    const response = await fetch(url);
    if (!response.ok) return 0;
    return (await response.blob()).size;
  } catch {
    return 0;
  }
}

async function mapLimited<T, R>(items: readonly T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function cacheStorageBytes(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const names = await caches.keys();
    let total = 0;
    for (const name of names) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      const sizes = await mapLimited<Request, number>(requests, 6, async (request) => {
        const response = await cache.match(request);
        return response ? (await response.blob()).size : 0;
      });
      total += sizes.reduce((sum, size) => sum + size, 0);
    }
    return total;
  } catch {
    return 0;
  }
}

function localStorageBytes(): number {
  try {
    let total = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const value = localStorage.getItem(key) ?? '';
      total += textBytes(key) + textBytes(value);
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Measured app storage: imported media, artwork, sidecar text, the PWA
 * IndexedDB copy, Cache Storage and settings. Browser-reported usage/quota is
 * kept separate because local File handles are outside the origin quota.
 */
export async function measureStorageUsage(tracks: Track[]): Promise<StorageUsage> {
  const coverUrls = tracks
    .map((track) => track.cover)
    .filter((cover): cover is string => Boolean(cover && !cover.startsWith('http')));
  const [coverSizes, pwaUsage, cache, settings] = await Promise.all([
    mapLimited(coverUrls, 6, async (cover) => (cover.startsWith('blob:') ? blobSize(cover) : dataUrlBytes(cover))),
    getPwaLibraryUsage(),
    cacheStorageBytes(),
    Promise.resolve(localStorageBytes()),
  ]);

  let media = 0;
  for (const track of tracks) {
    if (track.fileSize) media += track.fileSize;
    else if (track.src.startsWith('blob:')) media += await blobSize(track.src);
  }

  const sidecars = tracks.reduce((sum, track) => (
    sum
    + textBytes(track.lyrics)
    + textBytes(track.embeddedLyrics)
    + textBytes(track.translation)
    + textBytes(track.danmakuText)
    + (track.subtitles ?? []).reduce((subtotal, subtitle) => subtotal + textBytes(subtitle.text), 0)
  ), 0);

  const covers = coverSizes.reduce((sum, size) => sum + size, 0);
  const pwa = pwaUsage.media + pwaUsage.covers + pwaUsage.metadata;
  let estimateUsage = 0;
  let quota = 0;
  let persisted = false;
  try {
    const estimate = await navigator.storage?.estimate?.();
    estimateUsage = estimate?.usage ?? 0;
    quota = estimate?.quota ?? 0;
    persisted = (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    // Storage estimation can be unavailable in private contexts.
  }

  const browserKnown = pwa + cache + settings;
  const total = estimateUsage || browserKnown;
  return {
    media,
    covers,
    sidecars,
    pwa,
    cache,
    settings,
    other: Math.max(0, total - browserKnown),
    total,
    quota,
    persisted,
  };
}
