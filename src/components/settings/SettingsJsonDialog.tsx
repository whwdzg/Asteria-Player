import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownload24Regular,
  ArrowImport24Regular,
  ArrowReset24Regular,
  Copy24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import {
  defaultSettingsDocument,
  parseSettingsJson,
  serializeSettings,
  settingsDocument,
} from '../../lib/settingsJson';
import { useSettingsStore } from '../../state/settings';
import { checkJsonSyntax, tokenizeJson } from '../../lib/jsonEditor';
import { useUiStore } from '../../state/ui';
import { Modal } from '../common/Modal';

interface SettingsJsonDialogProps {
  onClose: () => void;
}

/**
 * A deliberately small JSON workbench: the current settings are rendered as
 * the documented `{version, settings}` document, can be edited in place, and
 * can be imported from or downloaded to a `.json` file.
 */
export function SettingsJsonDialog({ onClose }: SettingsJsonDialogProps): React.ReactElement {
  const settings = useSettingsStore();
  const replaceSettings = useSettingsStore((state) => state.replaceSettings);
  const pushToast = useUiStore((state) => state.pushToast);
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => serializeSettings(settings));
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const syntax = useMemo(() => checkJsonSyntax(draft), [draft]);
  const tokens = useMemo(() => tokenizeJson(draft), [draft]);
  const currentDocument = useMemo(() => settingsDocument(settings), [settings]);
  const version = currentDocument.version;

  useEffect(() => {
    setDraft(serializeSettings(settings));
    // Re-seed only when the dialog is mounted; the store is read once here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (): void => {
    try {
      const parsed = parseSettingsJson(draft);
      replaceSettings(parsed.settings);
      setError('');
      setStatus(t('settings.settingsJsonApplied'));
      pushToast(t('settings.settingsJsonApplied'));
      onClose();
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const download = (): void => {
    const blob = new Blob([draft], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'asteria-settings.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(draft);
      setStatus(t('settings.settingsJsonCopied'));
    } catch {
      setError('Clipboard is not available in this browser.');
    }
  };

  const reset = (): void => {
    setDraft(JSON.stringify(defaultSettingsDocument(), null, 2));
    setError('');
    setStatus(t('settings.settingsJsonReset'));
  };

  const readFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      setDraft(text);
      setError('');
      setStatus(t('settings.settingsJsonImported'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('settings.settingsJson')}
      closeLabel={t('common.close')}
      size="lg"
      footer={
        <>
          <button type="button" className="fluent-button" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="fluent-button primary" onClick={apply} disabled={Boolean(syntax)}>
            {t('settings.settingsJsonApply')}
          </button>
        </>
      }
    >
      <div className="settings-json-dialog">
        <div className="settings-json-toolbar">
          <p className="settings-json-hint">{t('settings.settingsJsonHint')}</p>
          <span className="settings-json-version">{t('settings.settingsJsonVersion', { version })}</span>
        </div>

        <div className={`settings-json-shell ${syntax ? 'is-invalid' : ''}`.trim()}>
          <pre ref={highlightRef} className="settings-json-highlight" aria-hidden="true">
            {tokens.map((token, index) => (
              <span key={index} className={`json-token json-token-${token.type}`}>{token.text}</span>
            ))}
          </pre>
          <textarea
            ref={editorRef}
            className="settings-json-editor"
            value={draft}
            wrap="off"
            onChange={(event) => {
              setDraft(event.target.value);
              setError('');
              setStatus('');
            }}
            onScroll={() => {
              if (!highlightRef.current || !editorRef.current) return;
              highlightRef.current.scrollTop = editorRef.current.scrollTop;
              highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
            }}
            aria-label={t('settings.settingsJson')}
            aria-invalid={Boolean(syntax)}
            spellCheck={false}
          />
        </div>
        <p className={`settings-json-check ${syntax ? 'is-invalid' : 'is-valid'}`.trim()} role="status" aria-live="polite">
          <span className="settings-json-check-dot" aria-hidden="true" />
          {syntax
            ? `${t('settings.settingsJsonSyntaxError', { line: syntax.line, column: syntax.column })}: ${syntax.message}`
            : t('settings.settingsJsonValid')}
        </p>

        <div className="settings-json-actions">
          <button type="button" className="fluent-button" onClick={() => fileRef.current?.click()}>
            <ArrowImport24Regular /> {t('settings.settingsJsonImport')}
          </button>
          <button type="button" className="fluent-button" onClick={download}>
            <ArrowDownload24Regular /> {t('settings.settingsJsonDownload')}
          </button>
          <button type="button" className="fluent-button" onClick={() => void copy()}>
            <Copy24Regular /> {t('settings.settingsJsonCopy')}
          </button>
          <button type="button" className="fluent-button" onClick={reset}>
            <ArrowReset24Regular /> {t('settings.settingsJsonDefault')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label={t('settings.settingsJsonFile')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              event.target.value = '';
            }}
          />
        </div>

        {error ? <p className="settings-json-error" role="alert">{t('settings.settingsJsonInvalid')}: {error}</p> : null}
        {status ? <p className="settings-json-status" role="status">{status}</p> : null}
      </div>
    </Modal>
  );
}
