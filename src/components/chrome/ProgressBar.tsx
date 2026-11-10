import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useClockStore } from '../../state/clock';
import { player } from '../../player/engine';
import { formatTime } from '../../lib/format';
import { useI18n } from '../../i18n/I18nProvider';

export function ProgressBar(): React.ReactElement {
  const time = useClockStore((state) => state.time);
  const duration = useClockStore((state) => state.duration);
  const buffered = useClockStore((state) => state.buffered);
  const { t } = useI18n();
  const shellRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragTime = useRef(0);
  const lastSeek = useRef(0);

  const ratio = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
  const bufferedRatio = duration > 0 ? Math.min(1, Math.max(0, buffered / duration)) : 0;
  const displayRatio = hoverRatio ?? ratio;
  const disabled = duration <= 0;

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

  const hoverTime = hoverRatio === null ? null : hoverRatio * duration;

  return (
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
          className={`progress-tooltip ${dragging ? 'is-dragging' : ''}`.trim()}
          style={{ left: `${displayRatio * 100}%` }}
          aria-hidden="true"
        >
          {formatTime(hoverTime)}
        </div>
      ) : null}
    </div>
  );
}
