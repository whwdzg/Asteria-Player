import { useEffect } from 'react';
import { isEditableTarget } from '../lib/format';
import { player } from '../player/engine';
import { useSettingsStore } from '../state/settings';
import { useUiStore } from '../state/ui';

interface ShortcutOptions {
  toggleFullscreen: () => void;
  exitFullscreen: () => void;
}

export function useKeyboardShortcuts({ toggleFullscreen, exitFullscreen }: ShortcutOptions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (isEditableTarget(target)) return;
      const ui = useUiStore.getState();
      if (event.key === 'Escape') {
        if (ui.detailsTrackId) return;
        if (ui.playlistDialogOpen) return;
        if (ui.settingsOpen) {
          ui.setSettingsOpen(false);
          return;
        }
        if (ui.popover) {
          ui.setPopover(null);
          return;
        }
        if (ui.queueView !== 'closed') {
          ui.setQueueView('closed');
          return;
        }
        if (ui.fullscreen && !document.fullscreenElement) {
          exitFullscreen();
        }
        return;
      }
      if (ui.detailsTrackId || ui.playlistDialogOpen) return;

      const interactive = target instanceof HTMLElement && target.closest('button, a, [role="button"], [role="slider"], [role="menuitem"]');
      if (event.code === 'Space' || event.key === ' ') {
        if (interactive) return;
        event.preventDefault();
        player.toggle();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (interactive) return;
        event.preventDefault();
        const step = event.shiftKey ? 30 : 5;
        player.seekBy(event.key === 'ArrowLeft' ? -step : step);
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (interactive) return;
        event.preventDefault();
        const settings = useSettingsStore.getState();
        const delta = event.key === 'ArrowUp' ? 0.05 : -0.05;
        settings.setVolume(Math.min(1.2, Math.max(0, settings.volume + delta)));
        return;
      }
      if (event.key.toLowerCase() === 'm') {
        useSettingsStore.getState().toggleMute();
      } else if (event.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (event.key.toLowerCase() === 'q') {
        if (ui.queueView === 'closed') ui.openQueue('sidebar');
        else ui.setQueueView('closed');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exitFullscreen, toggleFullscreen]);
}
