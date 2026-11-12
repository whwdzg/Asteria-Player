import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../state/settings';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Semi-transparent clock for fullscreen video. It is intentionally a separate
 * component so the 1s tick does not re-render the whole video surface.
 */
export function FullscreenClock(): React.ReactElement | null {
  const enabled = useSettingsStore((state) => state.fullscreenClock);
  const showHours = useSettingsStore((state) => state.fullscreenClockHours);
  const showSeconds = useSettingsStore((state) => state.fullscreenClockSeconds);
  const showDate = useSettingsStore((state) => state.fullscreenClockDate);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  if (!enabled) return null;
  const time = showHours
    ? `${pad(now.getHours())}:${pad(now.getMinutes())}`
    : `${pad(now.getMinutes())}`;
  const withSeconds = showSeconds ? `${time}:${pad(now.getSeconds())}` : time;
  const date = showDate
    ? `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`
    : '';

  return (
    <div className="fullscreen-clock" aria-hidden="true">
      {date ? <span className="fullscreen-clock-date">{date}</span> : null}
      <span className="fullscreen-clock-time">{withSeconds}</span>
    </div>
  );
}
