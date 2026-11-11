import { useEffect } from 'react';
import { isEditableTarget } from '../lib/format';
import { matchesShortcut, SHORTCUT_ACTIONS } from '../lib/shortcuts';
import type { ShortcutAction } from '../lib/types';
import { player } from '../player/engine';
import { useSettingsStore } from '../state/settings';
import { useUiStore } from '../state/ui';

interface ShortcutOptions {
  toggleFullscreen: () => void;
  exitFullscreen: () => void;
}

export function useKeyboardShortcuts({ toggleFullscreen, exitFullscreen }: ShortcutOptions): void {
  const shortcuts = useSettingsStore((state) => state.shortcuts);

  useEffect(() => {
    const run = (action: ShortcutAction): void => {
      const ui = useUiStore.getState();
      const settings = useSettingsStore.getState();
      switch (action) {
        case 'playPause': player.toggle(); break;
        case 'previous': player.previous(); break;
        case 'next': player.next(); break;
        case 'rewind10': player.rewind(); break;
        case 'forward10': player.forward(); break;
        case 'cycleMode': {
          const modes = ['all', 'one', 'none', 'shuffle'] as const;
          const index = modes.indexOf(settings.playMode);
          settings.patch({ playMode: modes[(index + 1) % modes.length] });
          break;
        }
        case 'seekBack5': player.seekBy(-5); break;
        case 'seekForward5': player.seekBy(5); break;
        case 'fullscreen': toggleFullscreen(); break;
        case 'mute': settings.toggleMute(); break;
        case 'queue':
          if (ui.queueView === 'closed') ui.openQueue('sidebar');
          else ui.setQueueView('closed');
          break;
        case 'settings': ui.setSettingsOpen(!ui.settingsOpen); break;
        default: break;
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target) || event.repeat) return;
      const ui = useUiStore.getState();

      if (event.key === 'Escape') {
        if (ui.detailsTrackId || ui.playlistDialogOpen) return;
        if (ui.settingsOpen) { ui.setSettingsOpen(false); return; }
        if (ui.popover) { ui.setPopover(null); return; }
        if (ui.queueView !== 'closed') { ui.setQueueView('closed'); return; }
        if (ui.fullscreen && !document.fullscreenElement) exitFullscreen();
        return;
      }
      if (ui.detailsTrackId || ui.playlistDialogOpen) return;

      const action = SHORTCUT_ACTIONS.find((candidate) => matchesShortcut(event, shortcuts[candidate]));
      if (!action) return;
      const interactive = event.target instanceof HTMLElement
        && event.target.closest('button, a, [role="button"], [role="slider"], [role="menuitem"], [role="option"]');
      if (interactive && (event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter')) return;
      event.preventDefault();
      run(action);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exitFullscreen, shortcuts, toggleFullscreen]);
}
