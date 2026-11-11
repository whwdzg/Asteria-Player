import { useEffect, useState } from 'react';

export function useTouchDevice(): boolean {
  const [touch, setTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  });

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const update = (): void => setTouch(query.matches || navigator.maxTouchPoints > 0);
    query.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return touch;
}
