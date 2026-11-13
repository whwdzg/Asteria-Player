import { memo } from 'react';
import { Checkmark24Regular, MoreHorizontal24Regular } from '@fluentui/react-icons';
import type { Track } from '../../lib/types';
import { formatDuration } from '../../lib/format';
import { CoverArt } from '../common/CoverArt';
import { ScrollText } from '../common/ScrollText';
import { IconButton } from '../common/IconButton';
import { useI18n } from '../../i18n/I18nProvider';

interface QueueItemProps {
  track: Track;
  active: boolean;
  playing: boolean;
  batch: boolean;
  selected: boolean;
  onPlay: (track: Track) => void;
  onToggleSelect: (id: string) => void;
  onMenu: (track: Track, element: HTMLElement) => void;
}

export const QueueItem = memo(function QueueItem({
  track,
  active,
  playing,
  batch,
  selected,
  onPlay,
  onToggleSelect,
  onMenu,
}: QueueItemProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className={`queue-row ${active ? 'is-current' : ''} ${selected ? 'is-selected' : ''}`.trim()}>
      {batch ? (
        <button
          type="button"
          className={`queue-check ${selected ? 'is-checked' : ''}`.trim()}
          role="checkbox"
          aria-checked={selected}
          aria-label={`${t('queue.select')}: ${track.title}`}
          onClick={() => onToggleSelect(track.id)}
        >
          {selected ? <Checkmark24Regular aria-hidden="true" /> : null}
        </button>
      ) : null}
      <button type="button" className="queue-row-main" onClick={() => (batch ? onToggleSelect(track.id) : onPlay(track))}>
        <span className="queue-cover-wrap">
          <CoverArt track={track} className="queue-cover" alt={t('a11y.cover', { title: track.title })} showKind />
          {active && playing ? (
            <span className="queue-eq" aria-hidden="true"><i /><i /><i /></span>
          ) : null}
        </span>
        <span className="queue-copy">
          <span className="queue-title"><ScrollText text={track.title} /></span>
          <span className="queue-artist">
            {track.subtitle || track.artist || t('common.unknownArtist')}
            {track.album ? <><span className="dot" aria-hidden="true">·</span>{track.album}</> : null}
          </span>
        </span>
      </button>
      <span className="queue-duration">{track.duration ? formatDuration(track.duration) : '--:--'}</span>
      {!batch ? (
        <IconButton
          label={t('a11y.openDetails', { title: track.title })}
          variant="subtle"
          size="sm"
          className="queue-more"
          onClick={(event) => onMenu(track, event.currentTarget)}
        >
          <MoreHorizontal24Regular />
        </IconButton>
      ) : null}
    </div>
  );
});
