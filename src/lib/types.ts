export type MediaKind = 'audio' | 'video';
export type PlayMode = 'one' | 'all' | 'none' | 'shuffle';

export type FontChoice = 'display' | 'sans' | 'serif' | 'rounded' | 'mono';
export type DanmakuArea = 'quarter' | 'half' | 'threeQuarter' | 'full';
export type VideoFit = 'contain' | 'cover' | 'fill';

export type ShortcutAction =
  | 'playPause'
  | 'previous'
  | 'next'
  | 'rewind10'
  | 'forward10'
  | 'cycleMode'
  | 'seekBack5'
  | 'seekForward5'
  | 'fullscreen'
  | 'mute'
  | 'queue'
  | 'settings';

export interface ShortcutSpec {
  code: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export type ShortcutMap = Record<ShortcutAction, ShortcutSpec | null>;

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
  /** Optional secondary label, e.g. the P1/P2 filename under a folder title. */
  subtitle?: string;
  src: string;
  duration: number;
  cover?: string;
  accent?: string;
  source: 'demo' | 'local' | 'url' | 'bilibili';
  /** Inline or already-loaded lyrics text. */
  lyrics?: string;
  /** Remote lyrics URL for the demo library. */
  lyricsUrl?: string;
  lyricsFormat?: 'lrc' | 'spl';
  lyricsEncoding?: string;
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
  bpm?: number;
  format?: string;
  fileName?: string;
  fileSize?: number;
  videoWidth?: number;
  videoHeight?: number;
  discNumber?: number;
  trackNumber?: number;
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
  discNumber?: number;
  trackNumber?: number;
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
  dynamicBackground: boolean;
  backgroundBpm: boolean;
  backgroundVideo: boolean;
  /** Rounded-bar spectrum behind the now-playing controls. */
  audioVisualizer: boolean;
  /** Visualizer height as a fraction of the 1/10-screen cap. */
  audioVisualizerHeight: number;
  audioVisualizerOpacity: number;
  lyricSize: number;
  lyricWeight: number;
  lyricTranslationSize: number;
  lyricBlur: boolean;
  lyricFont: FontChoice;
  showTranslation: boolean;
  subtitleLang: string;
  subtitleBgOpacity: number;
  subtitleTextOpacity: number;
  subtitleFont: FontChoice;
  danmakuEnabled: boolean;
  danmakuTop: boolean;
  danmakuScroll: boolean;
  danmakuWeight: number;
  /** Vertical range of the danmaku field. */
  danmakuArea: DanmakuArea;
  /** Base danmaku font size in pixels at the authored 25px reference. */
  danmakuSize: number;
  danmakuOpacity: number;
  danmakuSpeed: number;
  danmakuFont: FontChoice;
  volume: number;
  brightness: number;
  muted: boolean;
  playMode: PlayMode;
  playbackRate: number;
  eqEnabled: boolean;
  eqGains: number[];
  autoPlayNext: boolean;
  fullscreenClock: boolean;
  fullscreenClockHours: boolean;
  fullscreenClockSeconds: boolean;
  fullscreenClockDate: boolean;
  mirrorVideo: boolean;
  colorVisionAssist: boolean;
  videoFit: VideoFit;
  danmuApiBase: string;
  shortcuts: ShortcutMap;
  lastTrackId?: string;
  lastPosition?: number;
  reduceMotion?: boolean;
  /** Optional CORS proxy prefix/template for Bilibili API calls. */
  bilibiliProxy: string;
}

export interface LanguagePack {
  code: string;
  label: string;
  nativeLabel?: string;
  file: string;
  /** Present for runtime-imported packs, absent for remote manifest packs. */
  translations?: Record<string, string>;
  source?: 'remote' | 'imported';
}
