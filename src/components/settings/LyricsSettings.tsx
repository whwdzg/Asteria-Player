import { TextFont24Regular } from '@fluentui/react-icons';
import type { Settings } from '../../lib/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useSettingsStore } from '../../state/settings';
import { Dropdown } from '../common/Dropdown';
import { NumberField } from '../common/NumberField';
import { RangeSlider } from '../common/RangeSlider';
import { Switch } from '../common/Switch';
import { fontOptions } from './fontOptions';

export function LyricsSettings(): React.ReactElement {
  const settings = useSettingsStore();
  const patch = useSettingsStore((state) => state.patch);
  const { t } = useI18n();

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    patch({ [key]: value } as Partial<Settings>);
  };

  return (
    <section className="settings-section" aria-labelledby="settings-lyrics">
      <h3 id="settings-lyrics" className="section-title">
        <TextFont24Regular /> {t('settings.lyrics')}
      </h3>

      <div className="setting-row is-stacked">
        <div className="setting-label">
          <span>{t('settings.lyricSize')}</span>
          <small>{Math.round(settings.lyricSize * 100)}%</small>
        </div>
        <div className="control-with-number">
          <RangeSlider
            value={settings.lyricSize}
            min={0.7}
            max={1.6}
            step={0.05}
            onChange={(value) => set('lyricSize', value)}
            ariaLabel={t('settings.lyricSize')}
            ariaValueText={`${Math.round(settings.lyricSize * 100)}%`}
          />
          <NumberField
            value={Math.round(settings.lyricSize * 100)}
            min={70}
            max={160}
            step={5}
            suffix="%"
            ariaLabel={t('settings.lyricSize')}
            onChange={(value) => set('lyricSize', value / 100)}
          />
        </div>
      </div>

      <div className="setting-row is-stacked">
        <div className="setting-label">
          <span>{t('settings.translationSize')}</span>
          <small>{Math.round(settings.lyricTranslationSize * 100)}%</small>
        </div>
        <div className="control-with-number">
          <RangeSlider
            value={settings.lyricTranslationSize}
            min={0.4}
            max={1.2}
            step={0.01}
            onChange={(value) => set('lyricTranslationSize', value)}
            ariaLabel={t('settings.translationSize')}
            ariaValueText={`${Math.round(settings.lyricTranslationSize * 100)}%`}
          />
          <NumberField
            value={Math.round(settings.lyricTranslationSize * 100)}
            min={40}
            max={120}
            step={1}
            suffix="%"
            ariaLabel={t('settings.translationSize')}
            onChange={(value) => set('lyricTranslationSize', value / 100)}
          />
        </div>
      </div>

      <div className="setting-row is-stacked">
        <div className="setting-label">
          <span>{t('settings.lyricWeight')}</span>
          <small>{settings.lyricWeight}</small>
        </div>
        <div className="control-with-number">
          <RangeSlider
            value={settings.lyricWeight}
            min={200}
            max={800}
            step={100}
            onChange={(value) => set('lyricWeight', value)}
            ariaLabel={t('settings.lyricWeight')}
            ariaValueText={`${settings.lyricWeight}`}
          />
          <NumberField
            value={settings.lyricWeight}
            min={200}
            max={800}
            step={100}
            suffix=""
            ariaLabel={t('settings.lyricWeight')}
            onChange={(value) => set('lyricWeight', value)}
          />
        </div>
      </div>

      <div className="setting-row is-stacked">
        <div className="setting-label">
          <span>{t('settings.lyricFont')}</span>
        </div>
        <Dropdown
          value={settings.lyricFont}
          onChange={(value) => set('lyricFont', value as Settings['lyricFont'])}
          options={fontOptions(t)}
          ariaLabel={t('settings.lyricFont')}
          menuLabel={t('settings.lyricFont')}
        />
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.lyricAlign')}</span>
          <small>{t('settings.lyricAlignHint')}</small>
        </div>
        <Dropdown
          value={settings.lyricAlign}
          onChange={(value) => set('lyricAlign', value as Settings['lyricAlign'])}
          options={[
            { value: 'left', label: t('settings.lyricAlignLeft') },
            { value: 'center', label: t('settings.lyricAlignCenter') },
          ]}
          ariaLabel={t('settings.lyricAlign')}
          menuLabel={t('settings.lyricAlign')}
        />
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.lyricBlur')}</span>
          <small>{t('settings.lyricBlurHint')}</small>
        </div>
        <Switch checked={settings.lyricBlur} onChange={(value) => set('lyricBlur', value)} label={t('settings.lyricBlur')} />
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.showTranslation')}</span>
          <small>{t('settings.translationHint')}</small>
        </div>
        <Switch
          checked={settings.showTranslation}
          onChange={(value) => set('showTranslation', value)}
          label={t('settings.showTranslation')}
        />
      </div>

    </section>
  );
}
