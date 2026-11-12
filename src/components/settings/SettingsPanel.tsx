/**
 * Settings shell. Each feature owns its section component; the panel only
 * composes them so the file stays readable as settings grow.
 */
import {
  Dismiss24Regular,
  Info24Regular,
  Translate24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { APP_VERSION, COMMIT_HASH, COMMIT_TIME, formatCommitTime } from '../../lib/buildInfo';
import { IconButton } from '../common/IconButton';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { LyricsSettings } from './LyricsSettings';
import { ShortcutSettings } from './ShortcutSettings';
import { VideoSettings } from './VideoSettings';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="settings-panel" role="document">
      <header className="settings-header">
        <div>
          <h2>{t('settings.title')}</h2>
          <p>{t('app.tagline')}</p>
        </div>
        <IconButton label={t('common.close')} variant="subtle" onClick={onClose}>
          <Dismiss24Regular />
        </IconButton>
      </header>

      <div className="settings-scroll">
        <AppearanceSettings />
        <LyricsSettings />
        <VideoSettings />
        <ShortcutSettings />
        <DataSettings />

        <section className="settings-section about-section" aria-labelledby="settings-about">
          <h3 id="settings-about" className="section-title">
            <Info24Regular /> {t('settings.about')}
          </h3>
          <div className="about-card">
            <span className="about-mark" aria-hidden="true"><img src="icons/icon-192.png" alt="" /></span>
            <div>
              <strong>{t('app.name')}</strong>
              <p>{t('settings.version', { version: APP_VERSION })}</p>
              <p title={COMMIT_HASH ? `commit ${COMMIT_HASH}` : undefined}>
                {t('settings.commitTime', { time: formatCommitTime(COMMIT_TIME) })}
              </p>
              <p>{t('settings.madeWith')}</p>
            </div>
          </div>
          <p className="language-note">
            <Translate24Regular /> {t('settings.languageHint')}
          </p>
        </section>
      </div>
    </div>
  );
}
