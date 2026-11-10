import { ArrowReset24Regular, WeatherSunny24Regular } from '@fluentui/react-icons';
import { useSettingsStore } from '../../state/settings';
import { useI18n } from '../../i18n/I18nProvider';
import { RangeSlider } from '../common/RangeSlider';
import { IconButton } from '../common/IconButton';

export function BrightnessPanel(): React.ReactElement {
  const brightness = useSettingsStore((state) => state.brightness);
  const setBrightness = useSettingsStore((state) => state.setBrightness);
  const { t } = useI18n();

  return (
    <div className="panel brightness-panel">
      <div className="panel-heading">
        <div>
          <h3>{t('brightness.title')}</h3>
          <p className="panel-hint">{t('brightness.hint')}</p>
        </div>
        <span className="panel-value">{Math.round(brightness * 100)}%</span>
      </div>
      <div className="brightness-row">
        <span className="brightness-sun" aria-hidden="true"><WeatherSunny24Regular /></span>
        <RangeSlider
          value={brightness}
          min={0}
          max={1}
          step={0.01}
          onChange={setBrightness}
          ariaLabel={t('a11y.brightness')}
          ariaValueText={`${Math.round(brightness * 100)}%`}
        />
        <IconButton
          label={t('common.reset')}
          variant="subtle"
          size="sm"
          onClick={() => setBrightness(1)}
        >
          <ArrowReset24Regular />
        </IconButton>
      </div>
      <div className="brightness-scale" aria-hidden="true">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  );
}
