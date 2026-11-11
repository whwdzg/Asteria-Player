import { ArrowReset24Regular, Play24Regular } from '@fluentui/react-icons';
import type { ShortcutAction } from '../../lib/types';
import { SHORTCUT_ACTIONS } from '../../lib/shortcuts';
import { useI18n } from '../../i18n/I18nProvider';
import { useSettingsStore } from '../../state/settings';
import { ShortcutRecorder } from './ShortcutRecorder';

export function ShortcutSettings(): React.ReactElement {
  const resetShortcuts = useSettingsStore((state) => state.resetShortcuts);
  const { t } = useI18n();

  return (
    <section className="settings-section" aria-labelledby="settings-playback">
      <h3 id="settings-playback" className="section-title">
        <Play24Regular /> {t('settings.shortcutsCustom')}
      </h3>
      <p className="shortcuts-hint">{t('settings.shortcutsHint')}</p>
      <p className="shortcut-capture-hint">{t('settings.shortcutsCustomHint')}</p>
      <div className="shortcut-list">
        {SHORTCUT_ACTIONS.map((action: ShortcutAction) => (
          <div className="shortcut-row" key={action}>
            <span>{t(`shortcut.${action}`)}</span>
            <ShortcutRecorder action={action} />
          </div>
        ))}
      </div>
      <button type="button" className="text-button shortcut-reset" onClick={resetShortcuts}>
        <ArrowReset24Regular /> {t('shortcut.reset')}
      </button>
    </section>
  );
}
