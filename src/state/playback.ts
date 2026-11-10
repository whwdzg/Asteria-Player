import { create } from 'zustand';

interface PlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  setPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  isPlaying: false,
  isLoading: true,
  error: null,
  setPlaying: (isPlaying) => set({ isPlaying }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
