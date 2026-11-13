import {
  ArrowLeft24Regular,
  Cast24Regular,
  FullScreenMaximize24Regular,
  MusicNote224Regular,
  Play24Filled,
} from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDuration } from '../../lib/format';
import { parseArtists, tracksForArtist } from '../../lib/artists';
import { useLibraryStore } from '../../state/library';
import { useSettingsStore } from '../../state/settings';
import { useUiStore } from '../../state/ui';
import { CoverArt } from '../common/CoverArt';
import { AlbumLink, ArtistLinks } from '../common/CollectionLinks';
import { Modal } from '../common/Modal';
import { ScrollText } from '../common/ScrollText';

interface MobileDetailsSheetProps {
  onClose: () => void;
  onImmersive: () => void;
}

/** Mobile-only detail sheet: playback actions, technical info and credits. */
export function MobileDetailsSheet({ onClose, onImmersive }: MobileDetailsSheetProps): React.ReactElement | null {
  const { t } = useI18n();
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const tracks = useLibraryStore((state) => state.tracks);
  const openCollection = useUiStore((state) => state.openCollection);
  const pushToast = useUiStore((state) => state.pushToast);
  const eqEnabled = useSettingsStore((state) => state.eqEnabled);
  const eqGains = useSettingsStore((state) => state.eqGains);
  const patch = useSettingsStore((state) => state.patch);
  const [castOpen, setCastOpen] = useState(false);

  const contributors = useMemo(() => {
    if (!track) return [];
    return parseArtists(track.artist).map((name) => {
      const items = tracksForArtist(tracks, name);
      return { name, count: items.length, cover: items.find((item) => item.cover)?.cover };
    });
  }, [track, tracks]);

  if (!track) return null;

  const clearActive = eqEnabled && eqGains.some((gain) => gain !== 0);
  const toggleClear = (): void => {
    if (clearActive) {
      patch({ eqEnabled: false, eqGains: [0, 0, 0, 0, 0] });
      pushToast(t('mobile.clearSoundOff'));
    } else {
      patch({ eqEnabled: true, eqGains: [3, 1, 0, 2, 3] });
      pushToast(t('mobile.clearSoundOn'));
    }
  };

  const openCollectionPage = (kind: 'artist' | 'album', name: string): void => {
    onClose();
    openCollection(kind, name);
  };

  const copyStream = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(track.src);
      pushToast(t('mobile.dlnaCopied'));
    } catch {
      pushToast(t('toast.error'), 'error');
    }
  };

  return (
    <section className="mobile-sheet mobile-details" aria-label={t('mobile.details')}>
      <header className="mobile-sheet-head">
        <button type="button" className="icon-button subtle" onClick={onClose} aria-label={t('common.back')}>
          <ArrowLeft24Regular />
        </button>
        <strong>{t('mobile.details')}</strong>
        <span aria-hidden="true" />
      </header>
      <div className="mobile-sheet-track">
        <h2><ScrollText text={track.title} /></h2>
        <p><ArtistLinks artist={track.artist} /></p>
      </div>

      <div className="mobile-sheet-scroll">
        <div className="mobile-details-actions">
          <button type="button" className="mobile-action-card is-active" onClick={onClose}>
            <span className="mobile-action-icon"><Play24Filled /></span>
            {t('mobile.nowPlaying')}
          </button>
          <button type="button" className="mobile-action-card" onClick={onImmersive}>
            <span className="mobile-action-icon"><FullScreenMaximize24Regular /></span>
            {t('mobile.immersive')}
          </button>
          <button type="button" className={`mobile-action-card ${clearActive ? 'is-active' : ''}`.trim()} onClick={toggleClear}>
            <span className="mobile-action-icon"><MusicNote224Regular /></span>
            {t('mobile.clearSound')}
          </button>
          <button type="button" className="mobile-action-card" onClick={() => setCastOpen(true)}>
            <span className="mobile-action-icon"><Cast24Regular /></span>
            DLNA (beta)
          </button>
        </div>

        <div className="mobile-info-card">
          <span className="mobile-card-eyebrow">{t('mobile.audioInfo')}</span>
          <div className="mobile-audio-line">
            <span>{track.format ?? t('np.video')}</span>
            <span>{track.bitDepth ? `${track.bitDepth}-bit` : '—'}</span>
            <span>{track.sampleRate ? `${track.sampleRate} Hz` : '—'}</span>
            <span>{track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '—'}</span>
          </div>
          <span className="mobile-audio-duration">{formatDuration(track.duration)}</span>
        </div>

        {track.album ? (
          <button type="button" className="mobile-info-card mobile-album-card" onClick={() => openCollectionPage('album', track.album!)}>
            <span className="mobile-card-eyebrow">{t('mobile.fromAlbum')}</span>
            <span className="mobile-album-main">
              <span className="mobile-album-cover">
                <CoverArt track={track} className="mobile-details-cover" alt={track.album} />
              </span>
              <span className="mobile-album-copy">
                <strong>{track.album}</strong>
                <span><ArtistLinks artist={track.artist} /></span>
              </span>
            </span>
          </button>
        ) : null}

        {contributors.length ? (
          <div className="mobile-info-card">
            <span className="mobile-card-eyebrow">{t('mobile.contributors')}</span>
            <div className="mobile-contributors">
              {contributors.map((contributor) => (
                <button
                  type="button"
                  className="mobile-contributor"
                  key={contributor.name}
                  onClick={() => openCollectionPage('artist', contributor.name)}
                >
                  <span className="mobile-contributor-avatar">
                    {contributor.cover
                      ? <CoverArt track={{ ...track, cover: contributor.cover }} className="mobile-contributor-cover" alt={contributor.name} />
                      : contributor.name.slice(0, 1)}
                  </span>
                  <span className="mobile-contributor-copy">
                    <strong>{contributor.name}</strong>
                    <span>{t('collection.songCount', { count: contributor.count })}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mobile-details-links">
          <AlbumLink album={track.album ?? ''} />
        </div>
      </div>

      <Modal
        open={castOpen}
        onClose={() => setCastOpen(false)}
        title="DLNA (beta)"
        closeLabel={t('common.close')}
        size="sm"
        footer={<button type="button" className="fluent-button primary" onClick={() => setCastOpen(false)}>{t('common.close')}</button>}
      >
        <div className="dlna-help">
          <p>{t('mobile.dlnaHint')}</p>
          <button type="button" className="fluent-button" onClick={() => void copyStream()}>
            {t('mobile.dlnaCopy')}
          </button>
        </div>
      </Modal>
    </section>
  );
}
