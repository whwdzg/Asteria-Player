import { create } from 'zustand';
import { uid } from '../lib/format';

export type QueueView = 'closed' | 'sidebar' | 'full';
export type PopoverId = 'volume' | 'brightness' | null;

interface Toast {
  id: string;
  message: string;
  tone: 'default' | 'error';
}

interface UiState {
  queueView: QueueView;
  settingsOpen: boolean;
  popover: PopoverId;
  detailsTrackId: string | null;
  playlistDialogOpen: boolean;
  playlistDialogTrackIds: string[];
  fullscreen: boolean;
  chromeVisible: boolean;
  dragActive: boolean;
  importing: { done: number; total: number } | null;
  toasts: Toast[];
  openQueue: (view?: QueueView) => void;
  setQueueView: (view: QueueView) => void;
  setSettingsOpen: (open: boolean) => void;
  setPopover: (popover: PopoverId) => void;
  setDetailsTrackId: (id: string | null) => void;
  openPlaylistDialog: (trackIds?: string[]) => void;
  closePlaylistDialog: () => void;
  setFullscreen: (fullscreen: boolean) => void;
  setChromeVisible: (visible: boolean) => void;
  setDragActive: (active: boolean) => void;
  setImporting: (progress: { done: number; total: number } | null) => void;
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  closeOverlays: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  queueView: 'closed',
  settingsOpen: false,
  popover: null,
  detailsTrackId: null,
  playlistDialogOpen: false,
  playlistDialogTrackIds: [],
  fullscreen: false,
  chromeVisible: true,
  dragActive: false,
  importing: null,
  toasts: [],
  openQueue: (view = 'sidebar') => set({ queueView: view, settingsOpen: false, popover: null }),
  setQueueView: (queueView) => set({ queueView }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen, popover: null, queueView: 'closed' }),
  setPopover: (popover) => set({ popover, settingsOpen: false }),
  setDetailsTrackId: (detailsTrackId) => set({ detailsTrackId }),
  openPlaylistDialog: (playlistDialogTrackIds = []) => set({ playlistDialogOpen: true, playlistDialogTrackIds }),
  closePlaylistDialog: () => set({ playlistDialogOpen: false, playlistDialogTrackIds: [] }),
  setFullscreen: (fullscreen) => set({ fullscreen, chromeVisible: true }),
  setChromeVisible: (chromeVisible) => set({ chromeVisible }),
  setDragActive: (dragActive) => set({ dragActive }),
  setImporting: (importing) => set({ importing }),
  pushToast: (message, tone = 'default') => {
    const id = uid('toast');
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, tone }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, tone === 'error' ? 4800 : 3000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  closeOverlays: () => set({ settingsOpen: false, queueView: 'closed', popover: null }),
}));
