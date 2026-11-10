export type MediaKind = 'audio' | 'video';
export type PlayMode = 'one' | 'all' | 'none' | 'shuffle';

export interface SubtitleSource {
  id: string;
  lang: string;
  label: string;
  /** Remote URL, used by the bundled demo library. */
  src?: string;
  /** Inline subtitle text, used by local imports. */
  text?: string;
  format?: SubtitleFormat;
}

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

export interface Track {
  id: string;
  kind: MediaKind;
  title: string;
  artist: string;
  album?: string;
  src: string;
  duration: number;
  cover?: string;
  accent?: string;
  source: 'demo' | 'local';
  /** Inline or already-loaded lyrics text. */
  lyrics?: string;
  /** Remote lyrics URL for the demo library. */
  lyricsUrl?: string;
  lyricsFormat?: 'lrc' | 'spl';
  /** Lyrics read from audio tags during import. */
  embeddedLyrics?: string;
  /** Translation read from a separate sidecar file. */
  translation?: string;
  subtitles?: SubtitleSource[];
  danmakuUrl?: string;
  danmakuText?: string;
  sampleRate?: number;
  bitDepth?: number;
  bitrate?: number;
  format?: string;
  fileName?: string;
  fileSize?: number;
  videoWidth?: number;
  videoHeight?: number;
  addedAt?: number;
  /** Local File handle. Never persisted. */
  file?: File;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface LyricWord {
  text: string;
  start: number;
  end: number;
}

export interface LyricLine {
  id: number;
  start: number;
  end: number;
  text: string;
  translation?: string;
  words: LyricWord[];
  translationWords?: LyricWord[];
}

export interface LyricsDocument {
  lines: LyricLine[];
  /** True when at least one line had a timestamp. */
  synced: boolean;
  plainText: string;
  meta: Record<string, string>;
  offset: number;
  source?: 'sidecar' | 'embedded' | 'manual';
}

export interface SubtitleCue {
  id: number;
  start: number;
  end: number;
  text: string;
}

export type DanmakuMode = 'scroll' | 'top' | 'bottom';

export interface DanmakuComment {
  id: string;
  time: number;
  text: string;
  mode: DanmakuMode;
  color: string;
  size: number;
}

export interface MediaTags {
  title?: string;
  artist?: string;
  album?: string;
  lyrics?: string;
  cover?: string;
  sampleRate?: number;
  bitDepth?: number;
  duration?: number;
  bitrate?: number;
  format?: string;
}

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  language: string;
  liquidGlass: boolean;
  lyricSize: number;
  lyricWeight: number;
  showTranslation: boolean;
  subtitleLang: string;
  danmakuEnabled: boolean;
  danmakuTop: boolean;
  danmakuScroll: boolean;
  volume: number;
  brightness: number;
  muted: boolean;
  playMode: PlayMode;
  eqEnabled: boolean;
  eqGains: number[];
  lastTrackId?: string;
  lastPosition?: number;
  reduceMotion?: boolean;
}

export interface LanguagePack {
  code: string;
  label: string;
  nativeLabel?: string;
  file: string;
}
