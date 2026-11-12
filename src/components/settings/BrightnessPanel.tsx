import { ArrowReset24Regular, WeatherSunny24Regular } from '@fluentui/react-icons';
import { useSettingsStore } from '../../state/settings';
import { useI18n } from '../../i18n/I18nProvider';
import { IconButton } from '../common/IconButton';
import { NumberField } from '../common/NumberField';
import { RangeSlider } from '../common/RangeSlider';
import { Switch } from '../common/Switch';
import { Dropdown } from '../common/Dropdown';

export function BrightnessPanel(): React.ReactElement {
  const brightness = useSettingsStore((state) => state.brightness);
  const setBrightness = useSettingsStore((state) => state.setBrightness);
  const mirror = useSettingsStore((state) => state.mirrorVideo);
  const colorVision = useSettingsStore((state) => state.colorVisionAssist);
  const fit = useSettingsStore((state) => state.videoFit);
  const patch = useSettingsStore((state) => state.patch);
  const { t } = useI18n();

  return (
    <div className="panel brightness-panel">
      <div className="panel-heading">
        <div>
          <h3>{t('video.options')}</h3>
          <p className="panel-hint">{t('brightness.hint')}</p>
        </div>
        <NumberField
          value={Math.round(brightness * 100)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          ariaLabel={t('video.options')}
          onChange={(value) => setBrightness(value / 100)}
        />
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

      <div className="video-options-list">
        <div className="video-option-row">
          <div><strong>{t('video.mirror')}</strong><small>{t('video.mirrorHint')}</small></div>
          <Switch checked={mirror} onChange={(value) => patch({ mirrorVideo: value })} label={t('video.mirror')} />
        </div>
        <div className="video-option-row">
          <div><strong>{t('video.colorVision')}</strong><small>{t('video.colorVisionHint')}</small></div>
          <Switch checked={colorVision} onChange={(value) => patch({ colorVisionAssist: value })} label={t('video.colorVision')} />
        </div>
        <div className="video-option-row is-select">
          <div><strong>{t('video.fit')}</strong><small>{t('video.fitHint')}</small></div>
          <Dropdown
            value={fit}
            onChange={(value) => patch({ videoFit: value as 'contain' | 'cover' | 'fill' })}
            options={[
              { value: 'contain', label: t('video.fitContain') },
              { value: 'cover', label: t('video.fitCover') },
              { value: 'fill', label: t('video.fitFill') },
            ]}
            ariaLabel={t('video.fit')}
            menuLabel={t('video.fit')}
          />
        </div>
      </div>
    </div>
  );
}
