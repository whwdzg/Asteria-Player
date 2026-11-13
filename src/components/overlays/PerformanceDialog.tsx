import { Warning24Regular } from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { Modal } from '../common/Modal';

interface PerformanceDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onDismissPermanently: () => void;
}

const EFFECTS = [
  'settings.liquidGlass',
  'settings.dynamicBackground',
  'settings.backgroundBpm',
  'settings.backgroundVideo',
  'settings.audioVisualizer',
  'settings.lyricBlur',
] as const;

/** Offers the low-cost rendering profile after sustained playback jank. */
export function PerformanceDialog({
  open,
  onClose,
  onApply,
  onDismissPermanently,
}: PerformanceDialogProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('performance.title')}
      size="sm"
      className="performance-modal"
      closeLabel={t('common.close')}
      footer={(
        <>
          <button type="button" className="text-button" onClick={onDismissPermanently}>
            {t('performance.never')}
          </button>
          <button type="button" className="fluent-button" onClick={onClose}>
            {t('performance.later')}
          </button>
          <button type="button" className="fluent-button primary" onClick={onApply}>
            {t('performance.disableAll')}
          </button>
        </>
      )}
    >
      <div className="performance-dialog">
        <div className="performance-lead">
          <span className="performance-icon" aria-hidden="true"><Warning24Regular /></span>
          <p>{t('performance.message')}</p>
        </div>
        <ul className="performance-list">
          {EFFECTS.map((key) => <li key={key}>{t(key)}</li>)}
        </ul>
        <p className="performance-note">{t('performance.note')}</p>
      </div>
    </Modal>
  );
}
