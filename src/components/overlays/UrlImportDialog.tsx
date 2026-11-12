import { Link24Regular, ArrowImport24Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useSettingsStore } from '../../state/settings';
import type { UrlKind } from '../../lib/urlImport';
import { Dropdown } from '../common/Dropdown';
import { Modal } from '../common/Modal';

interface UrlImportDialogProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onImport: (urls: string[], kind: UrlKind) => Promise<boolean>;
}

export function UrlImportDialog({ open, busy, onClose, onImport }: UrlImportDialogProps): React.ReactElement {
  const { t } = useI18n();
  const proxy = useSettingsStore((state) => state.bilibiliProxy);
  const patch = useSettingsStore((state) => state.patch);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<UrlKind>('auto');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
  }, [open]);

  const submit = async (): Promise<void> => {
    const urls = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!urls.length) {
      setError(t('urlImport.noUrls'));
      return;
    }
    setError('');
    const ok = await onImport(urls, kind);
    if (ok) {
      setText('');
      onClose();
    }
  };

  const hasBilibili = /(?:bilibili\.com|b23\.tv|\bBV[0-9A-Za-z]{10}\b|\bav\d+\b)/i.test(text);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('urlImport.title')}
      closeLabel={t('common.close')}
      size="md"
      footer={
        <>
          <button type="button" className="fluent-button" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fluent-button primary"
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
          >
            <ArrowImport24Regular /> {busy ? t('urlImport.importing') : t('urlImport.import')}
          </button>
        </>
      }
    >
      <div className="url-import-form">
        <div className="url-import-intro">
          <Link24Regular />
          <div>
            <strong>{t('urlImport.heading')}</strong>
            <p>{t('urlImport.hint')}</p>
          </div>
        </div>

        <label className="url-import-label" htmlFor="url-import-text">{t('urlImport.urlsLabel')}</label>
        <textarea
          id="url-import-text"
          className="url-import-textarea"
          value={text}
          rows={5}
          spellCheck={false}
          placeholder={t('urlImport.placeholder')}
          onChange={(event) => setText(event.currentTarget.value)}
          disabled={busy}
        />

        <div className="url-import-row">
          <div className="url-import-field">
            <span className="url-import-label">{t('urlImport.kind')}</span>
            <Dropdown
              value={kind}
              onChange={(value) => setKind(value as UrlKind)}
              options={[
                { value: 'auto', label: t('urlImport.auto') },
                { value: 'audio', label: t('urlImport.audio') },
                { value: 'video', label: t('urlImport.video') },
              ]}
              ariaLabel={t('urlImport.kind')}
              menuLabel={t('urlImport.kind')}
            />
          </div>
        </div>

        {hasBilibili ? (
          <div className="url-import-proxy">
            <label className="url-import-label" htmlFor="url-import-proxy">{t('urlImport.proxy')}</label>
            <input
              id="url-import-proxy"
              value={proxy}
              onChange={(event) => patch({ bilibiliProxy: event.currentTarget.value })}
              placeholder="https://your-proxy.example/?url={url}"
              spellCheck={false}
              disabled={busy}
            />
            <small>{t('urlImport.proxyHint')}</small>
          </div>
        ) : null}

        <p className="url-import-note">{t('urlImport.bilibiliNote')}</p>
        {error ? <p className="url-import-error" role="alert">{error}</p> : null}
      </div>
    </Modal>
  );
}
