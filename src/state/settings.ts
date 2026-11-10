import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../lib/types';
import { clamp } from '../lib/format';

interface SettingsState extends Settings {
  patch: (patch: Partial<Settings>) => void;
  setVolume: (value: number) => void;
  setBrightness: (value: number) => void;
  toggleMute: () => void;
  setEqGain: (index: number, value: number) => void;
  setLastTrack: (id: string) => void;
  setLastPosition: (seconds: number) => void;
}

export const EQ_FREQUENCIES = [60, 230, 910, 3600, 14000] as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'system',
  liquidGlass: true,
  lyricSize: 1,
  lyricWeight: 400,
  showTranslation: true,
  subtitleLang: 'auto',
  danmakuEnabled: true,
  danmakuTop: true,
  danmakuScroll: true,
  volume: 0.8,
  brightness: 1,
  muted: false,
  playMode: 'all',
  eqEnabled: false,
  eqGains: [0, 0, 0, 0, 0],
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
        lyricSize: state.lyricSize,
        lyricWeight: state.lyricWeight,
        showTranslation: state.showTranslation,
        subtitleLang: state.subtitleLang,
        danmakuEnabled: state.danmakuEnabled,
        danmakuTop: state.danmakuTop,
        danmakuScroll: state.danmakuScroll,
        volume: state.volume,
        brightness: state.brightness,
        muted: state.muted,
        playMode: state.playMode,
        eqEnabled: state.eqEnabled,
        eqGains: state.eqGains,
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
          eqGains: Array.isArray(saved.eqGains) && saved.eqGains.length === 5
            ? saved.eqGains.map((gain) => clamp(Number(gain) || 0, -12, 12))
            : current.eqGains,
        };
      },
    },
  ),
);
