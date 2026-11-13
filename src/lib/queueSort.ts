import type { Track } from './types';

export type QueueSort = 'added' | 'title' | 'album' | 'artist';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function titleCompare(a: Track, b: Track): number {
  return collator.compare(a.title, b.title);
}

/** Stable playlist ordering shared by the all-sequence and custom playlists. */
export function sortQueueTracks(tracks: Track[], mode: QueueSort): Track[] {
  const ordered = [...tracks];
  ordered.sort((a, b) => {
    if (mode === 'added') {
      const difference = (a.addedAt ?? 0) - (b.addedAt ?? 0);
      return difference || titleCompare(a, b);
    }
    if (mode === 'album') {
      return collator.compare(a.album ?? '\uffff', b.album ?? '\uffff') || titleCompare(a, b);
    }
    if (mode === 'artist') {
      return collator.compare(a.artist, b.artist) || titleCompare(a, b);
    }
    return titleCompare(a, b) || collator.compare(a.artist, b.artist);
  });
  return ordered;
}
