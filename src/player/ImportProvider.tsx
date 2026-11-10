import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { importFiles as readFiles } from '../lib/importer';
import { useLibraryStore } from '../state/library';
import { useUiStore } from '../state/ui';
import { player } from '../player/engine';
import { useI18n } from '../i18n/I18nProvider';

interface ImportContextValue {
  openFiles: () => void;
  openFolder: () => void;
  importFiles: (files: File[]) => Promise<void>;
  busy: boolean;
}

const ImportContext = createContext<ImportContextValue | null>(null);
const ACCEPT = [
  'audio/*',
  'video/*',
  '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.webm',
  '.mp4', '.m4v', '.mkv', '.mov',
  '.lrc', '.spl', '.srt', '.vtt', '.ass', '.ssa', '.xml', '.json',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif',
].join(',');

export function ImportProvider({ children }: { children: ReactNode }): ReactNode {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const importFiles = useCallback(async (files: File[]) => {
    if (!files.length || busy) return;
    setBusy(true);
    useUiStore.getState().setImporting({ done: 0, total: files.length });
    try {
      const result = await readFiles(files, (done, total) => {
        useUiStore.getState().setImporting({ done, total });
      });
      if (!result.tracks.length) {
        useUiStore.getState().pushToast(t('toast.importEmpty'), 'error');
      } else {
        const accepted = useLibraryStore.getState().addTracks(result.tracks);
        if (!accepted.length) {
          useUiStore.getState().pushToast(t('toast.importEmpty'), 'error');
        } else {
          useUiStore.getState().pushToast(t('toast.imported', { count: accepted.length }));
          if (result.warnings.length) {
            useUiStore.getState().pushToast(t('toast.importSkipped', { count: result.warnings.length }));
          }
          player.ensureCurrent();
          if (!useLibraryStore.getState().currentId) {
            const first = accepted[0];
            if (first) player.load(first, { autoplay: false });
          }
        }
      }
    } catch (error) {
      console.error(error);
      useUiStore.getState().pushToast(t('toast.error'), 'error');
    } finally {
      setBusy(false);
      useUiStore.getState().setImporting(null);
    }
  }, [busy, t]);

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    void importFiles(files);
  };

  return (
    <ImportContext.Provider
      value={{
        openFiles: () => fileInput.current?.click(),
        openFolder: () => folderInput.current?.click(),
        importFiles,
        busy,
      }}
    >
      {children}
      <input
        ref={fileInput}
        type="file"
        className="visually-hidden"
        tabIndex={-1}
        multiple
        accept={ACCEPT}
        onChange={handleInput}
        aria-hidden="true"
      />
      <input
        ref={folderInput}
        type="file"
        className="visually-hidden"
        tabIndex={-1}
        multiple
        accept={ACCEPT}
        onChange={handleInput}
        aria-hidden="true"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />
    </ImportContext.Provider>
  );
}

export function useImporter(): ImportContextValue {
  const value = useContext(ImportContext);
  if (!value) throw new Error('useImporter must be used inside ImportProvider');
  return value;
}
