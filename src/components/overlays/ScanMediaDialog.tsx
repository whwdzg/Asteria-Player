import { ArrowSync24Regular, Delete24Regular } from '@fluentui/react-icons';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { findUnreadableTracks, type InvalidMedia } from '../../lib/mediaIntegrity';
import { player } from '../../player/engine';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { CoverArt } from '../common/CoverArt';
import { Modal } from '../common/Modal';

/** Scans every library item for metadata errors and offers keep/delete. */
export function ScanMediaDialog(): React.ReactElement | null {
  const { t } = useI18n();
  const open = useUiStore((state) => state.scanMediaOpen);
  const close = useUiStore((state) => state.closeScanMedia);
  const pushToast = useUiStore((state) => state.pushToast);
  const tracks = useLibraryStore((state) => state.tracks);
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [invalid, setInvalid] = useState<InvalidMedia[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const scan = async (): Promise<void> => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setScanning(true);
    setDone(false);
    setInvalid([]);
    setProgress({ done: 0, total: tracks.length });
    try {
      const result = await findUnreadableTracks(tracks, {
        signal: next.signal,
        timeout: 6000,
        concurrency: 3,
        onProgress: (value, total) => setProgress({ done: value, total }),
      });
      if (next.signal.aborted) return;
      setInvalid(result);
      setDone(true);
    } finally {
      if (!next.signal.aborted) setScanning(false);
    }
  };

  useEffect(() => {
    if (!open) {
      controller.current?.abort();
      return;
    }
    void scan();
    return () => controller.current?.abort();
    // The scan starts once per open, using the library snapshot at that time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const removeInvalid = (): void => {
    setConfirmDelete(false);
    if (!invalid.length) return;
    player.removeTracks(invalid.map((item) => item.track.id));
    pushToast(t('scan.deleted', { count: invalid.length }));
    close();
  };

  return (
    <>
      <Modal
        open
        onClose={close}
        title={t('scan.title')}
        closeLabel={t('common.close')}
        size="lg"
        footer={
          <>
            <button type="button" className="fluent-button" onClick={close}>{t('scan.keep')}</button>
            <button type="button" className="fluent-button danger" disabled={!invalid.length || scanning} onClick={() => setConfirmDelete(true)}>
              <Delete24Regular /> {t('scan.delete')}
            </button>
          </>
        }
      >
        <div className="scan-media">
          <p className="scan-media-hint">{t('scan.hint')}</p>
          <div className="scan-media-status">
            <span>{scanning ? t('scan.scanning') : done ? t('scan.complete', { count: invalid.length }) : t('scan.ready')}</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <div className="scan-media-bar" aria-hidden="true">
            <i style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          {done && !invalid.length ? <p className="scan-media-empty">{t('scan.none')}</p> : null}
          {invalid.length ? (
            <div className="scan-media-list">
              {invalid.map(({ track, reason }) => (
                <div className="scan-media-row" key={track.id}>
                  <CoverArt track={track} className="scan-media-cover" alt={track.title} />
                  <div className="scan-media-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist || t('common.unknownArtist')} · {reason === 'timeout' ? t('scan.reasonTimeout') : t('scan.reasonError')}</span>
                  </div>
                  <span className="scan-media-source">{track.source === 'local' ? t('details.local') : track.source === 'url' ? t('details.url') : track.source === 'bilibili' ? t('details.bilibili') : t('details.demo')}</span>
                </div>
              ))}
            </div>
          ) : null}
          {done ? (
            <button type="button" className="fluent-button scan-media-again" onClick={() => void scan()}>
              <ArrowSync24Regular /> {t('scan.again')}
            </button>
          ) : null}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title={t('scan.deleteTitle')}
        message={t('scan.deleteConfirm', { count: invalid.length })}
        confirmLabel={t('scan.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={removeInvalid}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
