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
  isVideo: boolean;
}

const TEMP_SPEED_DELAY = 450;

export function useKeyboardShortcuts({ toggleFullscreen, exitFullscreen, isVideo }: ShortcutOptions): void {
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

    let holdTimer = 0;
    let holdingSpeed = false;
    const restoreSpeed = (): void => {
      if (!holdingSpeed) return;
      holdingSpeed = false;
      const video = player.videoElement;
      if (video) video.playbackRate = useSettingsStore.getState().playbackRate;
      window.dispatchEvent(new CustomEvent('asteria:temp-speed', { detail: { active: false } }));
    };
    const startHold = (event: KeyboardEvent): void => {
      const ui = useUiStore.getState();
      if (ui.videoLocked) {
        window.dispatchEvent(new Event('asteria:lock-reveal'));
        return;
      }
      if (!isVideo || isEditableTarget(event.target)) return;
      if (event.code !== 'ArrowRight' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.repeat) return;
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => {
        const video = player.videoElement;
        if (!video) return;
        holdingSpeed = true;
        video.playbackRate = 2;
        window.dispatchEvent(new CustomEvent('asteria:temp-speed', { detail: { active: true } }));
      }, TEMP_SPEED_DELAY);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'ArrowRight') {
        window.clearTimeout(holdTimer);
        restoreSpeed();
      }
    };
    const onBlur = (): void => {
      window.clearTimeout(holdTimer);
      restoreSpeed();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target) || event.repeat) return;
      const ui = useUiStore.getState();
      if (ui.videoLocked) {
        event.preventDefault();
        window.dispatchEvent(new Event('asteria:lock-reveal'));
        return;
      }

      if (event.key === 'Escape') {
        if (ui.detailsTrackId || ui.playlistDialogOpen) return;
        if (ui.collectionView) { ui.closeCollection(); return; }
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
      if (interactive && action !== 'playPause' && (event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter')) return;
      event.preventDefault();
      run(action);
    };

    window.addEventListener('keydown', startHold);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.clearTimeout(holdTimer);
      restoreSpeed();
      window.removeEventListener('keydown', startHold);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [exitFullscreen, isVideo, shortcuts, toggleFullscreen]);
}
