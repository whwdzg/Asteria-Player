import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Playlist, Track } from '../lib/types';
import { uid } from '../lib/format';

interface LibraryState {
  tracks: Track[];
  queue: string[];
  currentId: string | null;
  sequenceId: string;
  playlists: Playlist[];
  loaded: boolean;
  setLoaded: (loaded: boolean) => void;
  setDemoTracks: (tracks: Track[]) => void;
  addTracks: (tracks: Track[]) => Track[];
  removeTracks: (ids: string[]) => void;
  updateTrackDuration: (id: string, duration: number) => void;
  setCurrent: (id: string | null) => void;
  setQueue: (ids: string[], sequenceId?: string) => void;
  setSequence: (id: string) => void;
  addPlaylist: (name: string, trackIds?: string[]) => Playlist;
  addToPlaylist: (playlistId: string, trackIds: string[]) => void;
  removeFromPlaylist: (playlistId: string, trackIds: string[]) => void;
  insertNext: (trackId: string) => void;
  addToQueue: (trackId: string) => void;
  queueTrack: (trackId: string) => void;
}

export const ALL_SEQUENCE = 'all';

export const useLibraryStore = create<LibraryState>()(persist((set, get) => ({
  tracks: [],
  queue: [],
  currentId: null,
  sequenceId: ALL_SEQUENCE,
  playlists: [],
  loaded: false,
  setLoaded: (loaded) => set({ loaded }),
  setDemoTracks: (tracks) => {
    if (!tracks.length) {
      set({ loaded: true });
      return;
    }
    const existing = get().tracks;
    const merged = [...tracks];
    for (const track of existing) {
      if (!merged.some((item) => item.id === track.id)) merged.push(track);
    }
    set({
      tracks: merged,
      queue: get().sequenceId === ALL_SEQUENCE ? merged.map((track) => track.id) : get().queue,
      loaded: true,
    });
  },
  addTracks: (tracks) => {
    const existing = get().tracks;
    const accepted = tracks.filter((track) => !existing.some((item) => item.id === track.id));
    if (!accepted.length) return [];
    const merged = [...existing, ...accepted];
    const queue = get().sequenceId === ALL_SEQUENCE
      ? merged.map((track) => track.id)
      : [...get().queue, ...accepted.map((track) => track.id)];
    set({ tracks: merged, queue });
    return accepted;
  },
  removeTracks: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({
      tracks: state.tracks.filter((track) => !idSet.has(track.id)),
      queue: state.queue.filter((id) => !idSet.has(id)),
      playlists: state.playlists.map((playlist) => ({
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => !idSet.has(id)),
      })),
      currentId: state.currentId && idSet.has(state.currentId) ? null : state.currentId,
    }));
  },
  updateTrackDuration: (id, duration) => set((state) => ({
    tracks: state.tracks.map((track) => (track.id === id && duration > 0 && Math.abs(track.duration - duration) > 0.5
      ? { ...track, duration }
      : track)),
  })),
  setCurrent: (id) => set({ currentId: id }),
  setQueue: (ids, sequenceId = ALL_SEQUENCE) => set({ queue: ids, sequenceId }),
  setSequence: (id) => {
    const state = get();
    if (id === ALL_SEQUENCE) {
      set({ sequenceId: ALL_SEQUENCE, queue: state.tracks.map((track) => track.id) });
      return;
    }
    const playlist = state.playlists.find((item) => item.id === id);
    if (!playlist) return;
    const known = new Set(state.tracks.map((track) => track.id));
    set({ sequenceId: id, queue: playlist.trackIds.filter((trackId) => known.has(trackId)) });
  },
  addPlaylist: (name, trackIds = []) => {
    const playlist: Playlist = {
      id: uid('seq'),
      name: name.trim() || 'Sequence',
      trackIds,
      createdAt: Date.now(),
    };
    set((state) => ({ playlists: [...state.playlists, playlist] }));
    return playlist;
  },
  addToPlaylist: (playlistId, trackIds) => set((state) => ({
    playlists: state.playlists.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      const known = new Set(playlist.trackIds);
      return { ...playlist, trackIds: [...playlist.trackIds, ...trackIds.filter((id) => !known.has(id))] };
    }),
  })),
  removeFromPlaylist: (playlistId, trackIds) => set((state) => {
    const idSet = new Set(trackIds);
    const playlists = state.playlists.map((playlist) => playlist.id === playlistId
      ? { ...playlist, trackIds: playlist.trackIds.filter((id) => !idSet.has(id)) }
      : playlist);
    const active = playlists.find((playlist) => playlist.id === state.sequenceId);
    return {
      playlists,
      queue: active ? state.queue.filter((id) => !idSet.has(id)) : state.queue,
    };
  }),
  insertNext: (trackId) => set((state) => {
    const queue = [...state.queue];
    if (queue.includes(trackId)) queue.splice(queue.indexOf(trackId), 1);
    const at = state.currentId ? queue.indexOf(state.currentId) : -1;
    queue.splice(at >= 0 ? at + 1 : queue.length, 0, trackId);
    return { queue };
  }),
  addToQueue: (trackId) => set((state) => ({
    queue: state.queue.includes(trackId) ? state.queue : [...state.queue, trackId],
  })),
  queueTrack: (trackId) => {
    const state = get();
    if (!state.queue.includes(trackId)) set({ queue: [...state.queue, trackId] });
  },
}), {
  name: 'asteria-sequences',
  version: 1,
  partialize: (state) => ({ playlists: state.playlists }),
}));

export function selectCurrentTrack(state: LibraryState): Track | undefined {
  return state.tracks.find((track) => track.id === state.currentId);
}

export function selectQueueTracks(state: LibraryState): Track[] {
  const byId = new Map(state.tracks.map((track) => [track.id, track]));
  return state.queue.map((id) => byId.get(id)).filter((track): track is Track => Boolean(track));
}
