import defaultsFile from '../config/default-settings.json';
import type { FontChoice, PlayMode, Settings } from './types';
import { clamp } from './format';
import { normalizeShortcuts } from './shortcuts';

/**
 * The single source of truth for the shipped defaults is
 * `src/config/default-settings.json`. The JSON file is intentionally kept
 * human-editable; it can be updated without touching the Zustand store.
 */
export const SETTINGS_JSON_VERSION = 1;

const THEMES = new Set<Settings['theme']>(['dark', 'light', 'system']);
const PLAY_MODES = new Set<PlayMode>(['one', 'all', 'none', 'shuffle']);
const FONTS = new Set<FontChoice>(['display', 'sans', 'serif', 'rounded', 'mono']);
const DANMAKU_AREAS = new Set<Settings['danmakuArea']>(['quarter', 'half', 'threeQuarter', 'full']);
const VIDEO_FITS = new Set<Settings['videoFit']>(['contain', 'cover', 'fill']);

type RawSettings = Record<string, unknown>;

interface SettingsFileShape {
  version?: number;
  settings?: RawSettings;
}

const file = defaultsFile as SettingsFileShape;
const rawDefaults = file.settings ?? {};

/**
 * Defaults used when the store is first created. Optional session fields
 * (`lastTrackId` / `lastPosition`) are deliberately not part of the JSON file:
 * they describe the last session rather than a user preference.
 */
const FALLBACK_SETTINGS: Settings = {
  theme: 'system',
  language: 'system',
  liquidGlass: true,
  dynamicBackground: true,
  backgroundBpm: true,
  backgroundVideo: true,
  lyricSize: 1,
  lyricWeight: 400,
  lyricTranslationSize: 0.62,
  lyricBlur: true,
  lyricFont: 'display',
  showTranslation: true,
  subtitleLang: 'auto',
  subtitleBgOpacity: 0.35,
  subtitleTextOpacity: 1,
  subtitleFont: 'sans',
  danmakuEnabled: true,
  danmakuTop: true,
  danmakuScroll: true,
  danmakuWeight: 600,
  danmakuSize: 25,
  danmakuArea: 'full',
  danmakuOpacity: 1,
  danmakuSpeed: 1,
  danmakuFont: 'sans',
  volume: 0.8,
  brightness: 1,
  muted: false,
  playMode: 'all',
  playbackRate: 1,
  eqEnabled: false,
  eqGains: [0, 0, 0, 0, 0],
  autoPlayNext: true,
  fullscreenClock: false,
  fullscreenClockHours: true,
  fullscreenClockSeconds: false,
  fullscreenClockDate: false,
  mirrorVideo: false,
  colorVisionAssist: false,
  videoFit: 'contain',
  danmuApiBase: '',
  shortcuts: normalizeShortcuts(undefined),
  lastPosition: 0,
  reduceMotion: false,
  bilibiliProxy: '',
};

/** Validated defaults loaded from `src/config/default-settings.json`. */
export const DEFAULT_SETTINGS: Settings = normalizeSettings(rawDefaults, FALLBACK_SETTINGS);

function record(value: unknown): RawSettings {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RawSettings : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

/**
 * Coerces unknown JSON/localStorage data into a complete, bounded Settings
 * object. Unknown keys are ignored so an imported file can be forward
 * compatible, and every numeric field is clamped to the same range as the UI.
 */
export function normalizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const raw = record(input);
  const theme = typeof raw.theme === 'string' && THEMES.has(raw.theme as Settings['theme'])
    ? raw.theme as Settings['theme']
    : base.theme;
  const playMode = typeof raw.playMode === 'string' && PLAY_MODES.has(raw.playMode as PlayMode)
    ? raw.playMode as PlayMode
    : base.playMode;
  const font = (value: unknown, fallback: FontChoice): FontChoice => (
    typeof value === 'string' && FONTS.has(value as FontChoice) ? value as FontChoice : fallback
  );
  const danmakuArea = typeof raw.danmakuArea === 'string' && DANMAKU_AREAS.has(raw.danmakuArea as Settings['danmakuArea'])
    ? raw.danmakuArea as Settings['danmakuArea']
    : base.danmakuArea;
  const videoFit = typeof raw.videoFit === 'string' && VIDEO_FITS.has(raw.videoFit as Settings['videoFit'])
    ? raw.videoFit as Settings['videoFit']
    : base.videoFit;
  const gains = Array.isArray(raw.eqGains) && raw.eqGains.length === 5
    ? raw.eqGains.map((gain) => clamp(Number(gain) || 0, -12, 12))
    : [...base.eqGains];

  return {
    theme,
    language: stringValue(raw.language, base.language),
    liquidGlass: booleanValue(raw.liquidGlass, base.liquidGlass),
    dynamicBackground: booleanValue(raw.dynamicBackground, base.dynamicBackground),
    backgroundBpm: booleanValue(raw.backgroundBpm, base.backgroundBpm),
    backgroundVideo: booleanValue(raw.backgroundVideo, base.backgroundVideo),
    lyricSize: numberValue(raw.lyricSize, base.lyricSize, 0.7, 1.6),
    lyricWeight: numberValue(raw.lyricWeight, base.lyricWeight, 200, 800),
    lyricTranslationSize: numberValue(raw.lyricTranslationSize, base.lyricTranslationSize, 0.4, 1.2),
    lyricBlur: booleanValue(raw.lyricBlur, base.lyricBlur),
    lyricFont: font(raw.lyricFont, base.lyricFont),
    showTranslation: booleanValue(raw.showTranslation, base.showTranslation),
    subtitleLang: stringValue(raw.subtitleLang, base.subtitleLang),
    subtitleBgOpacity: numberValue(raw.subtitleBgOpacity, base.subtitleBgOpacity, 0, 1),
    subtitleTextOpacity: numberValue(raw.subtitleTextOpacity, base.subtitleTextOpacity, 0.2, 1),
    subtitleFont: font(raw.subtitleFont, base.subtitleFont),
    danmakuEnabled: booleanValue(raw.danmakuEnabled, base.danmakuEnabled),
    danmakuTop: booleanValue(raw.danmakuTop, base.danmakuTop),
    danmakuScroll: booleanValue(raw.danmakuScroll, base.danmakuScroll),
    danmakuWeight: numberValue(raw.danmakuWeight, base.danmakuWeight, 300, 800),
    danmakuSize: numberValue(raw.danmakuSize, base.danmakuSize, 12, 48),
    danmakuArea,
    danmakuOpacity: numberValue(raw.danmakuOpacity, base.danmakuOpacity, 0.2, 1),
    danmakuSpeed: numberValue(raw.danmakuSpeed, base.danmakuSpeed, 0.5, 2.5),
    danmakuFont: font(raw.danmakuFont, base.danmakuFont),
    volume: numberValue(raw.volume, base.volume, 0, 1.2),
    brightness: numberValue(raw.brightness, base.brightness, 0, 1),
    muted: booleanValue(raw.muted, base.muted),
    playMode,
    playbackRate: numberValue(raw.playbackRate, base.playbackRate, 0.25, 4),
    eqEnabled: booleanValue(raw.eqEnabled, base.eqEnabled),
    eqGains: gains,
    autoPlayNext: booleanValue(raw.autoPlayNext, base.autoPlayNext),
    fullscreenClock: booleanValue(raw.fullscreenClock, base.fullscreenClock),
    fullscreenClockHours: booleanValue(raw.fullscreenClockHours, base.fullscreenClockHours),
    fullscreenClockSeconds: booleanValue(raw.fullscreenClockSeconds, base.fullscreenClockSeconds),
    fullscreenClockDate: booleanValue(raw.fullscreenClockDate, base.fullscreenClockDate),
    mirrorVideo: booleanValue(raw.mirrorVideo, base.mirrorVideo),
    colorVisionAssist: booleanValue(raw.colorVisionAssist, base.colorVisionAssist),
    videoFit,
    danmuApiBase: stringValue(raw.danmuApiBase, base.danmuApiBase),
    shortcuts: raw.shortcuts === undefined ? { ...base.shortcuts } : normalizeShortcuts(raw.shortcuts),
    lastTrackId: typeof raw.lastTrackId === 'string' ? raw.lastTrackId : base.lastTrackId,
    lastPosition: numberValue(raw.lastPosition, base.lastPosition ?? 0, 0, Number.MAX_SAFE_INTEGER),
    reduceMotion: booleanValue(raw.reduceMotion, base.reduceMotion ?? false),
    bilibiliProxy: stringValue(raw.bilibiliProxy, base.bilibiliProxy),
  };
}

/** Serialisable settings; session-only fields are excluded on purpose. */
export interface SettingsJsonDocument {
  version: number;
  settings: Omit<Settings, 'lastTrackId' | 'lastPosition'>;
}

export function settingsDocument(settings: Settings): SettingsJsonDocument {
  // Build the object explicitly rather than spreading the store object: the
  // store also exposes action methods that must never leak into exported JSON.
  return {
    version: SETTINGS_JSON_VERSION,
    settings: {
      theme: settings.theme,
      language: settings.language,
      liquidGlass: settings.liquidGlass,
      dynamicBackground: settings.dynamicBackground,
      backgroundBpm: settings.backgroundBpm,
      backgroundVideo: settings.backgroundVideo,
      lyricSize: settings.lyricSize,
      lyricWeight: settings.lyricWeight,
      lyricTranslationSize: settings.lyricTranslationSize,
      lyricBlur: settings.lyricBlur,
      lyricFont: settings.lyricFont,
      showTranslation: settings.showTranslation,
      subtitleLang: settings.subtitleLang,
      subtitleBgOpacity: settings.subtitleBgOpacity,
      subtitleTextOpacity: settings.subtitleTextOpacity,
      subtitleFont: settings.subtitleFont,
      danmakuEnabled: settings.danmakuEnabled,
      danmakuTop: settings.danmakuTop,
      danmakuScroll: settings.danmakuScroll,
      danmakuWeight: settings.danmakuWeight,
      danmakuSize: settings.danmakuSize,
      danmakuArea: settings.danmakuArea,
      danmakuOpacity: settings.danmakuOpacity,
      danmakuSpeed: settings.danmakuSpeed,
      danmakuFont: settings.danmakuFont,
      volume: settings.volume,
      brightness: settings.brightness,
      muted: settings.muted,
      playMode: settings.playMode,
      playbackRate: settings.playbackRate,
      eqEnabled: settings.eqEnabled,
      eqGains: [...settings.eqGains],
      autoPlayNext: settings.autoPlayNext,
      fullscreenClock: settings.fullscreenClock,
      fullscreenClockHours: settings.fullscreenClockHours,
      fullscreenClockSeconds: settings.fullscreenClockSeconds,
      fullscreenClockDate: settings.fullscreenClockDate,
      mirrorVideo: settings.mirrorVideo,
      colorVisionAssist: settings.colorVisionAssist,
      videoFit: settings.videoFit,
      danmuApiBase: settings.danmuApiBase,
      shortcuts: settings.shortcuts,
      reduceMotion: settings.reduceMotion ?? false,
      bilibiliProxy: settings.bilibiliProxy,
    },
  };
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settingsDocument(settings), null, 2);
}

export function defaultSettingsDocument(): SettingsJsonDocument {
  return settingsDocument(DEFAULT_SETTINGS);
}

/** Parse either the documented `{version, settings}` wrapper or a bare settings object. */
export function parseSettingsJson(source: string): { settings: Settings; version: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const root = record(parsed);
  const version = typeof root.version === 'number' ? root.version : SETTINGS_JSON_VERSION;
  if (version > SETTINGS_JSON_VERSION) {
    throw new Error(`Unsupported settings version ${version}; this build supports ${SETTINGS_JSON_VERSION}.`);
  }
  const candidate = root.settings && typeof root.settings === 'object' ? root.settings : parsed;
  const settingsRecord = record(candidate);
  if (!Object.keys(settingsRecord).length) throw new Error('The settings JSON does not contain any settings.');
  return {
    version,
    settings: normalizeSettings(settingsRecord),
  };
}
