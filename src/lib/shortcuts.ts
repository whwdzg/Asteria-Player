import type { ShortcutAction, ShortcutMap, ShortcutSpec } from './types';

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  'playPause',
  'previous',
  'next',
  'rewind10',
  'forward10',
  'cycleMode',
  'seekBack5',
  'seekForward5',
  'fullscreen',
  'mute',
  'volumeUp',
  'volumeDown',
  'queue',
  'settings',
];

function spec(
  code: string,
  modifiers: Partial<Pick<ShortcutSpec, 'ctrl' | 'alt' | 'shift' | 'meta'>> = {},
): ShortcutSpec {
  return {
    code,
    ctrl: modifiers.ctrl ?? false,
    alt: modifiers.alt ?? false,
    shift: modifiers.shift ?? false,
    meta: modifiers.meta ?? false,
  };
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  playPause: spec('Space'),
  previous: spec('ArrowLeft', { alt: true }),
  next: spec('ArrowRight', { alt: true }),
  rewind10: spec('KeyJ'),
  forward10: spec('KeyL'),
  cycleMode: spec('KeyR'),
  seekBack5: spec('ArrowLeft'),
  seekForward5: spec('ArrowRight'),
  fullscreen: spec('KeyF'),
  mute: spec('KeyM'),
  volumeUp: spec('ArrowUp'),
  volumeDown: spec('ArrowDown'),
  queue: spec('KeyQ'),
  settings: spec('KeyS'),
};

const KEY_LABELS: Record<string, string> = {
  Space: 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Del',
  Insert: 'Ins',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Tab: 'Tab',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

export function keyLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  return code;
}

export function formatShortcut(value: ShortcutSpec | null | undefined): string {
  if (!value) return '';
  const parts: string[] = [];
  if (value.ctrl) parts.push('Ctrl');
  if (value.alt) parts.push('Alt');
  if (value.shift) parts.push('Shift');
  if (value.meta) parts.push('Meta');
  parts.push(keyLabel(value.code));
  return parts.join('+');
}

export function isSameShortcut(a: ShortcutSpec | null, b: ShortcutSpec | null): boolean {
  if (!a || !b) return a === b;
  return a.code === b.code && a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.meta === b.meta;
}

const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight',
]);

export function eventToShortcut(event: KeyboardEvent): ShortcutSpec | null {
  if (MODIFIER_CODES.has(event.code)) return null;
  return {
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

export function matchesShortcut(event: KeyboardEvent, value: ShortcutSpec | null): boolean {
  if (!value) return false;
  return event.code === value.code
    && (event.ctrlKey || false) === value.ctrl
    && (event.altKey || false) === value.alt
    && (event.shiftKey || false) === value.shift
    && (event.metaKey || false) === value.meta;
}

export function sanitizeShortcut(value: unknown): ShortcutSpec | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.code !== 'string' || !record.code) return null;
  return {
    code: record.code,
    ctrl: Boolean(record.ctrl),
    alt: Boolean(record.alt),
    shift: Boolean(record.shift),
    meta: Boolean(record.meta),
  };
}

export function normalizeShortcuts(value: unknown): ShortcutMap {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_SHORTCUTS };
  for (const action of SHORTCUT_ACTIONS) {
    if (action in record) result[action] = sanitizeShortcut(record[action]);
  }
  return result;
}
