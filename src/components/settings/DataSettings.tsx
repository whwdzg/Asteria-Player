import { useState } from 'react';
import { Code24Regular } from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { SettingsJsonDialog } from './SettingsJsonDialog';

/**
 * Entry point for the JSON-backed settings workflow. Keeping the editor in a
 * dedicated component makes the large settings panel easier to scan.
 */
export function DataSettings(): React.ReactElement {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <section className="settings-section" aria-labelledby="settings-data">
      <h3 id="settings-data" className="section-title">
        <Code24Regular /> {t('settings.data')}
      </h3>
      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.editJson')}</span>
          <small>{t('settings.dataHint')}</small>
        </div>
        <button type="button" className="fluent-button" onClick={() => setOpen(true)}>
          {t('settings.dataOpen')}
        </button>
      </div>
      {open ? <SettingsJsonDialog onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
