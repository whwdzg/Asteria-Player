import type { SubtitleSource } from './types';
import { parseDanmaku } from './danmaku';
import { uid } from './format';

/**
 * Bilibili integration notes
 * -------------------------
 * Bilibili's public APIs do not send permissive CORS headers (and often apply
 * risk-control to unauthenticated requests). A static web app therefore needs
 * an explicit CORS proxy. `bilibiliProxy` may be:
 *
 *   https://proxy.example/?url=          // prefix + encoded target URL
 *   https://proxy.example/?url={url}     // template with {url}
 *
 * When it is empty the service attempts the direct API first; if the browser
 * blocks it the UI explains how to configure the proxy. The actual data model
 * remains useful with any compatible proxy.
 */
export interface BilibiliVideo {
  bvid: string;
  /** danmu_api episode id when the open-source provider is used. */
  episodeId?: number;
  source?: 'bilibili' | 'danmu_api';
  title: string;
  author: string;
  cover?: string;
  duration?: number;
  play?: number;
  description?: string;
}

export interface BilibiliPage {
  page: number;
  cid: number;
  part: string;
  duration?: number;
}

interface BilibiliSearchItem {
  bvid?: string;
  title?: string;
  author?: string;
  pic?: string;
  duration?: string;
  play?: number;
  description?: string;
}

interface BilibiliSearchPayload {
  code?: number;
  message?: string;
  data?: { result?: BilibiliSearchItem[] };
}

interface BilibiliPlayUrlPayload {
  code?: number;
  message?: string;
  data?: {
    durl?: Array<{ url?: string; backup_url?: string[]; size?: number }>;
  };
}

interface BilibiliViewPayload {
  code?: number;
  message?: string;
  data?: {
    bvid?: string;
    title?: string;
    owner?: { name?: string };
    pic?: string;
    duration?: number;
    desc?: string;
    pages?: Array<{ page?: number; cid?: number; part?: string; duration?: number }>;
  };
}

interface BilibiliSubtitlePayload {
  code?: number;
  message?: string;
  data?: {
    subtitle?: {
      subtitles?: Array<{ lan?: string; lan_doc?: string; subtitle_url?: string }>;
    };
  };
}

interface BilibiliSubtitleBody {
  body?: Array<{ from?: number; to?: number; content?: string }>;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function proxied(target: string, proxy: string): string {
  const trimmed = proxy.trim();
  if (!trimmed) return target;
  const encoded = encodeURIComponent(target);
  return trimmed.includes('{url}') ? trimmed.split('{url}').join(encoded) : `${trimmed}${encoded}`;
}

async function request(url: string, proxy: string, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(12_000);
  const response = await fetch(proxied(url, proxy), {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Accept: 'application/json,text/xml,text/plain,*/*' },
  });
  if (!response.ok) throw new Error(`Bilibili HTTP ${response.status}`);
  return response;
}

async function json<T>(url: string, proxy: string, signal?: AbortSignal): Promise<T> {
  const response = await request(url, proxy, signal);
  return (await response.json()) as T;
}

function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return undefined;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/**
 * Search Bilibili for videos by title. Search result titles contain highlight
 * markup which is stripped before display.
 */
export async function searchBilibiliVideos(query: string, proxy: string, signal?: AbortSignal): Promise<BilibiliVideo[]> {
  const keyword = query.trim();
  if (!keyword) return [];
  const params = new URLSearchParams({ search_type: 'video', keyword, page: '1' });
  const payload = await json<BilibiliSearchPayload>(
    `https://api.bilibili.com/x/web-interface/search/type?${params.toString()}`,
    proxy,
    signal,
  );
  if (payload.code !== 0) {
    throw new Error(payload.message || `Bilibili search returned ${payload.code ?? 'an error'}`);
  }
  return (payload.data?.result ?? [])
    .filter((item) => item.bvid)
    .map((item) => ({
      bvid: item.bvid ?? '',
      title: stripHtml(item.title ?? ''),
      author: item.author ?? '',
      cover: item.pic ? normalizeUrl(item.pic) : undefined,
      duration: parseDuration(item.duration),
      play: item.play,
      description: item.description ? stripHtml(item.description) : undefined,
    }));
}

/** Resolve the playable pages and cid for a search result. */
export async function fetchBilibiliPages(bvid: string, proxy: string, signal?: AbortSignal): Promise<{
  video: BilibiliVideo;
  pages: BilibiliPage[];
}> {
  const isAid = /^av\d+$/i.test(bvid);
  const idParam = isAid ? `aid=${Number(bvid.slice(2))}` : `bvid=${encodeURIComponent(bvid)}`;
  const payload = await json<BilibiliViewPayload>(
    `https://api.bilibili.com/x/web-interface/view?${idParam}`,
    proxy,
    signal,
  );
  if (payload.code !== 0 || !payload.data) {
    throw new Error(payload.message || 'Could not load the Bilibili video.');
  }
  const data = payload.data;
  const pages = (data.pages ?? [])
    .filter((page) => page.cid)
    .map((page) => ({
      page: page.page ?? 1,
      cid: page.cid ?? 0,
      part: page.part ?? `P${page.page ?? 1}`,
      duration: page.duration,
    }));
  return {
    video: {
      bvid: data.bvid ?? bvid,
      title: data.title ?? bvid,
      author: data.owner?.name ?? '',
      cover: data.pic ? normalizeUrl(data.pic) : undefined,
      duration: data.duration,
      description: data.desc,
    },
    pages,
  };
}

/**
 * Resolve a progressive MP4/FLV stream for a page. Bilibili returns DASH
 * (separate audio/video) for most modern clients; the html5 platform request
 * asks for a progressive `durl` instead so a single <video> element can play it.
 * The URL must normally travel through the configured CORS/media proxy.
 */
export async function fetchBilibiliPlayUrl(bvid: string, cid: number, proxy: string): Promise<string> {
  const params = new URLSearchParams({
    bvid,
    cid: String(cid),
    qn: '64',
    fnval: '0',
    fnver: '0',
    fourk: '1',
    platform: 'html5',
    high_quality: '1',
  });
  const payload = await json<BilibiliPlayUrlPayload>(
    `https://api.bilibili.com/x/player/playurl?${params.toString()}`,
    proxy,
  );
  if (payload.code !== 0) {
    throw new Error(payload.message || `Bilibili playurl returned ${payload.code ?? 'an error'}`);
  }
  const stream = (payload.data?.durl ?? [])
    .map((item) => item.url || item.backup_url?.[0])
    .filter((url): url is string => Boolean(url))
    .sort((a, b) => {
      const sizeA = payload.data?.durl?.find((item) => item.url === a)?.size ?? 0;
      const sizeB = payload.data?.durl?.find((item) => item.url === b)?.size ?? 0;
      return sizeB - sizeA;
    })[0];
  if (!stream) throw new Error('Bilibili did not return a progressive video stream.');
  return proxied(stream, proxy);
}

/** Pick the page referenced by a P1/P2 subtitle, otherwise the first page. */
export function pickBilibiliPage(pages: BilibiliPage[], subtitle?: string): BilibiliPage | undefined {
  const match = subtitle?.match(/p\s*(\d+)/i);
  const pageNumber = match ? Number(match[1]) : 0;
  return pages.find((page) => page.page === pageNumber) ?? pages[0];
}

/** Download and parse Bilibili XML danmaku into the app's JSON representation. */
export async function fetchBilibiliDanmaku(cid: number, proxy: string): Promise<string> {
  const response = await request(`https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`, proxy);
  const xml = await response.text();
  const comments = parseDanmaku(xml);
  if (!comments.length) throw new Error('No danmaku found for this page.');
  return JSON.stringify(comments);
}

function vttTimestamp(seconds: number): string {
  const whole = Math.max(0, seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = (whole % 60).toFixed(3).padStart(6, '0');
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${rest}`;
}

/**
 * Fetch Bilibili's subtitle list for a page. Subtitles are converted from
 * Bilibili's JSON body format into WebVTT so the existing subtitle renderer and
 * language selector can consume them unchanged.
 */
export async function fetchBilibiliSubtitles(
  bvid: string,
  cid: number,
  proxy: string,
): Promise<SubtitleSource[]> {
  const endpoints = [
    `https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${encodeURIComponent(bvid)}`,
    `https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&bvid=${encodeURIComponent(bvid)}`,
  ];
  let list: Array<{ lan?: string; lan_doc?: string; subtitle_url?: string }> = [];
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const payload = await json<BilibiliSubtitlePayload>(endpoint, proxy);
      if (payload.code === 0) {
        list = payload.data?.subtitle?.subtitles ?? [];
        break;
      }
      lastError = new Error(payload.message || `Bilibili player returned ${payload.code}`);
    } catch (error) {
      lastError = error;
    }
  }
  if (!list.length) {
    throw lastError instanceof Error ? lastError : new Error('No subtitles found for this page.');
  }

  const subtitles: SubtitleSource[] = [];
  for (const item of list) {
    if (!item.subtitle_url) continue;
    try {
      const body = await json<BilibiliSubtitleBody>(normalizeUrl(item.subtitle_url), proxy);
      const cues = (body.body ?? [])
        .filter((cue) => typeof cue.from === 'number' && typeof cue.to === 'number' && cue.content)
        .map((cue) => `${vttTimestamp(cue.from ?? 0)} --> ${vttTimestamp(cue.to ?? 0)}\n${cue.content}`);
      if (!cues.length) continue;
      const lang = item.lan || 'und';
      subtitles.push({
        id: uid('sub'),
        lang,
        label: item.lan_doc || lang,
        format: 'vtt',
        text: `WEBVTT\n\n${cues.join('\n\n')}\n`,
      });
    } catch {
      // One broken subtitle track should not hide the others.
    }
  }
  if (!subtitles.length) throw new Error('No readable subtitles found for this page.');
  return subtitles;
}

/** Merge fetched subtitles with existing tracks by language. */
export function mergeSubtitles(existing: SubtitleSource[] | undefined, incoming: SubtitleSource[]): SubtitleSource[] {
  const byLang = new Map((existing ?? []).map((subtitle) => [subtitle.lang, subtitle]));
  for (const subtitle of incoming) byLang.set(subtitle.lang, subtitle);
  return [...byLang.values()];
}

/**
 * Open-source danmu_api adapter (AGPL project by huangxd-):
 * https://github.com/huangxd-/danmu_api
 * It aggregates Bilibili and other sources behind a Dandanplay-compatible API
 * and avoids direct Bilibili CORS/risk-control issues when self-hosted.
 */
function danmuApiEndpoint(base: string, path: string): string {
  const root = base.trim().replace(/\/+$/, '');
  return `${/\/api\/v2$/.test(root) ? root : `${root}/api/v2`}${path}`;
}

interface DanmuApiEpisode {
  episodeId?: number;
  id?: number;
  episodeTitle?: string;
  title?: string;
  episodeNumber?: number;
}

interface DanmuApiAnime {
  animeId?: number;
  animeTitle?: string;
  typeDescription?: string;
  imageUrl?: string;
  episodes?: DanmuApiEpisode[];
}

async function fetchDanmuApiJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`danmu_api HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** Search the open-source danmu_api server and flatten its episode results. */
export async function searchDanmuApiEpisodes(
  query: string,
  base: string,
  signal?: AbortSignal,
): Promise<BilibiliVideo[]> {
  const payload = await fetchDanmuApiJson<{ animes?: DanmuApiAnime[]; episodes?: DanmuApiEpisode[] }>(
    danmuApiEndpoint(base, `/search/episodes?anime=${encodeURIComponent(query.trim())}`),
    signal,
  );
  const results: BilibiliVideo[] = [];
  const groups: DanmuApiAnime[] = payload.animes ?? (
    payload.episodes ? [{ animeTitle: 'danmu_api', episodes: payload.episodes }] : []
  );
  for (const anime of groups) {
    for (const episode of anime.episodes ?? []) {
      const episodeId = episode.episodeId ?? episode.id;
      if (!episodeId) continue;
      const episodeTitle = episode.episodeTitle ?? episode.title ?? (episode.episodeNumber ? `EP${episode.episodeNumber}` : '');
      results.push({
        bvid: '',
        episodeId,
        source: 'danmu_api',
        title: [anime.animeTitle, episodeTitle].filter(Boolean).join(' · '),
        author: anime.typeDescription ?? 'danmu_api',
        cover: anime.imageUrl,
      });
    }
  }
  return results;
}

/** Fetch Bilibili XML via the open-source danmu_api comment endpoint. */
export async function fetchDanmuApiDanmaku(episodeId: number, base: string): Promise<string> {
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(danmuApiEndpoint(base, `/comment/${episodeId}?format=xml`), { signal: timeout });
  if (!response.ok) throw new Error(`danmu_api HTTP ${response.status}`);
  const xml = await response.text();
  const comments = parseDanmaku(xml);
  if (!comments.length) throw new Error('No danmaku found for this episode.');
  return JSON.stringify(comments);
}

export function bilibiliSearchUrl(title: string): string {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(title)}`;
}

export function bilibiliVideoUrl(bvid: string): string {
  return `https://www.bilibili.com/video/${encodeURIComponent(bvid)}`;
}
