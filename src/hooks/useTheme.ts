import { useEffect, useState } from 'react';
import { useSettingsStore } from '../state/settings';

export function useResolvedTheme(): 'dark' | 'light' {
  const theme = useSettingsStore((state) => state.theme);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (): void => setSystemDark(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

export function useAppearance(): 'dark' | 'light' {
  const resolved = useResolvedTheme();
  const liquidGlass = useSettingsStore((state) => state.liquidGlass);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.glass = liquidGlass ? 'on' : 'off';
    root.style.colorScheme = resolved;
  }, [resolved, liquidGlass]);

  return resolved;
}
