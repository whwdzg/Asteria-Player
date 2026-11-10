import {
  Add24Regular,
  ArrowImport24Regular,
  ChevronDown24Regular,
  Dismiss24Regular,
  FolderOpen24Regular,
  FullScreenMaximize24Regular,
  PanelRightContract24Regular,
  Search24Regular,
  SelectAllOn24Regular,
  TextBulletListAdd24Regular,
  Delete24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { useEffect, useRef, useState } from 'react';
import type { Playlist } from '../../lib/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useImporter } from '../../player/ImportProvider';
import { IconButton } from '../common/IconButton';
import { Menu, type MenuAnchor } from '../common/Menu';

interface QueueToolbarProps {
  variant: 'sidebar' | 'full';
  count: number;
  selectedCount: number;
  selectedIds: string[];
  sequenceId: string;
  sequenceName: string;
  playlists: Playlist[];
  searchOpen: boolean;
  query: string;
  batch: boolean;
  onSearchOpen: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onBatchToggle: () => void;
  onSelectAll: () => void;
  onBatchRemove: () => void;
  onAddSelected: (playlistId: string) => void;
  onNewPlaylist: (trackIds: string[]) => void;
  onSequenceChange: (id: string) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onClose: () => void;
}

export function QueueToolbar({
  variant,
  count,
  selectedCount,
  selectedIds,
  sequenceId,
  sequenceName,
  playlists,
  searchOpen,
  query,
  batch,
  onSearchOpen,
  onQueryChange,
  onBatchToggle,
  onSelectAll,
  onBatchRemove,
  onAddSelected,
  onNewPlaylist,
  onSequenceChange,
  onExpand,
  onCollapse,
  onClose,
}: QueueToolbarProps): React.ReactElement {
  const { t } = useI18n();
  const { openFiles, openFolder } = useImporter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [sequenceAnchor, setSequenceAnchor] = useState<MenuAnchor | null>(null);
  const [importAnchor, setImportAnchor] = useState<MenuAnchor | null>(null);
  const [addAnchor, setAddAnchor] = useState<MenuAnchor | null>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const sequenceItems = [
    {
      id: 'all',
      label: t('queue.all'),
      checked: sequenceId === 'all',
      onSelect: () => onSequenceChange('all'),
    },
    ...playlists.map((playlist) => ({
      id: playlist.id,
      label: playlist.name,
      checked: sequenceId === playlist.id,
      onSelect: () => onSequenceChange(playlist.id),
    })),
    { id: 'sep', label: '', separator: true },
    {
      id: 'new',
      label: t('queue.new'),
      icon: <Add24Regular />,
      onSelect: () => onNewPlaylist([]),
    },
  ];

  const addItems = [
    ...playlists.map((playlist) => ({
      id: playlist.id,
      label: playlist.name,
      onSelect: () => onAddSelected(playlist.id),
    })),
    ...(playlists.length ? [{ id: 'sep', label: '', separator: true }] : []),
    {
      id: 'new',
      label: t('queue.new'),
      icon: <Add24Regular />,
      onSelect: () => {
        onNewPlaylist(selectedIds);
      },
    },
  ];

  return (
    <div className={`queue-toolbar ${batch ? 'is-batch' : ''}`.trim()}>
      {batch ? (
        <>
          <div className="queue-batch-left">
            <span className="queue-batch-count">{t('queue.selected', { count: selectedCount })}</span>
            <button type="button" className="text-button" onClick={onSelectAll}>
              <SelectAllOn24Regular /> {t('common.selectAll')}
            </button>
          </div>
          <div className="queue-toolbar-actions">
            <IconButton
              label={t('queue.addTo')}
              tooltip={t('queue.addTo')}
              disabled={!selectedCount}
              onClick={(event) => setAddAnchor({ rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}
            >
              <TextBulletListAdd24Regular />
            </IconButton>
            <IconButton
              label={t('queue.remove')}
              tooltip={t('queue.remove')}
              disabled={!selectedCount}
              onClick={onBatchRemove}
            >
              <Delete24Regular />
            </IconButton>
            <button type="button" className="text-button" onClick={onBatchToggle}>
              <Checkmark24Regular /> {t('common.done')}
            </button>
          </div>
          <Menu
            open={Boolean(addAnchor)}
            anchor={addAnchor}
            items={addItems}
            onClose={() => setAddAnchor(null)}
            label={t('queue.addTo')}
          />
        </>
      ) : (
        <>
          <div className="queue-heading-block">
            <span className="queue-eyebrow">{t('queue.title')}</span>
            <div className="queue-heading-row">
              <span className="queue-count">{t('queue.count', { count })}</span>
              <button
                type="button"
                className="sequence-button"
                onClick={(event) => setSequenceAnchor({ rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}
                aria-haspopup="menu"
              >
                <span>{sequenceName}</span>
                <ChevronDown24Regular />
              </button>
            </div>
          </div>

          <div className="queue-toolbar-actions">
            {searchOpen ? null : (
              <IconButton label={t('common.search')} tooltip={t('common.search')} onClick={() => onSearchOpen(true)}>
                <Search24Regular />
              </IconButton>
            )}
            <IconButton
              label={t('common.import')}
              tooltip={t('common.import')}
              onClick={(event) => setImportAnchor({ rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}
            >
              <ArrowImport24Regular />
            </IconButton>
            <IconButton
              label={t('queue.batch')}
              tooltip={t('queue.batch')}
              onClick={onBatchToggle}
              disabled={!count}
            >
              <SelectAllOn24Regular />
            </IconButton>
            {variant === 'sidebar' ? (
              <IconButton label={t('common.expand')} tooltip={t('common.expand')} onClick={onExpand}>
                <FullScreenMaximize24Regular />
              </IconButton>
            ) : (
              <IconButton label={t('common.collapse')} tooltip={t('common.collapse')} onClick={onCollapse}>
                <PanelRightContract24Regular />
              </IconButton>
            )}
            <IconButton label={t('common.close')} tooltip={t('common.close')} onClick={onClose}>
              <Dismiss24Regular />
            </IconButton>
          </div>

          <Menu
            open={Boolean(sequenceAnchor)}
            anchor={sequenceAnchor}
            items={sequenceItems}
            onClose={() => setSequenceAnchor(null)}
            label={t('queue.sequence')}
          />
          <Menu
            open={Boolean(importAnchor)}
            anchor={importAnchor}
            items={[
              { id: 'files', label: t('menu.importFiles'), icon: <ArrowImport24Regular />, onSelect: openFiles },
              { id: 'folder', label: t('menu.importFolder'), icon: <FolderOpen24Regular />, onSelect: openFolder },
              { id: 'hint', label: t('menu.importHint'), heading: true },
            ]}
            onClose={() => setImportAnchor(null)}
            label={t('common.import')}
          />
        </>
      )}

      {searchOpen && !batch ? (
        <div className="queue-search-row">
          <Search24Regular aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={t('queue.searchPlaceholder')}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onQueryChange('');
                onSearchOpen(false);
              }
            }}
            aria-label={t('common.search')}
          />
          <IconButton
            label={t('common.close')}
            variant="subtle"
            size="sm"
            onClick={() => { onQueryChange(''); onSearchOpen(false); }}
          >
            <Dismiss24Regular />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}
