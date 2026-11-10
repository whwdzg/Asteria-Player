import { useState, type CSSProperties } from 'react';
import { MusicNote224Regular, Video24Regular } from '@fluentui/react-icons';
import type { Track } from '../../lib/types';
import { coverFallback } from '../../lib/cover';

interface CoverArtProps {
  track: Pick<Track, 'id' | 'title' | 'accent' | 'cover' | 'kind'>;
  className?: string;
  alt?: string;
  eager?: boolean;
  showKind?: boolean;
}

export function CoverArt({ track, className = '', alt = '', eager = false, showKind = false }: CoverArtProps): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const fallback = coverFallback(track);
  const showImage = track.cover && !failed;
  const initial = Array.from(track.title.trim())[0] ?? 'A';
  const style = { '--cover-accent': fallback.accent, background: fallback.background } as CSSProperties;

  return (
    <div className={`cover-art ${className}`.trim()} style={style}>
      {showImage ? (
        <img
          src={track.cover}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-fallback" aria-hidden="true">
          <span className="cover-initial">{initial}</span>
          {track.kind === 'video' ? <Video24Regular /> : <MusicNote224Regular />}
        </div>
      )}
      {showKind && track.kind === 'video' ? (
        <span className="cover-kind" aria-hidden="true"><Video24Regular /></span>
      ) : null}
    </div>
  );
}
