import { clearMediaCaches } from './media';

/**
 * Clear runtime parsed-media caches and the service-worker asset cache. User
 * settings, language packs and playlists are intentionally left untouched.
 */
export async function clearApplicationCaches(): Promise<void> {
  clearMediaCaches();
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (error) {
    console.warn('Cache storage clear failed', error);
  }
}
