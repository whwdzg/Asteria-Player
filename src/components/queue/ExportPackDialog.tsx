import { useEffect, useMemo, useState } from 'react';
import { ArrowDownload24Regular } from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import type { Track } from '../../lib/types';
import { ALL_SEQUENCE, useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { CoverArt } from '../common/CoverArt';
import { Dropdown } from '../common/Dropdown';
import { Modal } from '../common/Modal';

interface ExportPackDialogProps {
  open: boolean;
  initialSequenceId: string;
  onClose: () => void;
}

/** Chooses a playback sequence (or the all queue) and individual media for .astpp. */
export function ExportPackDialog({ open, initialSequenceId, onClose }: ExportPackDialogProps): React.ReactElement {
  const { t } = useI18n();
  const tracks = useLibraryStore((state) => state.tracks);
  const playlists = useLibraryStore((state) => state.playlists);
  const queue = useLibraryStore((state) => state.queue);
  const [sequenceId, setSequenceId] = useState(initialSequenceId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const sequenceTracks = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    const ids = sequenceId === ALL_SEQUENCE
      ? (queue.length ? queue : tracks.map((track) => track.id))
      : (playlists.find((playlist) => playlist.id === sequenceId)?.trackIds ?? []);
    return ids.map((id) => byId.get(id)).filter((track): track is Track => Boolean(track));
  }, [playlists, queue, sequenceId, tracks]);

  useEffect(() => {
    if (!open) return;
    setSequenceId(initialSequenceId);
    const byId = new Map(tracks.map((track) => [track.id, track]));
    const ids = initialSequenceId === ALL_SEQUENCE
      ? (queue.length ? queue : tracks.map((track) => track.id))
      : (playlists.find((playlist) => playlist.id === initialSequenceId)?.trackIds ?? []);
    setSelected(new Set(ids.filter((id) => byId.has(id))));
    setExporting(false);
  }, [initialSequenceId, open, playlists, queue, tracks]);

  const options = useMemo(() => [
    { value: ALL_SEQUENCE, label: t('queue.all') },
    ...playlists.map((playlist) => ({ value: playlist.id, label: playlist.name })),
  ], [playlists, t]);

  const selectSequence = (id: string): void => {
    setSequenceId(id);
    const byId = new Map(tracks.map((track) => [track.id, track]));
    const ids = id === ALL_SEQUENCE
      ? (queue.length ? queue : tracks.map((track) => track.id))
      : (playlists.find((playlist) => playlist.id === id)?.trackIds ?? []);
    setSelected(new Set(ids.filter((trackId) => byId.has(trackId))));
  };

  const toggle = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportPack = async (): Promise<void> => {
    const selectedTracks = sequenceTracks.filter((track) => selected.has(track.id));
    if (!selectedTracks.length || exporting) return;
    setExporting(true);
    try {
      const { createAsteriaPack, packFileName } = await import('../../lib/asteriaPack');
      const playlist = playlists.find((item) => item.id === sequenceId);
      const baseName = playlist?.name ?? t('queue.all');
      const name = `${baseName} · ${new Date().toISOString().slice(0, 10)}`;
      const bytes = await createAsteriaPack(selectedTracks, name);
      const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = packFileName(name);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
      useUiStore.getState().pushToast(t('queue.packExported'));
      onClose();
    } catch (error) {
      useUiStore.getState().pushToast(error instanceof Error ? error.message : t('queue.packExportFailed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const allSelected = sequenceTracks.length > 0 && sequenceTracks.every((track) => selected.has(track.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('queue.exportPackTitle')}
      size="md"
      closeLabel={t('common.close')}
      footer={(
        <>
          <button type="button" className="fluent-button" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="fluent-button primary"
            disabled={!selected.size || exporting}
            onClick={() => void exportPack()}
          >
            <ArrowDownload24Regular />
            {exporting ? t('queue.exporting') : t('queue.exportPack')}
          </button>
        </>
      )}
    >
      <div className="export-pack-dialog">
        <p className="settings-json-hint">{t('queue.exportPackHint')}</p>
        <label className="export-pack-sequence">
          <span>{t('queue.exportSequence')}</span>
          <Dropdown
            value={sequenceId}
            options={options}
            onChange={selectSequence}
            ariaLabel={t('queue.exportSequence')}
            menuLabel={t('queue.exportSequence')}
          />
        </label>
        <div className="export-pack-head">
          <strong>{t('queue.exportSelected', { count: selected.size })}</strong>
          <button
            type="button"
            className="text-button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(sequenceTracks.map((track) => track.id)))}
          >
            {allSelected ? t('common.clear') : t('common.selectAll')}
          </button>
        </div>
        {sequenceTracks.length ? (
          <div className="export-pack-list">
            {sequenceTracks.map((track) => (
              <label key={track.id} className={`export-pack-row ${selected.has(track.id) ? 'is-selected' : ''}`.trim()}>
                <input type="checkbox" checked={selected.has(track.id)} onChange={() => toggle(track.id)} />
                <CoverArt track={track} className="export-pack-cover" alt="" />
                <span className="export-pack-copy">
                  <strong>{track.title}</strong>
                  <span>{track.artist}{track.album ? ` · ${track.album}` : ''}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="queue-empty">{t('queue.exportNoTracks')}</p>
        )}
      </div>
    </Modal>
  );
}
