import type { Track } from './types';

/**
 * Online metadata matching follows the workflow popularised by LDDC:
 * search several public catalogues, merge duplicate results, score them
 * against the local title/artist/duration, then let the user pick one.
 *
 * The two providers used here are deliberately browser-friendly:
 * - iTunes Search for artwork and album metadata (CORS enabled)
 * - LRCLIB for synced/plain lyrics (CORS enabled)
 *
 * No API keys or server-side credentials are required, and no result is
 * applied automatically.
 */
export type OnlineProvider = 'itunes' | 'lrclib';

export interface SongMatchCandidate {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  cover?: string;
  lyrics?: string;
  lyricsFormat?: 'lrc';
  providers: OnlineProvider[];
  score: number;
}

interface ItunesResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
}

interface LrclibResult {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const REQUEST_TIMEOUT = 12_000;

function timeoutSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal: timeoutSignal(signal),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function normalized(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\-_.·,，。!！?？'"“”‘’()[\]{}]/g, '');
}

function artworkUrl(url: string | undefined): string | undefined {
  if (!url || !url.startsWith('https://')) return undefined;
  return url.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, '/600x600bb.$1');
}

function durationScore(left?: number, right?: number): number {
  if (!left || !right) return 0;
  const difference = Math.abs(left - right);
  if (difference <= 3) return 0.2;
  if (difference <= 10) return 0.12;
  if (difference <= 25) return 0.05;
  return 0;
}

function scoreCandidate(candidate: Omit<SongMatchCandidate, 'score'>, track: Track): number {
  const title = normalized(track.title);
  const artist = normalized(track.artist);
  const candidateTitle = normalized(candidate.title);
  const candidateArtist = normalized(candidate.artist);
  let score = 0;
  if (title && candidateTitle === title) score += 0.45;
  else if (title && (candidateTitle.includes(title) || title.includes(candidateTitle))) score += 0.24;
  if (artist && candidateArtist === artist) score += 0.3;
  else if (artist && (candidateArtist.includes(artist) || artist.includes(candidateArtist))) score += 0.16;
  score += durationScore(track.duration, candidate.duration);
  if (candidate.cover) score += 0.03;
  if (candidate.lyrics) score += 0.02;
  return Math.min(1, score);
}

function mergeCandidates(candidates: SongMatchCandidate[]): SongMatchCandidate[] {
  const merged: SongMatchCandidate[] = [];
  for (const candidate of candidates) {
    const existing = merged.find((item) => (
      normalized(item.title) === normalized(candidate.title)
      && (
        !item.artist || !candidate.artist
        || normalized(item.artist).includes(normalized(candidate.artist))
        || normalized(candidate.artist).includes(normalized(item.artist))
      )
    ));
    if (!existing) {
      merged.push(candidate);
      continue;
    }
    existing.cover = existing.cover ?? candidate.cover;
    existing.lyrics = existing.lyrics ?? candidate.lyrics;
    existing.lyricsFormat = existing.lyricsFormat ?? candidate.lyricsFormat;
    existing.album = existing.album ?? candidate.album;
    existing.duration = existing.duration ?? candidate.duration;
    existing.providers = [...new Set([...existing.providers, ...candidate.providers])];
    existing.score = Math.max(existing.score, candidate.score);
  }
  return merged;
}

/** Search iTunes for artwork / metadata. */
async function searchItunes(track: Track, signal?: AbortSignal): Promise<SongMatchCandidate[]> {
  const params = new URLSearchParams({
    term: [track.title, track.artist].filter(Boolean).join(' '),
    entity: 'song',
    limit: '12',
  });
  const payload = await fetchJson<{ results?: ItunesResult[] }>(
    `https://itunes.apple.com/search?${params.toString()}`,
    signal,
  );
  return (payload.results ?? [])
    .filter((item) => item.trackName && item.artistName)
    .map((item) => {
      const candidate = {
        id: `itunes:${item.trackId ?? `${item.trackName}:${item.artistName}`}`,
        title: item.trackName ?? track.title,
        artist: item.artistName ?? '',
        album: item.collectionName,
        duration: item.trackTimeMillis ? item.trackTimeMillis / 1000 : undefined,
        cover: artworkUrl(item.artworkUrl100),
        providers: ['itunes' as const],
      };
      return { ...candidate, score: scoreCandidate(candidate, track) };
    });
}

/** Search LRCLIB for synced or plain lyrics. */
async function searchLrclib(track: Track, signal?: AbortSignal): Promise<SongMatchCandidate[]> {
  const params = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artist,
  });
  const payload = await fetchJson<LrclibResult[]>(
    `https://lrclib.net/api/search?${params.toString()}`,
    signal,
  );
  return payload
    .filter((item) => item.trackName && item.artistName && !item.instrumental)
    .slice(0, 10)
    .map((item) => {
      const candidate = {
        id: `lrclib:${item.id ?? `${item.trackName}:${item.artistName}`}`,
        title: item.trackName ?? track.title,
        artist: item.artistName ?? '',
        album: item.albumName,
        duration: item.duration,
        lyrics: item.syncedLyrics || item.plainLyrics || undefined,
        lyricsFormat: item.syncedLyrics ? 'lrc' as const : undefined,
        providers: ['lrclib' as const],
      };
      return { ...candidate, score: scoreCandidate(candidate, track) };
    });
}

/**
 * Runs both providers in parallel. A failure from one provider does not hide
 * usable results from the other; only a total failure is surfaced to the UI.
 */
export async function searchSongMatches(track: Track, signal?: AbortSignal): Promise<SongMatchCandidate[]> {
  const [itunes, lrclib] = await Promise.allSettled([
    searchItunes(track, signal),
    searchLrclib(track, signal),
  ]);
  const results = [
    ...(itunes.status === 'fulfilled' ? itunes.value : []),
    ...(lrclib.status === 'fulfilled' ? lrclib.value : []),
  ];
  if (!results.length) {
    if (itunes.status === 'rejected' && lrclib.status === 'rejected') {
      throw new Error('Both online providers are unavailable.');
    }
    return [];
  }
  return mergeCandidates(results)
    .sort((a, b) => b.score - a.score)
    .slice(0, 16);
}

/** Fill a missing cover from iTunes when a lyrics-only candidate is selected. */
export async function completeCandidate(candidate: SongMatchCandidate, signal?: AbortSignal): Promise<SongMatchCandidate> {
  if (candidate.cover && candidate.lyrics) return candidate;
  const params = new URLSearchParams({
    term: [candidate.title, candidate.artist].filter(Boolean).join(' '),
    entity: 'song',
    limit: '5',
  });
  try {
    const payload = await fetchJson<{ results?: ItunesResult[] }>(
      `https://itunes.apple.com/search?${params.toString()}`,
      signal,
    );
    const best = payload.results?.find((item) => (
      normalized(item.trackName ?? '') === normalized(candidate.title)
      && normalized(item.artistName ?? '').includes(normalized(candidate.artist))
    )) ?? payload.results?.[0];
    return {
      ...candidate,
      cover: candidate.cover ?? artworkUrl(best?.artworkUrl100),
      album: candidate.album ?? best?.collectionName,
      duration: candidate.duration ?? (best?.trackTimeMillis ? best.trackTimeMillis / 1000 : undefined),
    };
  } catch {
    return candidate;
  }
}

/**
 * Applies only fields that were actually found, so a lyrics-only result never
 * wipes an existing cover and vice versa. `updateTrack` is responsible for
 * persisting the change and invalidating parsed-media caches.
 */
export function applySongCandidate(track: Track, candidate: SongMatchCandidate): Partial<Track> {
  return {
    title: candidate.title || track.title,
    artist: candidate.artist || track.artist,
    album: candidate.album ?? track.album,
    duration: candidate.duration ?? track.duration,
    cover: candidate.cover ?? track.cover,
    lyrics: candidate.lyrics ?? track.lyrics,
    lyricsFormat: candidate.lyrics ? (candidate.lyricsFormat ?? 'lrc') : track.lyricsFormat,
    lyricsUrl: candidate.lyrics ? undefined : track.lyricsUrl,
  };
}
