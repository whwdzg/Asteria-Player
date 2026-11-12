import { useState } from 'react';
import { useLibraryStore } from '../../state/library';
import { usePlaybackStore } from '../../state/playback';
import { CoverArt } from '../common/CoverArt';
import { useI18n } from '../../i18n/I18nProvider';
import { ArtworkLightbox } from '../nowplaying/ArtworkLightbox';
import { highResolutionCover } from '../../lib/cover';
import { AlbumLink, ArtistLinks } from '../common/CollectionLinks';

export function TrackIdentity(): React.ReactElement {
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const { t } = useI18n();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!track) {
    return (
      <div className="track-identity is-empty">
        <div className="track-cover-empty" aria-hidden="true">A</div>
        <div className="track-copy">
          <div className="track-title">{t('app.name')}</div>
          <div className="track-subtitle">{t('app.tagline')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`track-identity ${isPlaying ? 'is-playing' : ''}`.trim()}>
      <button
        type="button"
        className="track-cover-wrap"
        aria-label={t('np.viewArtwork')}
        onClick={() => setLightboxOpen(true)}
      >
        <CoverArt
          track={track}
          className="track-cover"
          alt={t('a11y.cover', { title: track.title })}
          eager
          showKind
        />
        <span className="track-playing-indicator" aria-hidden="true">
          <i /><i /><i />
        </span>
      </button>
      <div className="track-copy">
        <div className="track-title" title={track.title}>{track.title}</div>
        <div className="track-subtitle">
          {track.kind === 'audio'
            ? <ArtistLinks artist={track.artist} />
            : <span>{track.subtitle || track.artist || t('common.unknownArtist')}</span>}
          {track.album
            ? <><span className="dot" aria-hidden="true">·</span><AlbumLink album={track.album} /></>
            : null}
        </div>
      </div>
      {lightboxOpen ? (
        <ArtworkLightbox
          track={track}
          source={highResolutionCover(track.cover)}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
}
