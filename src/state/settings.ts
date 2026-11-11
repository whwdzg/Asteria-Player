/**
 * Persisted settings store. The JSON document is the public interchange format;
 * this store only adds immediate UI actions and normalisation on hydration.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, ShortcutAction, ShortcutSpec } from '../lib/types';
import { clamp } from '../lib/format';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '../lib/settingsJson';
import { isSameShortcut } from '../lib/shortcuts';

interface SettingsState extends Settings {
  patch: (patch: Partial<Settings>) => void;
  setVolume: (value: number) => void;
  setBrightness: (value: number) => void;
  toggleMute: () => void;
  setEqGain: (index: number, value: number) => void;
  setPlaybackRate: (value: number) => void;
  setShortcut: (action: ShortcutAction, shortcut: ShortcutSpec | null) => void;
  resetShortcuts: () => void;
  replaceSettings: (settings: Settings) => void;
  resetSettings: () => void;
  setLastTrack: (id: string) => void;
  setLastPosition: (seconds: number) => void;
}

export const EQ_FREQUENCIES = [60, 230, 910, 3600, 14000] as const;
export { DEFAULT_SETTINGS } from '../lib/settingsJson';

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
      resetShortcuts: () => set({ shortcuts: { ...DEFAULT_SETTINGS.shortcuts } }),
      replaceSettings: (settings) => set(normalizeSettings(settings)),
      resetSettings: () => set(normalizeSettings(DEFAULT_SETTINGS)),
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
        bilibiliProxy: state.bilibiliProxy,
        lastTrackId: state.lastTrackId,
        lastPosition: state.lastPosition,
      }),
      merge: (persisted, current) => ({ ...current, ...normalizeSettings(persisted, current) }),
    },
  ),
);
