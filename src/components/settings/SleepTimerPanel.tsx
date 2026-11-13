import { Timer24Regular, TimerOff24Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { formatTime } from '../../lib/format';
import { useSleepTimerStore } from '../../state/sleepTimer';
import { NumberField } from '../common/NumberField';
import { Switch } from '../common/Switch';

const PRESETS = [5, 10, 15, 30, 60, 90] as const;

/** Sleep timer: a fixed-duration countdown or pause at the end of this track. */
export function SleepTimerPanel(): React.ReactElement {
  const { t } = useI18n();
  const enabled = useSleepTimerStore((state) => state.enabled);
  const minutes = useSleepTimerStore((state) => state.minutes);
  const mode = useSleepTimerStore((state) => state.mode);
  const endsAt = useSleepTimerStore((state) => state.endsAt);
  const setEnabled = useSleepTimerStore((state) => state.setEnabled);
  const setMinutes = useSleepTimerStore((state) => state.setMinutes);
  const setMode = useSleepTimerStore((state) => state.setMode);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!enabled || mode !== 'duration' || !endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled, endsAt, mode]);

  const remaining = enabled && mode === 'duration' && endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  return (
    <div className="panel sleep-panel">
      <div className="panel-heading">
        <div>
          <h3>{t('sleep.title')}</h3>
          <p className="panel-hint">{t('sleep.hint')}</p>
        </div>
        <span className={`sleep-state ${enabled ? 'is-on' : ''}`.trim()}>
          {enabled ? <Timer24Regular /> : <TimerOff24Regular />}
          {enabled ? t('sleep.active') : t('sleep.off')}
        </span>
      </div>

      <div className="sleep-presets" role="group" aria-label={t('sleep.minutes')}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`sleep-chip ${minutes === preset ? 'is-selected' : ''}`.trim()}
            onClick={() => {
              setMinutes(preset);
              if (!enabled) setEnabled(true);
            }}
          >
            {preset} {t('sleep.minuteShort')}
          </button>
        ))}
      </div>

      <div className="sleep-custom">
        <span>{t('sleep.custom')}</span>
        <NumberField
          value={minutes}
          min={1}
          max={720}
          step={1}
          suffix={t('sleep.minuteShort')}
          ariaLabel={t('sleep.minutes')}
          onChange={(value) => setMinutes(value)}
        />
      </div>

      <div className="sleep-row">
        <div>
          <strong>{t('sleep.enable')}</strong>
          <small>{remaining ? t('sleep.remaining', { time: formatTime(remaining) }) : t('sleep.enableHint')}</small>
        </div>
        <Switch checked={enabled} onChange={setEnabled} label={t('sleep.enable')} />
      </div>
      <div className="sleep-row">
        <div>
          <strong>{t('sleep.afterTrack')}</strong>
          <small>{t('sleep.afterTrackHint')}</small>
        </div>
        <Switch
          checked={mode === 'trackEnd'}
          onChange={(checked) => setMode(checked ? 'trackEnd' : 'duration')}
          label={t('sleep.afterTrack')}
        />
      </div>
    </div>
  );
}
