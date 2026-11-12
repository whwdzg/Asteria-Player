import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, normalizeShortcuts } from './shortcuts';

describe('keyboard shortcuts', () => {
  it('ships volume up/down defaults and keeps them when old settings are loaded', () => {
    expect(SHORTCUT_ACTIONS).toHaveLength(14);
    expect(DEFAULT_SHORTCUTS.volumeUp?.code).toBe('ArrowUp');
    expect(DEFAULT_SHORTCUTS.volumeDown?.code).toBe('ArrowDown');
    const migrated = normalizeShortcuts({ playPause: { code: 'Space' } });
    expect(migrated.volumeUp?.code).toBe('ArrowUp');
    expect(migrated.volumeDown?.code).toBe('ArrowDown');
  });
});
