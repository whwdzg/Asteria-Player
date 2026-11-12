import type { MediaKind, Track } from './types';
import { baseName, uid } from './format';
import { extensionOf } from './metadata';
import {
  fetchBilibiliDanmaku,
  fetchBilibiliPages,
  fetchBilibiliPlayUrl,
  fetchBilibiliSubtitles,
  pickBilibiliPage,
} from './bilibili';

const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'weba', 'aiff', 'aif', 'wma']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi', 'ogv', 'm3u8']);
const BILIBILI_LIST = /(?:space\.bilibili\.com|\/medialist\/|\/favlist|\/series\/|\/collectiondetail|\/list\/)/i;

export type UrlKind = MediaKind | 'auto';

export interface UrlImportOptions {
  kind?: UrlKind;
  proxy?: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, input: string) => void;
  /** Called as soon as one input has been resolved, before the next input. */
  onTrack?: (track: Track) => void;
}

export interface UrlImportResult {
  tracks: Track[];
  warnings: string[];
}

/** Convert a URL path into a readable title without query noise. */
function titleFromUrl(url: URL): string {
  const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
  const decoded = (() => {
    try { return decodeURIComponent(last); } catch { return last; }
  })();
  const title = decoded.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[+_]+/g, ' ').trim();
  return title || url.hostname;
}

export function kindFromUrl(input: string, forced: UrlKind = 'auto'): MediaKind {
  if (forced === 'audio' || forced === 'video') return forced;
  try {
    const url = new URL(input);
    const ext = extensionOf(url.pathname);
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  } catch {
    // A bare BV/AV id is handled by the Bilibili path before this helper.
  }
  return 'audio';
}

function bilibiliId(input: string): string | undefined {
  const raw = input.trim();
  if (/^av\d+$/i.test(raw)) return raw.toLowerCase();
  if (/^BV[0-9A-Za-z]{10}$/i.test(raw)) return `BV${raw.slice(2)}`;
  const match = raw.match(/(?:video\/)?(BV[0-9A-Za-z]{10}|av\d+)/i);
  if (!match) return undefined;
  return /^av/i.test(match[1]) ? match[1].toLowerCase() : `BV${match[1].slice(2)}`;
}

export function isBilibiliUrl(input: string): boolean {
  return /bilibili\.com|b23\.tv/i.test(input) || Boolean(bilibiliId(input));
}

function directTrack(input: string, kind: UrlKind): Track {
  const url = new URL(input);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) links are supported.');
  }
  const ext = extensionOf(url.pathname);
  const resolvedKind = kindFromUrl(input, kind);
  return {
    id: uid('url'),
    kind: resolvedKind,
    title: titleFromUrl(url),
    artist: '',
    src: url.href,
    duration: 0,
    source: 'url',
    format: ext ? ext.toUpperCase() : undefined,
    fileName: baseName(url.pathname) || undefined,
    addedAt: Date.now(),
  };
}

async function bilibiliTrack(input: string, proxy: string): Promise<{ track: Track; warnings: string[] }> {
  if (BILIBILI_LIST.test(input)) {
    throw new Error('Bilibili list/space links are not supported; paste a single video link or BV/AV id.');
  }
  if (/b23\.tv/i.test(input)) {
    throw new Error('Bilibili short links are not supported; expand the link to a BV/AV video URL first.');
  }
  const id = bilibiliId(input);
  if (!id) throw new Error('No BV or AV id found in the Bilibili link.');

  let pageNumber = 1;
  try {
    const parsed = new URL(input);
    const p = Number(parsed.searchParams.get('p'));
    if (Number.isFinite(p) && p > 0) pageNumber = p;
  } catch {
    // Bare BV/AV ids have no query string.
  }

  const { video, pages } = await fetchBilibiliPages(id, proxy);
  const page = pickBilibiliPage(pages, `p${pageNumber}`);
  if (!page) throw new Error('No playable page found for this Bilibili video.');
  const stream = await fetchBilibiliPlayUrl(video.bvid, page.cid, proxy);

  const warnings: string[] = [];
  let subtitles: Track['subtitles'];
  let danmakuText: string | undefined;
  try {
    subtitles = await fetchBilibiliSubtitles(video.bvid, page.cid, proxy);
  } catch (error) {
    warnings.push(`字幕不可用：${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    danmakuText = await fetchBilibiliDanmaku(page.cid, proxy);
  } catch (error) {
    warnings.push(`弹幕不可用：${error instanceof Error ? error.message : String(error)}`);
  }

  const format = extensionOf(stream.split('?')[0]) || 'mp4';
  return {
    track: {
      id: uid('bili'),
      kind: 'video',
      title: video.title,
      artist: video.author,
      subtitle: pages.length > 1 ? page.part : undefined,
      src: stream,
      duration: page.duration ?? video.duration ?? 0,
      cover: video.cover,
      source: 'bilibili',
      subtitles,
      danmakuText,
      format: format.toUpperCase(),
      fileName: `${video.title}.${format}`,
      addedAt: Date.now(),
    },
    warnings,
  };
}

/**
 * Import direct media URLs and Bilibili single-video links.
 *
 * Direct links become ordinary remote tracks. Bilibili links resolve the
 * view/page, a progressive play URL, subtitles and XML danmaku through the
 * configured CORS/media proxy. A list/space link is deliberately rejected
 * because those endpoints need signed WBI requests and would be unreliable in
 * a static GitHub Pages build.
 */
export async function importRemoteUrls(
  inputs: string[],
  options: UrlImportOptions = {},
): Promise<UrlImportResult> {
  const cleaned = inputs.map((value) => value.trim()).filter(Boolean);
  const tracks: Track[] = [];
  const warnings: string[] = [];
  const proxy = options.proxy?.trim() ?? '';
  let done = 0;

  for (const input of cleaned) {
    try {
      if (isBilibiliUrl(input)) {
        const result = await bilibiliTrack(input, proxy);
        tracks.push(result.track);
        options.onTrack?.(result.track);
        warnings.push(...result.warnings);
      } else {
        const track = directTrack(input, options.kind ?? 'auto');
        tracks.push(track);
        options.onTrack?.(track);
      }
    } catch (error) {
      warnings.push(`${input}: ${error instanceof Error ? error.message : String(error)}`);
    }
    done += 1;
    options.onProgress?.(done, cleaned.length, input);
  }

  return { tracks, warnings };
}
