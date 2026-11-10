import { useLibraryStore } from '../../state/library';
import { usePlaybackStore } from '../../state/playback';
import { CoverArt } from '../common/CoverArt';
import { useI18n } from '../../i18n/I18nProvider';

export function TrackIdentity(): React.ReactElement {
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const { t } = useI18n();

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
      <div className="track-cover-wrap">
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
      </div>
      <div className="track-copy">
        <div className="track-title" title={track.title}>{track.title}</div>
        <div className="track-subtitle">
          <span>{track.artist || t('common.unknownArtist')}</span>
          {track.album ? <><span className="dot" aria-hidden="true">·</span><span>{track.album}</span></> : null}
        </div>
      </div>
    </div>
  );
}
