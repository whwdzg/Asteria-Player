import { useEffect, useRef } from 'react';

export const MOBILE_BACK_EVENT = 'asteria:mobile-back';

/**
 * Adds one history guard while a mobile page is open. Browser/Android back
 * removes the guard, closes the page, and leaves the app's main history entry
 * untouched. Closing the page from its own button removes the guard too.
 */
export function useMobileBackNavigation(
  enabled: boolean,
  open: boolean,
  onBack: () => void,
): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled || !open) return;
    let pushed = false;
    if (!window.history.state?.asteriaMobileBack) {
      window.history.pushState({ ...window.history.state, asteriaMobileBack: true }, '');
      pushed = true;
    }
    const handlePop = (): void => {
      pushed = false;
      onBackRef.current();
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (pushed && window.history.state?.asteriaMobileBack) {
        window.history.back();
      }
    };
  }, [enabled, open]);
}
