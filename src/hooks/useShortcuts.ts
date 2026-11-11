import { useSettingsStore } from '../state/settings';
import { formatShortcut } from '../lib/shortcuts';
import type { ShortcutAction } from '../lib/types';

/** A localized label with its current shortcut appended, e.g. "Full screen (F)". */
export function useShortcutHint(action: ShortcutAction): string {
  const spec = useSettingsStore((state) => state.shortcuts[action]);
  return spec ? ` (${formatShortcut(spec)})` : '';
}

export function useShortcutTooltip(action: ShortcutAction, label: string): string {
  const hint = useShortcutHint(action);
  return `${label}${hint}`;
}
