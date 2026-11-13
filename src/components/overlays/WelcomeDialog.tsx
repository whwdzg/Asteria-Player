import {
  ArrowDownload24Regular,
  ArrowImport24Regular,
  FolderOpen24Regular,
  Link24Regular,
  PhoneDesktop24Regular,
  Play24Filled,
} from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { promptPwaInstall, subscribeInstallPrompt } from '../../lib/pwaInstall';
import { useUiStore } from '../../state/ui';
import { Modal } from '../common/Modal';

interface WelcomeDialogProps {
  showPwaHint?: boolean;
  onOpenFiles: () => void;
  onOpenFolder: () => void;
  onOpenUrl: () => void;
  onUseDemo: () => void;
}

/** First-run choice: import real content now, or deliberately load the demo. */
export function WelcomeDialog({
  showPwaHint = false,
  onOpenFiles,
  onOpenFolder,
  onOpenUrl,
  onUseDemo,
}: WelcomeDialogProps): React.ReactElement {
  const { t } = useI18n();
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);

  useEffect(() => subscribeInstallPrompt(setInstallAvailable), []);

  const install = async (): Promise<void> => {
    const outcome = await promptPwaInstall();
    if (outcome === 'accepted') {
      useUiStore.getState().pushToast(t('settings.installAccepted'));
      return;
    }
    if (outcome === 'dismissed') {
      useUiStore.getState().pushToast(t('settings.installDismissed'), 'error');
      return;
    }
    setInstallHelp(true);
  };

  return (
    <Modal
      open
      onClose={onUseDemo}
      title={t('welcome.title')}
      closeLabel={t('common.close')}
      size="md"
      footer={
        <button type="button" className="fluent-button" onClick={onUseDemo}>
          <Play24Filled /> {t('welcome.useDemo')}
        </button>
      }
    >
      <div className="welcome-dialog">
        <img className="welcome-mark" src="icons/icon-192.png" alt="" aria-hidden="true" />
        <h3>{t('welcome.heading')}</h3>
        <p>{t('welcome.hint')}</p>
        <div className="welcome-actions">
          <button type="button" className="fluent-button primary" onClick={onOpenFiles}>
            <ArrowImport24Regular /> {t('menu.importFiles')}
          </button>
          <button type="button" className="fluent-button" onClick={onOpenFolder}>
            <FolderOpen24Regular /> {t('menu.importFolder')}
          </button>
          <button type="button" className="fluent-button" onClick={onOpenUrl}>
            <Link24Regular /> {t('menu.importUrl')}
          </button>
        </div>
        {showPwaHint ? (
          <div className="welcome-pwa-hint">
            <PhoneDesktop24Regular />
            <div className="welcome-pwa-copy">
              <span>{t('welcome.pwaHint')}</span>
              <button
                type="button"
                className={`fluent-button welcome-pwa-install ${installAvailable ? 'primary' : ''}`.trim()}
                onClick={() => void install()}
              >
                <ArrowDownload24Regular /> {t('welcome.installPwa')}
              </button>
              {installHelp ? (
                <div className="welcome-pwa-guide">
                  <span>{t('welcome.installUnavailable')}</span>
                  <span>{t('settings.installChromium')}</span>
                  <span>{t('settings.installIos')}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <p className="welcome-note">{t('welcome.note')}</p>
      </div>
    </Modal>
  );
}
