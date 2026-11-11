import {
  Dismiss24Regular,
  Info24Regular,
  Translate24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { IconButton } from '../common/IconButton';
import { AppearanceSettings } from './AppearanceSettings';
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

        <section className="settings-section about-section" aria-labelledby="settings-about">
          <h3 id="settings-about" className="section-title">
            <Info24Regular /> {t('settings.about')}
          </h3>
          <div className="about-card">
            <span className="about-mark" aria-hidden="true">A</span>
            <div>
              <strong>{t('app.name')}</strong>
              <p>{t('settings.version')}</p>
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
