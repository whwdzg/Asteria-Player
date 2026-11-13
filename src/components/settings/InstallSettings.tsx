import { ArrowDownload24Regular, CheckmarkCircle24Filled, PhoneDesktop24Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { isPwaStandalone } from '../../lib/pwaLibrary';
import { promptPwaInstall, subscribeInstallPrompt } from '../../lib/pwaInstall';
import { useUiStore } from '../../state/ui';
import { Modal } from '../common/Modal';

/** Install prompt entry point; Chromium exposes beforeinstallprompt, other browsers get instructions. */
export function InstallSettings(): React.ReactElement {
  const { t } = useI18n();
  const pushToast = useUiStore((state) => state.pushToast);
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(() => isPwaStandalone());
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => subscribeInstallPrompt(setAvailable), []);

  const install = async (): Promise<void> => {
    const outcome = await promptPwaInstall();
    if (outcome === 'accepted') {
      setInstalled(true);
      setAvailable(false);
      pushToast(t('settings.installAccepted'));
    } else if (outcome === 'dismissed') {
      pushToast(t('settings.installDismissed'), 'error');
    } else {
      setHelpOpen(true);
    }
  };

  return (
    <section className="settings-section" aria-labelledby="settings-install">
      <h3 id="settings-install" className="section-title">
        <PhoneDesktop24Regular /> {t('settings.install')}
      </h3>
      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.installApp')}</span>
          <small>{installed ? t('settings.installedHint') : t('settings.installHint')}</small>
        </div>
        {installed ? (
          <span className="install-state"><CheckmarkCircle24Filled /> {t('settings.installed')}</span>
        ) : available ? (
          <button type="button" className="fluent-button primary" onClick={() => void install()}>
            <ArrowDownload24Regular /> {t('settings.installAction')}
          </button>
        ) : (
          <button type="button" className="fluent-button" onClick={() => setHelpOpen(true)}>
            {t('settings.installHelp')}
          </button>
        )}
      </div>
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('settings.installHelp')}
        closeLabel={t('common.close')}
        size="sm"
        footer={<button type="button" className="fluent-button primary" onClick={() => setHelpOpen(false)}>{t('common.close')}</button>}
      >
        <div className="install-help">
          <p>{t('settings.installHelpBody')}</p>
          <ul>
            <li>{t('settings.installChromium')}</li>
            <li>{t('settings.installIos')}</li>
          </ul>
        </div>
      </Modal>
    </section>
  );
}
