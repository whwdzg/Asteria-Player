import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useClockStore } from '../../state/clock';
import { useLibraryStore } from '../../state/library';
import { player } from '../../player/engine';
import { formatTime } from '../../lib/format';
import { useI18n } from '../../i18n/I18nProvider';

export function ProgressBar(): React.ReactElement {
  const time = useClockStore((state) => state.time);
  const duration = useClockStore((state) => state.duration);
  const buffered = useClockStore((state) => state.buffered);
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const { t } = useI18n();
  const shellRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const lastPreviewSeek = useRef(0);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragTime = useRef(0);
  const lastSeek = useRef(0);

  const ratio = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
  const bufferedRatio = duration > 0 ? Math.min(1, Math.max(0, buffered / duration)) : 0;
  const displayRatio = hoverRatio ?? ratio;
  const disabled = duration <= 0;
  const isVideo = track?.kind === 'video';
  const hoverTime = hoverRatio === null ? null : hoverRatio * duration;

  useEffect(() => {
    if (!isVideo || hoverTime === null) return;
    const video = previewRef.current;
    if (!video) return;
    if (Math.abs(hoverTime - lastPreviewSeek.current) < 0.18) return;
    lastPreviewSeek.current = hoverTime;
    const seek = (): void => {
      try {
        video.currentTime = Math.min(hoverTime, Math.max(0, (video.duration || duration) - 0.05));
      } catch {
        // Metadata may not be ready yet; the poster stays visible.
      }
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener('loadedmetadata', seek, { once: true });
    return () => video.removeEventListener('loadedmetadata', seek);
  }, [duration, hoverTime, isVideo]);

  const ratioFromEvent = (event: PointerEvent<HTMLDivElement>): number => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled || event.button !== 0) return;
    const next = ratioFromEvent(event);
    shellRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
    setHoverRatio(next);
    dragTime.current = next * duration;
    lastSeek.current = performance.now();
    player.seek(dragTime.current);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    const next = ratioFromEvent(event);
    setHoverRatio(next);
    if (!dragging) return;
    dragTime.current = next * duration;
    const now = performance.now();
    if (now - lastSeek.current > 55) {
      lastSeek.current = now;
      player.seek(dragTime.current);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    shellRef.current?.releasePointerCapture(event.pointerId);
    setDragging(false);
    const next = ratioFromEvent(event);
    player.seek(next * duration);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    let next = time;
    if (event.key === 'ArrowLeft') next -= event.shiftKey ? 30 : 5;
    else if (event.key === 'ArrowRight') next += event.shiftKey ? 30 : 5;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = duration;
    else if (event.key === 'PageUp') next += 30;
    else if (event.key === 'PageDown') next -= 30;
    else return;
    event.preventDefault();
    player.seek(Math.min(duration, Math.max(0, next)));
  };

  return (
    <div className="progress-row">
      <span className="progress-time is-current" aria-hidden="true">{formatTime(time)}</span>
      <div
        ref={shellRef}
        className={`progress-shell ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`.trim()}
        role="slider"
        aria-label={t('a11y.progress')}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatTime(time)} / ${formatTime(duration)}`}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { if (!dragging) setHoverRatio(null); }}
        onKeyDown={handleKeyDown}
      >
        <div className="progress-rail" aria-hidden="true">
          <div className="progress-buffered" style={{ transform: `scaleX(${bufferedRatio})` }} />
          <div className="progress-played" style={{ transform: `scaleX(${displayRatio})` }} />
        </div>
        <div className="progress-thumb" style={{ left: `${displayRatio * 100}%` }} aria-hidden="true">
          <span />
        </div>
        {hoverTime !== null && !disabled ? (
          <div
            className={`progress-tooltip ${dragging ? 'is-dragging' : ''} ${isVideo ? 'has-preview' : ''}`.trim()}
            style={{ left: `clamp(87px, ${displayRatio * 100}%, calc(100% - 87px))` }}
            aria-hidden="true"
          >
            {isVideo && track ? (
              <video
                key={track.id}
                ref={previewRef}
                className="progress-preview-video"
                src={track.src}
                poster={track.cover}
                muted
                playsInline
                preload="metadata"
              />
            ) : null}
            <span className="progress-tooltip-time">{formatTime(hoverTime)}</span>
          </div>
        ) : null}
      </div>
      <span className="progress-time is-total" aria-hidden="true">{formatTime(duration)}</span>
    </div>
  );
}
