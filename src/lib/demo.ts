import type { Track } from './types';

interface DemoSubtitle {
  lang: string;
  label: string;
  src: string;
}

interface DemoTrack {
  id: string;
  type: 'audio' | 'video';
  title: string;
  artist: string;
  album?: string;
  src: string;
  cover?: string;
  lyrics?: string;
  lyricsFormat?: 'lrc' | 'spl';
  duration?: number;
  bpm?: number;
  sampleRate?: number;
  bitDepth?: number;
  bitrate?: number;
  format?: string;
  accent?: string;
  width?: number;
  height?: number;
  subtitles?: DemoSubtitle[];
  danmaku?: string;
}

interface DemoManifest {
  version: number;
  tracks: DemoTrack[];
}

function absolute(path: string): string {
  return new URL(path, document.baseURI).href;
}

let demoPromise: Promise<Track[]> | null = null;

export function loadDemoLibrary(): Promise<Track[]> {
  demoPromise ??= fetchDemoLibrary();
  return demoPromise;
}

async function fetchDemoLibrary(): Promise<Track[]> {
  const response = await fetch(absolute('demo/library.json'));
  if (!response.ok) throw new Error(`Demo library: HTTP ${response.status}`);
  const manifest = (await response.json()) as DemoManifest;
  return manifest.tracks.map((entry) => ({
    id: entry.id,
    kind: entry.type,
    title: entry.title,
    artist: entry.artist,
    album: entry.album,
    src: absolute(entry.src),
    cover: entry.cover ? absolute(entry.cover) : undefined,
    duration: entry.duration ?? 0,
    bpm: entry.bpm,
    sampleRate: entry.sampleRate,
    bitDepth: entry.bitDepth,
    bitrate: entry.bitrate,
    format: entry.format,
    accent: entry.accent,
    source: 'demo',
    lyricsUrl: entry.lyrics ? absolute(entry.lyrics) : undefined,
    lyricsFormat: entry.lyricsFormat,
    subtitles: entry.subtitles?.map((subtitle) => ({
      id: `${entry.id}-${subtitle.lang}`,
      lang: subtitle.lang,
      label: subtitle.label,
      src: absolute(subtitle.src),
    })),
    danmakuUrl: entry.danmaku ? absolute(entry.danmaku) : undefined,
    videoWidth: entry.width,
    videoHeight: entry.height,
    addedAt: 0,
  }));
}
