import type { Track } from './types';

export type MediaCheckReason = 'error' | 'timeout' | 'aborted';

export interface InvalidMedia {
  track: Track;
  reason: Exclude<MediaCheckReason, 'aborted'>;
}

interface CheckOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/** Probe a media URL without appending an element or starting playback. */
export function checkTrackReadable(track: Track, options: CheckOptions = {}): Promise<MediaCheckReason | null> {
  const timeout = options.timeout ?? 6000;
  if (!track.src) return Promise.resolve('error');
  return new Promise((resolve) => {
    const element = document.createElement(track.kind === 'video' ? 'video' : 'audio');
    element.preload = 'metadata';
    element.muted = true;
    let settled = false;

    const finish = (reason: MediaCheckReason | null): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      element.removeAttribute('src');
      element.load();
      resolve(reason);
    };
    const onAbort = (): void => finish('aborted');
    const timer = window.setTimeout(() => finish('timeout'), timeout);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    element.addEventListener('loadedmetadata', () => finish(null), { once: true });
    element.addEventListener('error', () => finish('error'), { once: true });
    element.src = track.src;
    element.load();
  });
}

/** Check a batch of tracks with bounded concurrency and progress reporting. */
export async function findUnreadableTracks(
  tracks: Track[],
  options: CheckOptions & {
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<InvalidMedia[]> {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const invalid: InvalidMedia[] = [];
  let next = 0;
  let done = 0;

  const worker = async (): Promise<void> => {
    while (next < tracks.length) {
      if (options.signal?.aborted) return;
      const index = next;
      next += 1;
      const track = tracks[index];
      const reason = await checkTrackReadable(track, options);
      if (reason === 'error' || reason === 'timeout') invalid.push({ track, reason });
      done += 1;
      options.onProgress?.(done, tracks.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, tracks.length) }, worker));
  return invalid;
}
