import { ArrowReset24Regular, TopSpeed24Regular } from '@fluentui/react-icons';
import { useSettingsStore } from '../../state/settings';
import { useI18n } from '../../i18n/I18nProvider';
import { player } from '../../player/engine';
import { formatRate } from '../../lib/format';
import { IconButton } from '../common/IconButton';
import { NumberField } from '../common/NumberField';

const PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function PlaybackRatePanel(): React.ReactElement {
  const rate = useSettingsStore((state) => state.playbackRate);
  const setPlaybackRate = useSettingsStore((state) => state.setPlaybackRate);
  const { t } = useI18n();

  const apply = (value: number): void => {
    setPlaybackRate(value);
    player.setPlaybackRate(value);
  };

  return (
    <div className="panel speed-panel">
      <div className="panel-heading">
        <div>
          <h3><TopSpeed24Regular className="panel-title-icon" /> {t('speed.title')}</h3>
          <p className="panel-hint">{t('speed.hint')}</p>
        </div>
        <span className="panel-value">{formatRate(rate)}</span>
      </div>

      <div className="speed-grid" role="group" aria-label={t('speed.title')}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`speed-chip ${Math.abs(rate - preset) < 0.001 ? 'is-selected' : ''}`.trim()}
            onClick={() => apply(preset)}
            aria-pressed={Math.abs(rate - preset) < 0.001}
          >
            {formatRate(preset)}
          </button>
        ))}
      </div>

      <div className="speed-custom-row">
        <span>{t('speed.custom')}</span>
        <NumberField
          value={rate}
          min={0.25}
          max={4}
          step={0.05}
          suffix="×"
          decimals={2}
          ariaLabel={t('speed.custom')}
          onChange={apply}
        />
        <IconButton
          label={t('common.reset')}
          variant="subtle"
          size="sm"
          onClick={() => apply(1)}
        >
          <ArrowReset24Regular />
        </IconButton>
      </div>
    </div>
  );
}
