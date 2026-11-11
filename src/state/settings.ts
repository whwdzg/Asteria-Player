import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, ShortcutAction, ShortcutSpec } from '../lib/types';
import { clamp } from '../lib/format';
import {
  DEFAULT_SHORTCUTS,
  isSameShortcut,
  normalizeShortcuts,
} from '../lib/shortcuts';

interface SettingsState extends Settings {
  patch: (patch: Partial<Settings>) => void;
  setVolume: (value: number) => void;
  setBrightness: (value: number) => void;
  toggleMute: () => void;
  setEqGain: (index: number, value: number) => void;
  setPlaybackRate: (value: number) => void;
  setShortcut: (action: ShortcutAction, shortcut: ShortcutSpec | null) => void;
  resetShortcuts: () => void;
  setLastTrack: (id: string) => void;
  setLastPosition: (seconds: number) => void;
}

export const EQ_FREQUENCIES = [60, 230, 910, 3600, 14000] as const;

export const DEFAULT_SETTINGS: Settings = {
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
  shortcuts: DEFAULT_SHORTCUTS,
  lastTrackId: undefined,
  lastPosition: 0,
  reduceMotion: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      patch: (patch) => set((state) => ({ ...state, ...patch })),
      setVolume: (value) => set({ volume: clamp(value, 0, 1.2), muted: false }),
      setBrightness: (value) => set({ brightness: clamp(value, 0, 1) }),
      toggleMute: () => set((state) => ({ muted: !state.muted })),
      setEqGain: (index, value) => set((state) => {
        const eqGains = [...state.eqGains];
        eqGains[index] = clamp(value, -12, 12);
        return { eqGains };
      }),
      setPlaybackRate: (value) => set({ playbackRate: clamp(Math.round(value * 100) / 100, 0.25, 4) }),
      setShortcut: (action, shortcut) => set((state) => {
        const shortcuts = { ...state.shortcuts };
        if (shortcut) {
          for (const key of Object.keys(shortcuts) as ShortcutAction[]) {
            if (key !== action && isSameShortcut(shortcuts[key], shortcut)) shortcuts[key] = null;
          }
        }
        shortcuts[action] = shortcut;
        return { shortcuts };
      }),
      resetShortcuts: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
      setLastTrack: (id) => set({ lastTrackId: id }),
      setLastPosition: (seconds) => set({ lastPosition: Math.max(0, seconds) }),
    }),
    {
      name: 'asteria-settings',
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        liquidGlass: state.liquidGlass,
        dynamicBackground: state.dynamicBackground,
        backgroundBpm: state.backgroundBpm,
        backgroundVideo: state.backgroundVideo,
        lyricSize: state.lyricSize,
        lyricWeight: state.lyricWeight,
        lyricTranslationSize: state.lyricTranslationSize,
        lyricBlur: state.lyricBlur,
        lyricFont: state.lyricFont,
        showTranslation: state.showTranslation,
        subtitleLang: state.subtitleLang,
        subtitleBgOpacity: state.subtitleBgOpacity,
        subtitleTextOpacity: state.subtitleTextOpacity,
        subtitleFont: state.subtitleFont,
        danmakuEnabled: state.danmakuEnabled,
        danmakuTop: state.danmakuTop,
        danmakuScroll: state.danmakuScroll,
        danmakuWeight: state.danmakuWeight,
        danmakuOpacity: state.danmakuOpacity,
        danmakuSpeed: state.danmakuSpeed,
        danmakuFont: state.danmakuFont,
        volume: state.volume,
        brightness: state.brightness,
        muted: state.muted,
        playMode: state.playMode,
        playbackRate: state.playbackRate,
        eqEnabled: state.eqEnabled,
        eqGains: state.eqGains,
        shortcuts: state.shortcuts,
        lastTrackId: state.lastTrackId,
        lastPosition: state.lastPosition,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Settings>;
        return {
          ...current,
          ...saved,
          volume: clamp(saved.volume ?? current.volume, 0, 1.2),
          brightness: clamp(saved.brightness ?? current.brightness, 0, 1),
          playbackRate: clamp(saved.playbackRate ?? current.playbackRate, 0.25, 4),
          lyricSize: clamp(saved.lyricSize ?? current.lyricSize, 0.7, 1.6),
          lyricWeight: clamp(saved.lyricWeight ?? current.lyricWeight, 200, 800),
          lyricTranslationSize: clamp(saved.lyricTranslationSize ?? current.lyricTranslationSize, 0.4, 1.2),
          subtitleBgOpacity: clamp(saved.subtitleBgOpacity ?? current.subtitleBgOpacity, 0, 1),
          subtitleTextOpacity: clamp(saved.subtitleTextOpacity ?? current.subtitleTextOpacity, 0.2, 1),
          danmakuWeight: clamp(saved.danmakuWeight ?? current.danmakuWeight, 300, 800),
          danmakuOpacity: clamp(saved.danmakuOpacity ?? current.danmakuOpacity, 0.2, 1),
          danmakuSpeed: clamp(saved.danmakuSpeed ?? current.danmakuSpeed, 0.5, 2.5),
          eqGains: Array.isArray(saved.eqGains) && saved.eqGains.length === 5
            ? saved.eqGains.map((gain) => clamp(Number(gain) || 0, -12, 12))
            : current.eqGains,
          shortcuts: normalizeShortcuts(saved.shortcuts),
        };
      },
    },
  ),
);
