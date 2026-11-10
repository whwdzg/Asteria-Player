import { Play24Filled, TextBulletListAdd24Regular } from '@fluentui/react-icons';
import { formatDuration, formatFileSize, formatBitrate, formatSampleRate } from '../../lib/format';
import { useLibraryStore } from '../../state/library';
import { useUiStore } from '../../state/ui';
import { player } from '../../player/engine';
import { useI18n } from '../../i18n/I18nProvider';
import { CoverArt } from '../common/CoverArt';
import { Modal } from '../common/Modal';

export function DetailsDialog(): React.ReactElement | null {
  const trackId = useUiStore((state) => state.detailsTrackId);
  const setTrackId = useUiStore((state) => state.setDetailsTrackId);
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === trackId));
  const { t } = useI18n();

  if (!trackId || !track) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: t('details.file'), value: track.fileName ?? track.title },
    { label: t('details.source'), value: track.source === 'demo' ? t('details.demo') : t('details.local') },
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
      title={t('details.title')}
      closeLabel={t('details.close')}
      size="md"
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
        <CoverArt track={track} className="details-cover" alt={t('a11y.cover', { title: track.title })} eager showKind />
        <div className="details-heading">
          <span className="soft-badge">{track.kind === 'video' ? t('np.video') : t('np.eyebrow')}</span>
          <h3>{track.title}</h3>
          <p>{track.artist || t('common.unknownArtist')}</p>
          <p className="details-album">{track.album || t('common.unknownAlbum')}</p>
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
    </Modal>
  );
}
