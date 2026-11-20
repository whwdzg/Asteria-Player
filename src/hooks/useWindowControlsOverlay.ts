import { useEffect } from 'react';

interface ControlsOverlay extends EventTarget {
  visible: boolean;
}

type NavigatorWithControlsOverlay = Navigator & {
  windowControlsOverlay?: ControlsOverlay;
};

/**
 * Enables the custom titlebar layout only when an installed Chromium PWA is
 * actually showing the Window Controls Overlay. In a normal tab this is a no-op.
 */
export function useWindowControlsOverlay(): void {
  useEffect(() => {
    const overlay = (navigator as NavigatorWithControlsOverlay).windowControlsOverlay;
    if (!overlay) return;
    const update = (): void => {
      document.documentElement.classList.toggle('is-wco', overlay.visible);
    };
    update();
    overlay.addEventListener('geometrychange', update);
    return () => {
      overlay.removeEventListener('geometrychange', update);
      document.documentElement.classList.remove('is-wco');
    };
  }, []);
}
