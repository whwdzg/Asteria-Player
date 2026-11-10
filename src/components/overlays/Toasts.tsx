import { CheckmarkCircle24Filled, Dismiss24Regular, ErrorCircle24Filled } from '@fluentui/react-icons';
import { useUiStore } from '../../state/ui';
import { useI18n } from '../../i18n/I18nProvider';

export function Toasts(): React.ReactElement {
  const toasts = useUiStore((state) => state.toasts);
  const importing = useUiStore((state) => state.importing);
  const dismiss = useUiStore((state) => state.dismissToast);
  const { t } = useI18n();

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {importing ? (
        <div className="import-progress">
          <span className="import-spinner" aria-hidden="true" />
          <span>{t('toast.importing', { count: importing.total })}</span>
          <span className="import-count">{importing.done}/{importing.total}</span>
        </div>
      ) : null}
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'is-error' : ''}`.trim()} role="status">
          {toast.tone === 'error' ? <ErrorCircle24Filled /> : <CheckmarkCircle24Filled />}
          <span>{toast.message}</span>
          <button type="button" aria-label={t('common.close')} onClick={() => dismiss(toast.id)}>
            <Dismiss24Regular />
          </button>
        </div>
      ))}
    </div>
  );
}
