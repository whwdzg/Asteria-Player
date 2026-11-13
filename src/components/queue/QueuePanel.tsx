import {
  Add24Regular,
  ArrowImport24Regular,
  ArrowNext24Regular,
  Delete24Regular,
  Info24Regular,
  MusicNote224Regular,
  TextBulletListAdd24Regular,
} from '@fluentui/react-icons';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { PlayMode, Track } from '../../lib/types';
import { ALL_SEQUENCE, useLibraryStore } from '../../state/library';
import { usePlaybackStore } from '../../state/playback';
import { useSettingsStore } from '../../state/settings';
import { useUiStore } from '../../state/ui';
import { player } from '../../player/engine';
import { useI18n } from '../../i18n/I18nProvider';
import { useImporter } from '../../player/ImportProvider';
import { Menu, type MenuAnchor } from '../common/Menu';
import { PlayModeIcon } from '../chrome/TransportControls';
import { QueueList } from './QueueList';
import { QueueToolbar } from './QueueToolbar';

interface QueuePanelProps {
  variant: 'sidebar' | 'full';
}

const PLAY_MODES: PlayMode[] = ['all', 'one', 'none', 'shuffle'];

export function QueuePanel({ variant }: QueuePanelProps): React.ReactElement {
  const { t } = useI18n();
  const { openFiles } = useImporter();
  const tracks = useLibraryStore((state) => state.tracks);
  const queue = useLibraryStore((state) => state.queue);
  const currentId = useLibraryStore((state) => state.currentId);
  const sequenceId = useLibraryStore((state) => state.sequenceId);
  const queueSort = useLibraryStore((state) => state.queueSort);
  const sortQueue = useLibraryStore((state) => state.sortQueue);
  const playlists = useLibraryStore((state) => state.playlists);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const playMode = useSettingsStore((state) => state.playMode);
  const patchSettings = useSettingsStore((state) => state.patch);
  const setQueueView = useUiStore((state) => state.setQueueView);
  const setSequence = useLibraryStore((state) => state.setSequence);
  const setDetailsTrackId = useUiStore((state) => state.setDetailsTrackId);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);
  const openScanMedia = useUiStore((state) => state.openScanMedia);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [itemMenu, setItemMenu] = useState<{ anchor: MenuAnchor; track: Track } | null>(null);

  const allQueueTracks = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return queue.map((id) => byId.get(id)).filter((track): track is Track => Boolean(track));
  }, [tracks, queue]);

  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return allQueueTracks;
    return allQueueTracks.filter((track) =>
      `${track.title} ${track.artist} ${track.album ?? ''}`.toLowerCase().includes(normalized),
    );
  }, [allQueueTracks, deferredQuery]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const sequenceName = sequenceId === ALL_SEQUENCE
    ? t('queue.all')
    : playlists.find((playlist) => playlist.id === sequenceId)?.name ?? t('queue.all');

  useEffect(() => {
    if (!batch) setSelected(new Set());
  }, [batch]);

  useEffect(() => {
    const known = new Set(allQueueTracks.map((track) => track.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => known.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [allQueueTracks]);

  const changeSort = (sort: typeof queueSort): void => {
    sortQueue(sort);
    setSelected(new Set());
    useUiStore.getState().pushToast(t('queue.sorted', { mode: t(`queue.sortBy.${sort}`) }));
  };

  const cycleQueueMode = (): void => {
    const next = PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length];
    patchSettings({ playMode: next });
    useUiStore.getState().pushToast(t('player.modeChanged', { mode: t(`player.mode.${next}`) }));
  };

  const close = (): void => setQueueView('closed');
  const expand = (): void => setQueueView('full');
  const collapse = (): void => setQueueView('sidebar');

  const toggleSelect = useCallback((id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const playTrack = useCallback((track: Track): void => {
    player.playTrack(track.id);
    if (track.kind === 'video' && window.matchMedia('(max-width: 700px)').matches) {
      setQueueView('closed');
    }
  }, [setQueueView]);

  const openItemMenu = useCallback((track: Track, element: HTMLElement): void => {
    setItemMenu({
      anchor: { rect: element.getBoundingClientRect(), element },
      track,
    });
  }, []);

  const selectAll = (): void => {
    setSelected((current) => {
      const allSelected = filtered.every((track) => current.has(track.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((track) => track.id));
    });
  };

  const removeIds = (ids: string[]): void => {
    if (!ids.length) return;
    if (sequenceId === ALL_SEQUENCE) {
      player.removeTracks(ids);
    } else {
      useLibraryStore.getState().removeFromPlaylist(sequenceId, ids);
    }
    useUiStore.getState().pushToast(t('queue.removed'));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const addSelectedTo = (playlistId: string): void => {
    useLibraryStore.getState().addToPlaylist(playlistId, selectedIds);
    useUiStore.getState().pushToast(t('queue.addedToPlaylist'));
    setBatch(false);
    setSelected(new Set());
  };

  const itemActions = useMemo(() => {
    if (!itemMenu) return [];
    const track = itemMenu.track;
    return [
      {
        id: 'next',
        label: t('common.playNext'),
        icon: <ArrowNext24Regular />,
        onSelect: () => {
          useLibraryStore.getState().insertNext(track.id);
          useUiStore.getState().pushToast(t('toast.playNext'));
        },
      },
      {
        id: 'queue',
        label: t('common.addToQueue'),
        icon: <Add24Regular />,
        onSelect: () => {
          useLibraryStore.getState().addToQueue(track.id);
          useUiStore.getState().pushToast(t('toast.addedToQueue'));
        },
      },
      {
        id: 'sequence',
        label: t('queue.addTo'),
        icon: <TextBulletListAdd24Regular />,
        submenu: [
          ...playlists.map((playlist) => ({
            id: playlist.id,
            label: playlist.name,
            onSelect: () => {
              useLibraryStore.getState().addToPlaylist(playlist.id, [track.id]);
              useUiStore.getState().pushToast(t('toast.addedToPlaylist'));
            },
          })),
          ...(playlists.length ? [{ id: 'sep', label: '', separator: true }] : []),
          {
            id: 'new',
            label: t('queue.new'),
            icon: <Add24Regular />,
            onSelect: () => openPlaylistDialog([track.id]),
          },
        ],
      },
      { id: 'sep2', label: '', separator: true },
      {
        id: 'details',
        label: t('queue.details'),
        icon: <Info24Regular />,
        onSelect: () => setDetailsTrackId(track.id),
      },
      {
        id: 'remove',
        label: t('queue.remove'),
        icon: <Delete24Regular />,
        danger: true,
        onSelect: () => removeIds([track.id]),
      },
    ];
  }, [itemMenu, playlists, t, openPlaylistDialog, setDetailsTrackId]);

  const emptyState = (
    <div className="queue-empty">
      <span className="queue-empty-icon"><MusicNote224Regular /></span>
      <h2>{deferredQuery ? t('queue.noResults') : t('queue.empty')}</h2>
      {!deferredQuery ? <p>{t('queue.emptyHint')}</p> : null}
      {!deferredQuery ? (
        <button type="button" className="fluent-button primary" onClick={openFiles}>
          <ArrowImport24Regular /> {t('queue.import')}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {variant === 'sidebar' ? <div className="queue-scrim" onClick={close} aria-hidden="true" /> : null}
      <aside
        className={`queue-panel is-${variant}`}
        aria-label={t('queue.title')}
        aria-modal={variant === 'sidebar' ? 'true' : undefined}
        role="dialog"
      >
        <span className="queue-panel-sheen" aria-hidden="true" />
        <QueueToolbar
          variant={variant}
          count={filtered.length}
          selectedCount={selected.size}
          selectedIds={selectedIds}
          sequenceId={sequenceId}
          sequenceName={sequenceName}
          queueSort={queueSort}
          playlists={playlists}
          searchOpen={searchOpen}
          query={query}
          batch={batch}
          onSearchOpen={setSearchOpen}
          onQueryChange={setQuery}
          onBatchToggle={() => setBatch((value) => !value)}
          onSelectAll={selectAll}
          onBatchRemove={() => removeIds(selectedIds)}
          onAddSelected={addSelectedTo}
          onNewPlaylist={(trackIds) => openPlaylistDialog(trackIds)}
          onScanMedia={openScanMedia}
          onSortChange={changeSort}
          onSequenceChange={(id) => {
            setSequence(id);
            setSelected(new Set());
            setBatch(false);
          }}
          onExpand={expand}
          onCollapse={collapse}
          onClose={close}
        />
        <QueueList
          tracks={filtered}
          activeId={currentId}
          playing={isPlaying}
          batch={batch}
          selected={selected}
          onPlay={playTrack}
          onToggleSelect={toggleSelect}
          onMenu={openItemMenu}
          empty={emptyState}
        />
        <footer className="queue-mobile-footer">
          <button
            type="button"
            className="queue-mode-pill"
            onClick={cycleQueueMode}
            aria-label={t('player.cycleMode')}
          >
            <PlayModeIcon mode={playMode} />
            {t(`player.mode.${playMode}`)}
          </button>
        </footer>
      </aside>

      <Menu
        open={Boolean(itemMenu)}
        anchor={itemMenu?.anchor ?? null}
        items={itemActions}
        onClose={() => setItemMenu(null)}
        label={t('common.more')}
      />
    </>
  );
}
