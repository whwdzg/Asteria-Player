import {
  Desktop24Regular,
  Globe24Regular,
  PaintBrush24Regular,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
} from '@fluentui/react-icons';
import type { Settings } from '../../lib/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useSettingsStore } from '../../state/settings';
import { Dropdown } from '../common/Dropdown';
import { Segmented } from '../common/Segmented';
import { Switch } from '../common/Switch';

export function AppearanceSettings(): React.ReactElement {
  const settings = useSettingsStore();
  const patch = useSettingsStore((state) => state.patch);
  const { t, languages, setLanguage, preference } = useI18n();

  const languageOptions = [
    { value: 'system', label: t('common.system') },
    ...languages.map((language) => ({ value: language.code, label: language.nativeLabel || language.label })),
  ];

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    patch({ [key]: value } as Partial<Settings>);
  };

  return (
    <section className="settings-section" aria-labelledby="settings-appearance">
      <h3 id="settings-appearance" className="section-title">
        <PaintBrush24Regular /> {t('settings.appearance')}
      </h3>
      <div className="setting-row is-stacked">
        <div className="setting-label"><span>{t('settings.theme')}</span></div>
        <Segmented
          value={settings.theme}
          onChange={(value) => set('theme', value)}
          ariaLabel={t('settings.theme')}
          options={[
            { value: 'dark', label: t('settings.dark'), icon: <WeatherMoon24Regular /> },
            { value: 'light', label: t('settings.light'), icon: <WeatherSunny24Regular /> },
            { value: 'system', label: t('settings.followSystem'), icon: <Desktop24Regular /> },
          ]}
        />
      </div>

      <div className="setting-row is-stacked">
        <div className="setting-label">
          <span>{t('settings.language')}</span>
          <small>{t('settings.languageHint')}</small>
        </div>
        <Dropdown
          value={preference}
          onChange={setLanguage}
          options={languageOptions}
          ariaLabel={t('settings.language')}
          menuLabel={t('settings.language')}
          icon={<Globe24Regular />}
        />
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.liquidGlass')}</span>
          <small>{t('settings.liquidGlassHint')}</small>
        </div>
        <Switch checked={settings.liquidGlass} onChange={(value) => set('liquidGlass', value)} label={t('settings.liquidGlass')} />
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.dynamicBackground')}</span>
          <small>{t('settings.dynamicBackgroundHint')}</small>
        </div>
        <Switch checked={settings.dynamicBackground} onChange={(value) => set('dynamicBackground', value)} label={t('settings.dynamicBackground')} />
      </div>

      <div className={`setting-subgroup ${settings.dynamicBackground ? '' : 'is-disabled'}`.trim()}>
        <div className="setting-row compact">
          <div className="setting-label">
            <span>{t('settings.backgroundBpm')}</span>
            <small>{t('settings.backgroundBpmHint')}</small>
          </div>
          <Switch
            checked={settings.backgroundBpm}
            onChange={(value) => set('backgroundBpm', value)}
            label={t('settings.backgroundBpm')}
            disabled={!settings.dynamicBackground}
          />
        </div>
        <div className="setting-row compact">
          <div className="setting-label">
            <span>{t('settings.backgroundVideo')}</span>
            <small>{t('settings.backgroundVideoHint')}</small>
          </div>
          <Switch
            checked={settings.backgroundVideo}
            onChange={(value) => set('backgroundVideo', value)}
            label={t('settings.backgroundVideo')}
            disabled={!settings.dynamicBackground}
          />
        </div>
      </div>
    </section>
  );
}
