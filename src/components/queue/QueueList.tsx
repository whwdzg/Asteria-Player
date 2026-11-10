import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Track } from '../../lib/types';
import { QueueItem } from './QueueItem';

interface QueueListProps {
  tracks: Track[];
  activeId: string | null;
  playing: boolean;
  batch: boolean;
  selected: Set<string>;
  onPlay: (track: Track) => void;
  onToggleSelect: (id: string) => void;
  onMenu: (track: Track, element: HTMLElement) => void;
  empty: React.ReactNode;
}

export function QueueList({
  tracks,
  activeId,
  playing,
  batch,
  selected,
  onPlay,
  onToggleSelect,
  onMenu,
  empty,
}: QueueListProps): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 8,
    getItemKey: (index) => tracks[index]?.id ?? index,
  });

  if (!tracks.length) {
    return <div className="queue-empty-wrap">{empty}</div>;
  }

  return (
    <div className="queue-scroll" ref={parentRef}>
      <div className="queue-virtual" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((item) => {
          const track = tracks[item.index];
          return (
            <div
              key={track.id}
              className="queue-row-slot"
              style={{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }}
            >
              <QueueItem
                track={track}
                active={track.id === activeId}
                playing={playing}
                batch={batch}
                selected={selected.has(track.id)}
                onPlay={onPlay}
                onToggleSelect={onToggleSelect}
                onMenu={onMenu}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
