import { Code24Regular, MusicNote224Regular, TextBulletListLtr24Regular } from '@fluentui/react-icons';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { clearApplicationCaches } from '../../lib/cache';
import { clearPwaLibrary } from '../../lib/pwaLibrary';
import { formatStorageBytes, measureStorageUsage, type StorageUsage } from '../../lib/storageUsage';
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
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const refreshUsage = useCallback(async (): Promise<void> => {
    setUsageLoading(true);
    try {
      setUsage(await measureStorageUsage(useLibraryStore.getState().tracks));
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const runClear = async (): Promise<void> => {
    const action = confirm;
    setConfirm(null);
    if (!action) return;
    if (action === 'cache') {
      await clearApplicationCaches();
      pushToast(t('settings.cacheCleared'));
      void refreshUsage();
      return;
    }
    if (action === 'playlists') {
      useLibraryStore.getState().clearPlaylists();
      pushToast(t('settings.playlistsCleared'));
      void refreshUsage();
      return;
    }
    player.removeTracks(tracks.map((track) => track.id));
    useSettingsStore.getState().setLastTrack('');
    useSettingsStore.getState().setLastPosition(0);
    await clearPwaLibrary();
    pushToast(t('settings.mediaCleared'));
    void refreshUsage();
  };

  const storagePercent = usage?.quota ? Math.min(100, (usage.total / usage.quota) * 100) : 0;

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
      <div className="storage-usage-card" aria-live="polite">
        <div className="storage-usage-head">
          <div>
            <span className="storage-usage-eyebrow">{t('settings.storageUsage')}</span>
            <strong>{usage ? formatStorageBytes(usage.total) : t('settings.storageMeasuring')}</strong>
          </div>
          <button type="button" className="fluent-button" onClick={() => void refreshUsage()} disabled={usageLoading}>
            {t('settings.storageRefresh')}
          </button>
        </div>
        {usage ? (
          <>
            <div className="storage-usage-bar" aria-hidden="true">
              <i style={{ width: storagePercent + '%' }} />
            </div>
            <div className="storage-usage-meta">
              <span>{usage.quota ? t('settings.storageQuota', { used: formatStorageBytes(usage.total), quota: formatStorageBytes(usage.quota) }) : t('settings.storageUsed', { used: formatStorageBytes(usage.total) })}</span>
              <span>{usage.persisted ? t('settings.storagePersisted') : t('settings.storageBestEffort')}</span>
            </div>
            <div className="storage-usage-rows">
              {[
                { key: 'media', label: t('settings.storageMedia'), value: usage.media },
                { key: 'covers', label: t('settings.storageCovers'), value: usage.covers },
                { key: 'sidecars', label: t('settings.storageSidecars'), value: usage.sidecars },
                { key: 'pwa', label: t('settings.storagePwa'), value: usage.pwa },
                { key: 'cache', label: t('settings.storageCache'), value: usage.cache },
                { key: 'settings', label: t('settings.storageSettings'), value: usage.settings },
                { key: 'other', label: t('settings.storageOther'), value: usage.other },
              ].map((row) => (
                <div className="storage-usage-row" key={row.key}>
                  <span>{row.label}</span>
                  <strong>{formatStorageBytes(row.value)}</strong>
                </div>
              ))}
            </div>
          </>
        ) : <p className="storage-usage-loading">{t('settings.storageMeasuring')}</p>}
      </div>

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
