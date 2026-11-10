import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useUiStore } from '../state/ui';
import { useI18n } from '../i18n/I18nProvider';

interface FullscreenApi {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

export function useFullscreen(appRef: RefObject<HTMLElement | null>): {
  fullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
} {
  const { t } = useI18n();
  const fullscreen = useUiStore((state) => state.fullscreen);
  const setFullscreen = useUiStore((state) => state.setFullscreen);
  const pseudo = useRef(false);

  useEffect(() => {
    const doc = document as FullscreenDocument;
    const onChange = (): void => {
      const native = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
      if (!native && !pseudo.current) setFullscreen(false);
      else if (native) setFullscreen(true);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [setFullscreen]);

  const exitFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    } catch {
      // Ignore; state is corrected below.
    }
    pseudo.current = false;
    setFullscreen(false);
  }, [setFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreen) {
      await exitFullscreen();
      return;
    }
    const element = appRef.current as (HTMLElement & FullscreenApi) | null;
    if (!element) return;
    try {
      if (element.requestFullscreen) await element.requestFullscreen();
      else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
      else {
        pseudo.current = true;
        setFullscreen(true);
      }
    } catch {
      pseudo.current = true;
      setFullscreen(true);
      useUiStore.getState().pushToast(t('toast.fullscreenUnavailable'), 'error');
    }
  }, [appRef, exitFullscreen, fullscreen, setFullscreen, t]);

  return { fullscreen, toggleFullscreen, exitFullscreen };
}
