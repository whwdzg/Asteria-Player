import {
  ArrowImport24Regular,
  FolderOpen24Regular,
  Link24Regular,
  Play24Filled,
} from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { Modal } from '../common/Modal';

interface WelcomeDialogProps {
  onOpenFiles: () => void;
  onOpenFolder: () => void;
  onOpenUrl: () => void;
  onUseDemo: () => void;
}

/** First-run choice: import real content now, or deliberately load the demo. */
export function WelcomeDialog({
  onOpenFiles,
  onOpenFolder,
  onOpenUrl,
  onUseDemo,
}: WelcomeDialogProps): React.ReactElement {
  const { t } = useI18n();
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
        <p className="welcome-note">{t('welcome.note')}</p>
      </div>
    </Modal>
  );
}
