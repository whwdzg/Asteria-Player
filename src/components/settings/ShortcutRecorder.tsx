import { useEffect, useState } from 'react';
import type { ShortcutAction } from '../../lib/types';
import { eventToShortcut, formatShortcut } from '../../lib/shortcuts';
import { useSettingsStore } from '../../state/settings';
import { useI18n } from '../../i18n/I18nProvider';

interface ShortcutRecorderProps {
  action: ShortcutAction;
}

export function ShortcutRecorder({ action }: ShortcutRecorderProps): React.ReactElement {
  const spec = useSettingsStore((state) => state.shortcuts[action]);
  const setShortcut = useSettingsStore((state) => state.setShortcut);
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setRecording(false);
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        setShortcut(action, null);
        setRecording(false);
        return;
      }
      const next = eventToShortcut(event);
      if (!next) return;
      setShortcut(action, next);
      setRecording(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [action, recording, setShortcut]);

  return (
    <button
      type="button"
      className={`shortcut-key ${recording ? 'is-recording' : ''} ${spec ? '' : 'is-unset'}`.trim()}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      aria-label={`${t(`shortcut.${action}`)}: ${recording ? t('shortcut.recording') : formatShortcut(spec) || t('shortcut.unset')}`}
    >
      {recording ? t('shortcut.recording') : formatShortcut(spec) || t('shortcut.unset')}
    </button>
  );
}
