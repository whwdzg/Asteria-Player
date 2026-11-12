import { Dismiss24Regular } from '@fluentui/react-icons';
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../../lib/types';
import { useI18n } from '../../i18n/I18nProvider';
import { CoverArt } from '../common/CoverArt';
import { useOverlayRoot } from '../../hooks/useOverlayRoot';

interface ArtworkLightboxProps {
  track: Track;
  /** Optional larger rendition; falls back to track.cover. */
  source?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const CLOSE_DRAG = 120;

export function ArtworkLightbox({ track, source, onClose }: ArtworkLightboxProps): React.ReactElement {
  const { t } = useI18n();
  const root = useOverlayRoot();
  const [scale, setScale] = useState(1);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const dragStart = useRef(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    // Capture so Escape closes only the lightbox, not a surrounding details modal.
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const zoom = (next: number): void => {
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
    if (next <= MIN_SCALE) {
      offsetRef.current = 0;
      setOffsetY(0);
    }
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    zoom(scale - event.deltaY * 0.0018);
  };

  const pointerDistance = (): number => {
    const values = [...pointers.current.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      dragStart.current = event.clientY;
      setDragging(true);
    } else if (pointers.current.size === 2) {
      pinchStart.current = { distance: pointerDistance(), scale };
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinchStart.current) {
      const next = pinchStart.current.scale * (pointerDistance() / Math.max(1, pinchStart.current.distance));
      zoom(next);
      return;
    }
    const delta = event.clientY - dragStart.current;
    if (delta > 0) {
      offsetRef.current = delta;
      setOffsetY(delta);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      if (offsetRef.current > CLOSE_DRAG) onClose();
      else {
        offsetRef.current = 0;
        setOffsetY(0);
      }
      pinchStart.current = null;
    } else if (pointers.current.size < 2) {
      pinchStart.current = null;
      const remaining = [...pointers.current.values()][0];
      dragStart.current = remaining ? remaining.y - offsetY : 0;
    }
  };

  return createPortal(
    <div className="artwork-lightbox" role="dialog" aria-modal="true" aria-label={t('np.viewArtwork')}>
      <div className="lightbox-backdrop" onClick={onClose} />
      <button type="button" className="lightbox-close icon-button" aria-label={t('np.closeArtwork')} onClick={onClose}>
        <Dismiss24Regular />
      </button>
      <div
        className={`lightbox-stage ${dragging ? 'is-dragging' : ''}`}
        onWheel={onWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => zoom(scale > 1 ? 1 : 2)}
        onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        style={{ '--lightbox-scale': scale, '--lightbox-y': `${offsetY}px` } as React.CSSProperties}
      >
        <div className="lightbox-image" onClick={(event) => event.stopPropagation()}>
          <CoverArt track={{ ...track, cover: source ?? track.cover }} className="lightbox-cover" alt={t('a11y.cover', { title: track.title })} eager showKind />
        </div>
      </div>
    </div>,
    root,
  );
}
