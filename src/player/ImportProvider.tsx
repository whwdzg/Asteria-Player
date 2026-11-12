import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { importFiles as readFiles } from '../lib/importer';
import type { UrlKind } from '../lib/urlImport';
import { useLibraryStore } from '../state/library';
import { useUiStore } from '../state/ui';
import { player } from '../player/engine';
import { useI18n } from '../i18n/I18nProvider';
import { useSettingsStore } from '../state/settings';
const UrlImportDialog = lazy(() => import('../components/overlays/UrlImportDialog').then((module) => ({ default: module.UrlImportDialog })));

interface ImportContextValue {
  openFiles: () => void;
  openFolder: () => void;
  openUrl: () => void;
  importFiles: (files: File[]) => Promise<void>;
  importUrls: (urls: string[], kind: UrlKind) => Promise<boolean>;
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
  const [urlOpen, setUrlOpen] = useState(false);

  const commitTracks = useCallback((incoming: Awaited<ReturnType<typeof readFiles>>, showSkipped = true) => {
    if (!incoming.tracks.length) {
      useUiStore.getState().pushToast(t('toast.importEmpty'), 'error');
      return false;
    }
    const accepted = useLibraryStore.getState().addTracks(incoming.tracks);
    if (!accepted.length) {
      useUiStore.getState().pushToast(t('toast.importEmpty'), 'error');
      return false;
    }
    useUiStore.getState().pushToast(t('toast.imported', { count: accepted.length }));
    if (showSkipped && incoming.warnings.length) {
      useUiStore.getState().pushToast(t('toast.importSkipped', { count: incoming.warnings.length }));
    }
    player.ensureCurrent();
    if (!useLibraryStore.getState().currentId) {
      const first = accepted[0];
      if (first) player.load(first, { autoplay: false });
    }
    return true;
  }, [t]);

  const importFiles = useCallback(async (files: File[]) => {
    if (!files.length || busy) return;
    setBusy(true);
    useUiStore.getState().setImporting({ done: 0, total: files.length });
    try {
      const result = await readFiles(files, (done, total) => {
        useUiStore.getState().setImporting({ done, total });
      });
      commitTracks(result);
    } catch (error) {
      console.error(error);
      useUiStore.getState().pushToast(t('toast.error'), 'error');
    } finally {
      setBusy(false);
      useUiStore.getState().setImporting(null);
    }
  }, [busy, commitTracks, t]);

  const importUrls = useCallback(async (urls: string[], kind: UrlKind): Promise<boolean> => {
    if (!urls.length || busy) return false;
    setBusy(true);
    useUiStore.getState().setImporting({ done: 0, total: urls.length });
    try {
      const { importRemoteUrls } = await import('../lib/urlImport');
      const result = await importRemoteUrls(urls, {
        kind,
        proxy: useSettingsStore.getState().bilibiliProxy,
        onProgress: (done, total) => {
          useUiStore.getState().setImporting({ done, total });
        },
      });
      if (!result.tracks.length) {
        useUiStore.getState().pushToast(result.warnings[0] ?? t('toast.importEmpty'), 'error');
        return false;
      }
      const committed = commitTracks(result, false);
      if (committed && result.tracks.some((track) => track.source === 'bilibili')) {
        const settings = useSettingsStore.getState();
        const patch: Partial<typeof settings> = {};
        if (result.tracks.some((track) => track.danmakuText) && !settings.danmakuEnabled) patch.danmakuEnabled = true;
        if (result.tracks.some((track) => track.subtitles?.length) && settings.subtitleLang === 'off') patch.subtitleLang = 'auto';
        if (Object.keys(patch).length) useSettingsStore.getState().patch(patch);
      }
      return committed;
    } catch (error) {
      console.error(error);
      useUiStore.getState().pushToast(error instanceof Error ? error.message : t('toast.error'), 'error');
      return false;
    } finally {
      setBusy(false);
      useUiStore.getState().setImporting(null);
    }
  }, [busy, commitTracks, t]);

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
        openUrl: () => setUrlOpen(true),
        importFiles,
        importUrls,
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
      {urlOpen ? (
        <Suspense fallback={null}>
          <UrlImportDialog
            open
            busy={busy}
            onClose={() => setUrlOpen(false)}
            onImport={importUrls}
          />
        </Suspense>
      ) : null}
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
