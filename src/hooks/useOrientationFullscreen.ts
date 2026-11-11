import { useEffect } from 'react';
import { useUiStore } from '../state/ui';
import { useTouchDevice } from './useTouchDevice';

/**
 * Phones and tablets switch to the immersive video layout when rotated to
 * landscape, and return to the normal layout in portrait. The immersive mode
 * is a CSS full-screen state so it is not blocked by browser gesture rules.
 */
export function useOrientationFullscreen(isVideo: boolean, exitFullscreen: () => Promise<void> | void): void {
  const isTouch = useTouchDevice();
  const setFullscreen = useUiStore((state) => state.setFullscreen);

  useEffect(() => {
    if (!isTouch || !isVideo) return;
    if (!window.matchMedia('(max-width: 1180px)').matches) return;
    const query = window.matchMedia('(orientation: landscape)');
    let previous = query.matches;

    const apply = (landscape: boolean): void => {
      if (landscape) {
        setFullscreen(true);
      } else if (document.fullscreenElement) {
        void exitFullscreen();
      } else {
        setFullscreen(false);
      }
    };

    if (query.matches) apply(true);
    const onChange = (): void => {
      if (query.matches === previous) return;
      previous = query.matches;
      apply(query.matches);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [exitFullscreen, isTouch, isVideo, setFullscreen]);
}
