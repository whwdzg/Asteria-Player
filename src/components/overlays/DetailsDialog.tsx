/**
 * Media/video properties. Audio exposes LDDC-style online matching; video
 * exposes Bilibili danmaku/subtitle matching.
 */
import { Play24Filled, TextBulletListAdd24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { formatDuration, formatFileSize, formatBitrate, formatSampleRate } from '../../lib/format';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { player } from '../../player/engine';
import { useI18n } from '../../i18n/I18nProvider';
import { CoverArt } from '../common/CoverArt';
import { Modal } from '../common/Modal';
import { BilibiliMatchPanel } from './BilibiliMatchPanel';
import { SongMatchPanel } from './SongMatchPanel';
import { ArtworkLightbox } from '../nowplaying/ArtworkLightbox';
import { highResolutionCover } from '../../lib/cover';
import { AlbumLink, ArtistLinks } from '../common/CollectionLinks';
import { ScrollText } from '../common/ScrollText';

export function DetailsDialog(): React.ReactElement | null {
  const trackId = useUiStore((state) => state.detailsTrackId);
  const setTrackId = useUiStore((state) => state.setDetailsTrackId);
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === trackId));
  const { t } = useI18n();
  const [artworkOpen, setArtworkOpen] = useState(false);

  if (!trackId || !track) return null;

  const hasLyrics = Boolean(track.lyrics || track.embeddedLyrics || track.lyricsUrl);
  const lyricText = track.lyrics ?? track.embeddedLyrics ?? '';
  const wordSync = Boolean(/<\d|\[[0-9]+:[0-9]+[^\]]*\]\s*[^\n]+<[^>]+>/.test(lyricText)) || track.lyricsFormat === 'spl';
  const lyricFormat = track.lyrics
    ? (track.lyricsFormat === 'spl' ? 'SPL' : 'LRC')
    : track.embeddedLyrics
      ? t('details.embedded')
      : track.lyricsUrl
        ? (track.lyricsFormat === 'spl' ? 'SPL' : 'LRC')
        : t('details.none');
  const lyricEncoding = hasLyrics ? (track.lyricsEncoding ?? 'UTF-8') : '—';
  const subtitleCount = track.subtitles?.length ?? 0;
  const hasDanmaku = Boolean(track.danmakuText || track.danmakuUrl);

  const rows: Array<{ label: string; value: string }> = [
    ...(track.kind === 'audio'
      ? [
          { label: t('details.hasLyrics'), value: hasLyrics ? t('details.yes') : t('details.no') },
          { label: t('details.lyricSync'), value: wordSync ? t('details.yes') : t('details.no') },
          { label: t('details.lyricFormat'), value: lyricFormat },
          { label: t('details.lyricEncoding'), value: lyricEncoding },
        ]
      : [
          { label: t('details.hasSubtitles'), value: subtitleCount ? t('details.yes') : t('details.no') },
          { label: t('details.subtitleCount'), value: String(subtitleCount) },
          { label: t('details.hasDanmaku'), value: hasDanmaku ? t('details.yes') : t('details.no') },
        ]),
    { label: t('details.file'), value: track.fileName ?? track.title },
    { label: t('details.source'), value: track.source === 'demo'
      ? t('details.demo')
      : track.source === 'bilibili'
        ? t('details.bilibili')
        : track.source === 'url'
          ? t('details.url')
          : t('details.local') },
    { label: t('np.format'), value: track.format ?? '—' },
    { label: t('np.sampleRate'), value: formatSampleRate(track.sampleRate) ?? '—' },
    { label: t('np.bitDepth'), value: track.bitDepth ? `${track.bitDepth}-bit` : '—' },
    { label: t('np.bitrate'), value: formatBitrate(track.bitrate) ?? '—' },
    { label: t('details.duration'), value: formatDuration(track.duration) },
    { label: t('details.size'), value: formatFileSize(track.fileSize) ?? '—' },
    { label: t('details.added'), value: track.addedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(track.addedAt) : '—' },
  ];

  const addToQueue = (): void => {
    useLibraryStore.getState().addToQueue(track.id);
    useUiStore.getState().pushToast(t('toast.addedToQueue'));
  };

  return (
    <Modal
      open
      onClose={() => setTrackId(null)}
      title={track.kind === 'video' ? t('details.videoTitle') : t('details.title')}
      closeLabel={t('details.close')}
      size="lg"
      footer={
        <>
          <button type="button" className="fluent-button" onClick={addToQueue}>
            <TextBulletListAdd24Regular /> {t('common.addToQueue')}
          </button>
          <button
            type="button"
            className="fluent-button primary"
            onClick={() => { player.playTrack(track.id); setTrackId(null); }}
          >
            <Play24Filled /> {t('player.play')}
          </button>
        </>
      }
    >
      <div className="details-hero">
        <button
          type="button"
          className="details-cover-button"
          aria-label={t('np.viewArtwork')}
          onClick={() => setArtworkOpen(true)}
        >
          <CoverArt track={track} className="details-cover" alt={t('a11y.cover', { title: track.title })} eager showKind />
        </button>
        <div className="details-heading">
          <span className="soft-badge">{track.kind === 'video' ? t('np.video') : t('np.music')}</span>
          <h3><ScrollText text={track.title} /></h3>
          <p>{track.kind === 'audio'
            ? <ArtistLinks artist={track.artist} />
            : (track.subtitle || track.artist || t('common.unknownArtist'))}</p>
          <p className="details-album"><AlbumLink album={track.album} /></p>
        </div>
      </div>
      <dl className="details-grid">
        {rows.map((row) => (
          <div key={row.label} className="details-cell">
            <dt>{row.label}</dt>
            <dd title={row.value}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {/* Video properties host Bilibili matching; audio properties host the LDDC-style song matcher. */}
      {track.kind === 'video' ? <BilibiliMatchPanel key={track.id} track={track} /> : <SongMatchPanel key={track.id} track={track} />}
      {artworkOpen ? (
        <ArtworkLightbox
          track={track}
          source={highResolutionCover(track.cover)}
          onClose={() => setArtworkOpen(false)}
        />
      ) : null}
    </Modal>
  );
}
