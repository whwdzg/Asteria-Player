import { useEffect } from 'react';
import { useUiStore } from '../state/ui';

/**
 * In full-screen video, the chrome only appears when the pointer is near the
 * bottom edge. It hides again after a short idle delay or when the pointer
 * moves back toward the picture.
 */
export function useAutoHideChrome(fullscreen: boolean, isVideo: boolean): void {
  const setChromeVisible = useUiStore((state) => state.setChromeVisible);
  const overlayOpen = useUiStore((state) => state.settingsOpen || state.popover !== null || state.queueView !== 'closed');

  useEffect(() => {
    if (!fullscreen || !isVideo || overlayOpen) {
      setChromeVisible(true);
      return;
    }

    let hideTimer = 0;
    let lastVisible = true;
    const reveal = (): void => {
      window.clearTimeout(hideTimer);
      if (!lastVisible) {
        lastVisible = true;
        setChromeVisible(true);
      }
      hideTimer = window.setTimeout(() => {
        lastVisible = false;
        setChromeVisible(false);
      }, 3200);
    };
    const hide = (): void => {
      window.clearTimeout(hideTimer);
      if (lastVisible) {
        lastVisible = false;
        setChromeVisible(false);
      }
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') return;
      const nearBottom = window.innerHeight - event.clientY < 160;
      const target = event.target;
      const overBar = target instanceof Element && target.closest('.bottom-bar, .video-top-tools');
      if (nearBottom || overBar) reveal();
      else if (!overBar) hide();
    };
    const onPointerLeave = (): void => hide();
    const onTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch) return;
      if (window.innerHeight - touch.clientY < 180) reveal();
    };

    reveal();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('touchstart', onTouchStart);
    };
  }, [fullscreen, isVideo, overlayOpen, setChromeVisible]);
}
