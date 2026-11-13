import { create } from 'zustand';

export type SleepTimerMode = 'duration' | 'trackEnd';

interface SleepTimerState {
  enabled: boolean;
  minutes: number;
  mode: SleepTimerMode;
  endsAt: number | null;
  setEnabled: (enabled: boolean) => void;
  setMinutes: (minutes: number) => void;
  setMode: (mode: SleepTimerMode) => void;
  finish: () => void;
}

const clampMinutes = (value: number): number => Math.min(720, Math.max(1, Math.round(value)));

export const useSleepTimerStore = create<SleepTimerState>()((set, get) => ({
  enabled: false,
  minutes: 30,
  mode: 'duration',
  endsAt: null,
  setEnabled: (enabled) => {
    const state = get();
    if (!enabled) {
      set({ enabled: false, endsAt: null });
      return;
    }
    set({
      enabled: true,
      endsAt: state.mode === 'duration' ? Date.now() + state.minutes * 60_000 : null,
    });
  },
  setMinutes: (minutes) => {
    const value = clampMinutes(minutes);
    const state = get();
    set({
      minutes: value,
      endsAt: state.enabled && state.mode === 'duration' ? Date.now() + value * 60_000 : state.endsAt,
    });
  },
  setMode: (mode) => {
    const state = get();
    set({
      mode,
      endsAt: state.enabled && mode === 'duration' ? Date.now() + state.minutes * 60_000 : null,
    });
  },
  finish: () => set({ enabled: false, endsAt: null }),
}));

export function sleepRemainingMs(): number {
  const { enabled, mode, endsAt } = useSleepTimerStore.getState();
  if (!enabled || mode !== 'duration' || !endsAt) return 0;
  return Math.max(0, endsAt - Date.now());
}
