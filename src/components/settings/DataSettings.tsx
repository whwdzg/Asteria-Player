import { Code24Regular, MusicNote224Regular, TextBulletListLtr24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { clearApplicationCaches } from '../../lib/cache';
import { clearPwaLibrary } from '../../lib/pwaLibrary';
import { player } from '../../player/engine';
import { useLibraryStore } from '../../state/library';
import { useSettingsStore } from '../../state/settings';
import { useUiStore } from '../../state/ui';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SettingsJsonDialog } from './SettingsJsonDialog';

type ClearAction = 'cache' | 'playlists' | 'media' | null;

/**
 * Entry point for JSON settings plus destructive storage controls. Each clear
 * operation asks for confirmation because it cannot be undone.
 */
export function DataSettings(): React.ReactElement {
  const { t } = useI18n();
  const pushToast = useUiStore((state) => state.pushToast);
  const tracks = useLibraryStore((state) => state.tracks);
  const playlists = useLibraryStore((state) => state.playlists);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<ClearAction>(null);

  const runClear = async (): Promise<void> => {
    const action = confirm;
    setConfirm(null);
    if (!action) return;
    if (action === 'cache') {
      await clearApplicationCaches();
      pushToast(t('settings.cacheCleared'));
      return;
    }
    if (action === 'playlists') {
      useLibraryStore.getState().clearPlaylists();
      pushToast(t('settings.playlistsCleared'));
      return;
    }
    player.removeTracks(tracks.map((track) => track.id));
    useSettingsStore.getState().setLastTrack('');
    useSettingsStore.getState().setLastPosition(0);
    await clearPwaLibrary();
    pushToast(t('settings.mediaCleared'));
  };

  const confirmTitle = confirm === 'cache'
    ? t('settings.clearCache')
    : confirm === 'playlists'
      ? t('settings.clearPlaylists')
      : t('settings.clearMedia');
  const confirmMessage = confirm === 'cache'
    ? t('settings.clearCacheConfirm')
    : confirm === 'playlists'
      ? t('settings.clearPlaylistsConfirm')
      : t('settings.clearMediaConfirm');

  return (
    <section className="settings-section" aria-labelledby="settings-data">
      <h3 id="settings-data" className="section-title">
        <Code24Regular /> {t('settings.data')}
      </h3>
      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.editJson')}</span>
          <small>{t('settings.dataHint')}</small>
        </div>
        <button type="button" className="fluent-button" onClick={() => setOpen(true)}>
          {t('settings.dataOpen')}
        </button>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.clearCache')}</span>
          <small>{t('settings.clearCacheHint')}</small>
        </div>
        <button type="button" className="fluent-button" onClick={() => setConfirm('cache')}>
          {t('settings.clear')}
        </button>
      </div>
      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.clearPlaylists')}</span>
          <small>{t('settings.clearPlaylistsHint', { count: playlists.length })}</small>
        </div>
        <button type="button" className="fluent-button" disabled={!playlists.length} onClick={() => setConfirm('playlists')}>
          <TextBulletListLtr24Regular /> {t('settings.clear')}
        </button>
      </div>
      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.clearMedia')}</span>
          <small>{t('settings.clearMediaHint', { count: tracks.length })}</small>
        </div>
        <button type="button" className="fluent-button danger" disabled={!tracks.length} onClick={() => setConfirm('media')}>
          <MusicNote224Regular /> {t('settings.clear')}
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={t('settings.clear')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={() => void runClear()}
        onClose={() => setConfirm(null)}
      />

      {open ? <SettingsJsonDialog onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
