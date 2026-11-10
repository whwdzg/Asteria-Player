import type { DanmakuComment, LyricsDocument, SubtitleCue, SubtitleSource, Track } from './types';
import { mergeTranslation, parseLyrics } from './lyrics';
import { parseDanmaku } from './danmaku';
import { parseSubtitle } from './subtitles';

const lyricCache = new Map<string, LyricsDocument | null>();
const subtitleCache = new Map<string, SubtitleCue[] | null>();
const danmakuCache = new Map<string, DanmakuComment[] | null>();

function remember<T>(cache: Map<string, T>, key: string, value: T, limit = 16): T {
  if (cache.size >= limit) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
  return value;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function resolveLyrics(track: Track, duration = track.duration): Promise<LyricsDocument | null> {
  const cached = lyricCache.get(track.id);
  if (cached !== undefined) return cached;
  let raw = track.lyrics ?? track.embeddedLyrics;
  let source: LyricsDocument['source'] = track.lyrics ? 'sidecar' : 'embedded';
  if (!raw && track.lyricsUrl) {
    raw = (await fetchText(track.lyricsUrl)) ?? undefined;
    source = 'sidecar';
  }
  if (!raw?.trim()) {
    lyricCache.set(track.id, null);
    return null;
  }
  let document = parseLyrics(raw, { duration }, source);
  if (track.translation?.trim()) document = mergeTranslation(document, track.translation);
  return remember(lyricCache, track.id, document);
}

export async function resolveSubtitle(track: Track, source: SubtitleSource): Promise<SubtitleCue[] | null> {
  const key = `${track.id}:${source.id}`;
  const cached = subtitleCache.get(key);
  if (cached !== undefined) return cached;
  const raw = source.text ?? (source.src ? await fetchText(source.src) : null);
  if (!raw) {
    subtitleCache.set(key, null);
    return null;
  }
  const parsed = parseSubtitle(raw, source.format);
  return remember(subtitleCache, key, parsed.cues);
}

export async function resolveDanmaku(track: Track): Promise<DanmakuComment[] | null> {
  const cached = danmakuCache.get(track.id);
  if (cached !== undefined) return cached;
  let raw = track.danmakuText;
  if (!raw && track.danmakuUrl) raw = (await fetchText(track.danmakuUrl)) ?? undefined;
  if (!raw?.trim()) {
    danmakuCache.set(track.id, null);
    return null;
  }
  return remember(danmakuCache, track.id, parseDanmaku(raw));
}

export function clearMediaCaches(trackId?: string): void {
  if (!trackId) {
    lyricCache.clear();
    subtitleCache.clear();
    danmakuCache.clear();
    return;
  }
  lyricCache.delete(trackId);
  danmakuCache.delete(trackId);
  for (const key of subtitleCache.keys()) {
    if (key.startsWith(`${trackId}:`)) subtitleCache.delete(key);
  }
}
