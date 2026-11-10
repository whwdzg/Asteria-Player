import { create } from 'zustand';

interface ClockState {
  time: number;
  duration: number;
  buffered: number;
  setClock: (time: number, buffered?: number) => void;
  setDuration: (duration: number) => void;
  setBuffered: (buffered: number) => void;
  reset: () => void;
}

export const useClockStore = create<ClockState>()((set) => ({
  time: 0,
  duration: 0,
  buffered: 0,
  setClock: (time, buffered) => set((state) => ({
    time,
    buffered: buffered === undefined ? state.buffered : buffered,
  })),
  setDuration: (duration) => set({ duration }),
  setBuffered: (buffered) => set({ buffered }),
  reset: () => set({ time: 0, duration: 0, buffered: 0 }),
}));
