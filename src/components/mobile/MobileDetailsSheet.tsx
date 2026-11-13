import {
  ArrowLeft24Regular,
  FullScreenMaximize24Regular,
  Info24Regular,
  Play24Filled,
} from '@fluentui/react-icons';
import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDuration } from '../../lib/format';
import { parseArtists, tracksForArtist } from '../../lib/artists';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { CoverArt } from '../common/CoverArt';
import { AlbumLink, ArtistLinks } from '../common/CollectionLinks';
import { ScrollText } from '../common/ScrollText';
import { useSwipeBackGesture } from '../../hooks/useSwipeBackGesture';
import { BlurredBackdrop } from '../common/BlurredBackdrop';

interface MobileDetailsSheetProps {
  onClose: () => void;
  onSwipeBack: () => void;
  onImmersive: () => void;
}

/** Mobile-only detail sheet: playback actions, technical info and credits. */
export function MobileDetailsSheet({ onClose, onSwipeBack, onImmersive }: MobileDetailsSheetProps): React.ReactElement | null {
  const { t } = useI18n();
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const tracks = useLibraryStore((state) => state.tracks);
  const openCollection = useUiStore((state) => state.openCollection);
  const setDetailsTrackId = useUiStore((state) => state.setDetailsTrackId);
  const swipe = useSwipeBackGesture({ direction: 'left', onClose: onSwipeBack });


  const contributors = useMemo(() => {
    if (!track) return [];
    return parseArtists(track.artist).map((name) => {
      const items = tracksForArtist(tracks, name);
      return { name, count: items.length, cover: items.find((item) => item.cover)?.cover };
    });
  }, [track, tracks]);

  if (!track) return null;

  const openMediaInfo = (): void => {
    onClose();
    setDetailsTrackId(track.id);
  };

  const openCollectionPage = (kind: 'artist' | 'album', name: string): void => {
    onClose();
    openCollection(kind, name);
  };

  return (
    <section
      className={`mobile-sheet mobile-details ${swipe.dragging ? 'is-dragging' : ''}`.trim()}
      aria-label={t('mobile.details')}
      style={swipe.dragX !== 0 ? {
        transform: `translateX(${swipe.dragX}px)`,
        opacity: Math.max(0.82, 1 - Math.abs(swipe.dragX) / window.innerWidth * 0.18),
      } : undefined}
      {...swipe.handlers}
    >
      <BlurredBackdrop cover={track.cover} />
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
          <button type="button" className="mobile-action-card" onClick={openMediaInfo}>
            <span className="mobile-action-icon"><Info24Regular /></span>
            {t('mobile.mediaInfo')}
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

    </section>
  );
}
