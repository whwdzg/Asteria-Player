import { useEffect, useState } from 'react';

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
}

/**
 * Native fullscreen only paints the fullscreen element and its descendants.
 * Portals must therefore be mounted inside that element; mounting them on
 * `document.body` makes modals, dropdowns and the artwork lightbox invisible
 * while the player is fullscreen.
 */
export function overlayRoot(): HTMLElement {
  const doc = document as FullscreenDocument;
  const element = document.fullscreenElement ?? doc.webkitFullscreenElement;
  return element instanceof HTMLElement ? element : document.body;
}

/** Stable overlay root that follows entering/leaving native fullscreen. */
export function useOverlayRoot(): HTMLElement {
  const [root, setRoot] = useState<HTMLElement>(() => overlayRoot());

  useEffect(() => {
    const update = (): void => setRoot(overlayRoot());
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
    };
  }, []);

  return root;
}
