import { Search24Regular } from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { useUiStore } from '../../state/ui';
import { Modal } from '../common/Modal';

/** Shown after a PWA restore when a lightweight probe finds unreadable media. */
export function ScanMediaPrompt(): React.ReactElement | null {
  const { t } = useI18n();
  const count = useUiStore((state) => state.scanPromptCount);
  const openScan = useUiStore((state) => state.openScanMedia);
  const dismiss = useUiStore((state) => state.dismissScanPrompt);
  if (count === null) return null;

  return (
    <Modal
      open
      onClose={dismiss}
      title={t('scan.promptTitle')}
      closeLabel={t('common.close')}
      size="sm"
      footer={
        <>
          <button type="button" className="fluent-button" onClick={dismiss}>{t('scan.later')}</button>
          <button type="button" className="fluent-button primary" onClick={openScan}>
            <Search24Regular /> {t('scan.scanNow')}
          </button>
        </>
      }
    >
      <p className="scan-media-hint">{t('scan.promptMessage', { count })}</p>
    </Modal>
  );
}
