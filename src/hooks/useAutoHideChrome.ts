import { useEffect } from 'react';
import { useUiStore } from '../state/ui';

/**
 * Video chrome hides after a short idle period. Full-screen video reveals the
 * bar and the top buttons on any pointer movement; touch devices can also
 * toggle it with a single tap on the picture.
 */
export function useAutoHideChrome(fullscreen: boolean, isVideo: boolean, isTouch: boolean): void {
  const setChromeVisible = useUiStore((state) => state.setChromeVisible);
  const overlayOpen = useUiStore((state) => state.settingsOpen || state.popover !== null || state.queueView !== 'closed');

  useEffect(() => {
    // The mobile bar stays visible outside fullscreen; only immersive
    // fullscreen video may hide chrome.
    if (!isVideo || !fullscreen || overlayOpen) {
      setChromeVisible(true);
      return;
    }

    let hideTimer = 0;
    const reveal = (): void => {
      window.clearTimeout(hideTimer);
      setChromeVisible(true);
      hideTimer = window.setTimeout(() => setChromeVisible(false), 3200);
    };
    const hide = (): void => {
      window.clearTimeout(hideTimer);
      setChromeVisible(false);
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') return;
      reveal();
    };
    const onPointerLeave = (event: PointerEvent): void => {
      // Touch pointers fire pointerleave on lift-off; only a real mouse
      // leaving the window should hide the UI.
      if (event.pointerType === 'touch') return;
      hide();
    };
    const onReveal = (): void => reveal();

    reveal();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('asteria:reveal-chrome', onReveal);
    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('asteria:reveal-chrome', onReveal);
    };
  }, [fullscreen, isVideo, isTouch, overlayOpen, setChromeVisible]);
}
