import {
  ChevronDown24Regular,
  Info24Regular,
  MusicNote224Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useClockStore } from '../../state/clock';
import { useUiStore } from '../../state/ui';
import { formatTime } from '../../lib/format';
import { CoverArt } from '../common/CoverArt';
import { highResolutionCover } from '../../lib/cover';
import { ArtworkLightbox } from './ArtworkLightbox';
import { LyricsView } from './LyricsView';
import { AudioVisualizer } from './AudioVisualizer';

export function ArtworkPanel(): React.ReactElement | null {
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const duration = useClockStore((state) => state.duration);
  const setDetailsTrackId = useUiStore((state) => state.setDetailsTrackId);
  const { t } = useI18n();
  const [techOpen, setTechOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  if (!track) return null;

  const tech = [
    { label: t('np.sampleRate'), value: track.sampleRate ? `${(track.sampleRate / 1000).toFixed(track.sampleRate % 1000 === 0 ? 0 : 1)} kHz` : '—' },
    { label: t('np.bitDepth'), value: track.bitDepth ? `${track.bitDepth}-bit` : '—' },
    { label: t('np.bitrate'), value: track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '—' },
    { label: t('np.format'), value: track.format ?? '—' },
  ];

  return (
    <div className="np-art-column">
      <button
        type="button"
        className="np-artwork-shell"
        onClick={() => setLightboxOpen(true)}
        aria-label={t('np.viewArtwork')}
      >
        <div className="np-glow" aria-hidden="true" />
        <CoverArt
          track={track}
          className="np-cover"
          alt={t('a11y.cover', { title: track.title })}
          eager
          showKind
        />
        <div className="np-cover-sheen" aria-hidden="true" />
      </button>

      <div className="np-track-copy">
        <div className="np-kicker">
          <span>{t('np.eyebrow')}</span>
          <span className="kicker-line" aria-hidden="true" />
          <span>{formatTime(duration || track.duration)}</span>
        </div>
        <h1 className="np-title">{track.title}</h1>
        <p className="np-artist">
          {track.artist || t('common.unknownArtist')}
          {track.album ? <><span className="np-dot" aria-hidden="true">·</span>{track.album}</> : null}
        </p>
      </div>

      <div className={`np-tech-wrap ${techOpen ? 'is-open' : ''}`.trim()}>
        {techOpen ? (
          <div className="np-tech" aria-label={t('np.technical')}>
            {tech.map((item) => (
              <div className="np-tech-item" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
        <div className="np-actions">
          <button
            type="button"
            className={`np-tech-toggle ${techOpen ? 'is-open' : ''}`.trim()}
            onClick={() => setTechOpen((value) => !value)}
            aria-expanded={techOpen}
          >
            <MusicNote224Regular />
            {t('np.techToggle')}
            <ChevronDown24Regular className="np-tech-chevron" />
          </button>
          <button
            type="button"
            className="np-tech-toggle"
            onClick={() => setDetailsTrackId(track.id)}
          >
            <Info24Regular />
            {t('np.trackInfo')}
          </button>
        </div>
      </div>

      <div className="np-source-note">
        <MusicNote224Regular />
        <span>{track.source === 'demo' ? t('details.demo') : t('details.local')}</span>
        <span className="np-source-sep" aria-hidden="true">·</span>
        <span>{track.fileName ?? track.format ?? t('np.video')}</span>
      </div>

      {lightboxOpen ? <ArtworkLightbox track={track} source={highResolutionCover(track.cover)} onClose={() => setLightboxOpen(false)} /> : null}
    </div>
  );
}

export function NowPlaying(): React.ReactElement {
  return (
    <section className="now-playing" aria-label="Now playing">
      <AudioVisualizer />
      <ArtworkPanel />
      <LyricsView />
    </section>
  );
}
