import { MusicNote224Regular } from '@fluentui/react-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useClockStore } from '../../state/clock';
import { formatTime } from '../../lib/format';
import { CoverArt } from '../common/CoverArt';
import { LyricsView } from './LyricsView';

function qualityOf(track: { sampleRate?: number; bitDepth?: number; format?: string }): 'hires' | 'lossless' | null {
  const lossless = /flac|wav|aiff|alac/i.test(track.format ?? '');
  if ((track.sampleRate ?? 0) >= 48000 && (track.bitDepth ?? 0) >= 24) return 'hires';
  if (lossless) return 'lossless';
  return null;
}

export function ArtworkPanel(): React.ReactElement | null {
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const duration = useClockStore((state) => state.duration);
  const { t } = useI18n();
  if (!track) return null;
  const quality = qualityOf(track);
  const tech = [
    { label: t('np.sampleRate'), value: track.sampleRate ? `${(track.sampleRate / 1000).toFixed(track.sampleRate % 1000 === 0 ? 0 : 1)} kHz` : '—' },
    { label: t('np.bitDepth'), value: track.bitDepth ? `${track.bitDepth}-bit` : '—' },
    { label: t('np.bitrate'), value: track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '—' },
    { label: t('np.format'), value: track.format ?? '—' },
  ];

  return (
    <div className="np-art-column">
      <div className="np-artwork-shell">
        <div className="np-glow" aria-hidden="true" />
        <CoverArt
          track={track}
          className="np-cover"
          alt={t('a11y.cover', { title: track.title })}
          eager
          showKind
        />
        <div className="np-cover-sheen" aria-hidden="true" />
        {quality ? (
          <span className={`quality-pill ${quality}`.trim()}>
            {quality === 'hires' ? t('np.hires') : t('np.lossless')}
          </span>
        ) : null}
      </div>

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

      <div className="np-tech" aria-label={t('np.technical')}>
        {tech.map((item) => (
          <div className="np-tech-item" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="np-source-note">
        <MusicNote224Regular />
        <span>{track.source === 'demo' ? t('details.demo') : t('details.local')}</span>
        <span className="np-source-sep" aria-hidden="true">·</span>
        <span>{track.fileName ?? track.format ?? t('np.video')}</span>
      </div>
    </div>
  );
}

export function NowPlaying(): React.ReactElement {
  return (
    <section className="now-playing" aria-label="Now playing">
      <ArtworkPanel />
      <LyricsView />
    </section>
  );
}
