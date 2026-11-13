import type { Track } from './types';
import { useLibraryStore } from '../state/library';

const DB_NAME = 'asteria-pwa-library';
const DB_VERSION = 1;
const TRACK_STORE = 'tracks';
const META_STORE = 'meta';
const SESSION_KEY = 'session';

interface StoredTrack {
  id: string;
  track: Omit<Track, 'src' | 'cover'> & { src?: string; cover?: string };
  media?: Blob;
  coverBlob?: Blob;
}

interface StoredSession {
  key: typeof SESSION_KEY;
  queue: string[];
  currentId: string | null;
  sequenceId: string;
  savedAt: number;
}

export interface PwaLibraryUsage {
  media: number;
  covers: number;
  metadata: number;
}

export interface RestoredPwaLibrary {
  tracks: Track[];
  session: StoredSession | null;
}

/** Installed PWA windows only; an ordinary browser tab keeps the old behaviour. */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches
    || navigatorWithStandalone.standalone === true;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACK_STORE)) db.createObjectStore(TRACK_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function blobFromUrl(url: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    return await response.blob();
  } catch {
    return undefined;
  }
}

async function persistTrack(track: Track): Promise<void> {
  if (track.source === 'demo') return;
  const db = await openDatabase();
  const { src, cover, ...metadata } = track;
  let media: Blob | undefined;
  let remoteSrc = src;
  if (src.startsWith('blob:')) {
    media = await blobFromUrl(src);
    if (!media) return;
    remoteSrc = '';
  }
  let coverBlob: Blob | undefined;
  let coverValue = cover;
  if (cover?.startsWith('blob:')) {
    coverBlob = await blobFromUrl(cover);
    coverValue = coverBlob ? undefined : cover;
  }
  if (!useLibraryStore.getState().tracks.some((item) => item.id === track.id)) return;
  const record: StoredTrack = {
    id: track.id,
    track: { ...metadata, src: remoteSrc, cover: coverValue },
    media,
    coverBlob,
  };
  const transaction = db.transaction(TRACK_STORE, 'readwrite');
  transaction.objectStore(TRACK_STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed'));
  });
}

async function deleteTrack(id: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(TRACK_STORE, 'readwrite');
  transaction.objectStore(TRACK_STORE).delete(id);
  await new Promise<void>((resolve) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

async function saveSession(): Promise<void> {
  const state = useLibraryStore.getState();
  const db = await openDatabase();
  const session: StoredSession = {
    key: SESSION_KEY,
    queue: state.queue,
    currentId: state.currentId,
    sequenceId: state.sequenceId,
    savedAt: Date.now(),
  };
  const transaction = db.transaction(META_STORE, 'readwrite');
  transaction.objectStore(META_STORE).put(session);
  await new Promise<void>((resolve) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

/** Restore session-only tracks from IndexedDB when the app is running as a PWA. */
export async function restorePwaLibrary(): Promise<RestoredPwaLibrary | null> {
  if (!isPwaStandalone()) return null;
  try {
    const db = await openDatabase();
    const transaction = db.transaction([TRACK_STORE, META_STORE], 'readonly');
    // Issue both requests before awaiting: an IDB transaction becomes inactive
    // once its request queue empties.
    const tracksRequest = transaction.objectStore(TRACK_STORE).getAll() as IDBRequest<StoredTrack[]>;
    const sessionRequest = transaction.objectStore(META_STORE).get(SESSION_KEY) as IDBRequest<StoredSession | undefined>;
    const records = await requestResult(tracksRequest);
    const session = await requestResult(sessionRequest);
    const tracks: Track[] = [];
    for (const record of records) {
      const src = record.media ? URL.createObjectURL(record.media) : record.track.src;
      if (!src) continue;
      tracks.push({
        ...record.track,
        src,
        cover: record.coverBlob ? URL.createObjectURL(record.coverBlob) : record.track.cover,
      });
    }
    if (!tracks.length) return null;
    return { tracks, session: session ?? null };
  } catch (error) {
    console.warn('PWA library restore failed', error);
    return null;
  }
}

/**
 * Persist only installed-PWA sessions. Normal browser tabs keep the previous
 * session-only import behaviour. Writes are serialised so a quick add/remove
 * cannot resurrect a deleted track.
 */
export async function getPwaLibraryUsage(): Promise<PwaLibraryUsage> {
  const empty: PwaLibraryUsage = { media: 0, covers: 0, metadata: 0 };
  try {
    const db = await openDatabase();
    const transaction = db.transaction(TRACK_STORE, 'readonly');
    const records = await requestResult(
      transaction.objectStore(TRACK_STORE).getAll() as IDBRequest<StoredTrack[]>,
    );
    for (const record of records) {
      empty.media += record.media?.size ?? 0;
      empty.covers += record.coverBlob?.size ?? 0;
      empty.metadata += new Blob([JSON.stringify(record.track)]).size;
    }
  } catch {
    return empty;
  }
  return empty;
}

export async function clearPwaLibrary(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([TRACK_STORE, META_STORE], 'readwrite');
    transaction.objectStore(TRACK_STORE).clear();
    transaction.objectStore(META_STORE).clear();
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch (error) {
    console.warn('PWA library clear failed', error);
  }
}

export function startPwaLibraryPersistence(): (() => void) | undefined {
  if (!isPwaStandalone()) return undefined;
  void navigator.storage?.persist?.().catch?.(() => undefined);
  let previous = useLibraryStore.getState();
  let writeChain = Promise.resolve();
  const enqueue = (task: () => Promise<void>): void => {
    writeChain = writeChain.then(task).catch((error) => console.warn('PWA library write failed', error));
  };
  const unsubscribe = useLibraryStore.subscribe((state) => {
    if (state.tracks !== previous.tracks) {
      const currentById = new Map(state.tracks.map((track) => [track.id, track]));
      const previousById = new Map(previous.tracks.map((track) => [track.id, track]));
      for (const track of state.tracks) {
        if (previousById.get(track.id) !== track) enqueue(() => persistTrack(track));
      }
      for (const id of previousById.keys()) {
        if (!currentById.has(id)) enqueue(() => deleteTrack(id));
      }
    }
    if (state.queue !== previous.queue || state.currentId !== previous.currentId || state.sequenceId !== previous.sequenceId) {
      enqueue(saveSession);
    }
    previous = state;
  });
  enqueue(saveSession);
  return unsubscribe;
}
