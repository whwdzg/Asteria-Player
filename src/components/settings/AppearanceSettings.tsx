/**
 * Appearance, language, ambient background and runtime language-pack import.
 */
import {
  ArrowImport24Regular,
  Desktop24Regular,
  Globe24Regular,
  PaintBrush24Regular,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
} from '@fluentui/react-icons';
import { useRef } from 'react';
import type { Settings } from '../../lib/types';
import { parseLanguagePackJson } from '../../lib/languagePacks';
import { useI18n } from '../../i18n/I18nProvider';
import { useSettingsStore } from '../../state/settings';
import { useUiStore } from '../../state/ui';
import { Dropdown } from '../common/Dropdown';
import { NumberField } from '../common/NumberField';
import { RangeSlider } from '../common/RangeSlider';
import { Segmented } from '../common/Segmented';
import { Switch } from '../common/Switch';

export function AppearanceSettings(): React.ReactElement {
  const settings = useSettingsStore();
  const patch = useSettingsStore((state) => state.patch);
  const { t, languages, setLanguage, preference, importLanguagePack } = useI18n();
  const pushToast = useUiStore((state) => state.pushToast);
  const languageFileRef = useRef<HTMLInputElement>(null);

  const languageOptions = [
    { value: 'system', label: t('common.system') },
    ...languages.map((language) => ({ value: language.code, label: language.nativeLabel || language.label })),
  ];

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    patch({ [key]: value } as Partial<Settings>);
  };

  const importLanguageFile = async (file: File): Promise<void> => {
    try {
      const pack = parseLanguagePackJson(await file.text(), file.name);
      importLanguagePack(pack);
      pushToast(t('settings.languageImported'));
    } catch (reason) {
      pushToast(`${t('settings.languageImportInvalid')}: ${reason instanceof Error ? reason.message : String(reason)}`, 'error');
    }
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
          <span>{t('settings.languageImport')}</span>
          <small>{t('settings.languageImportHint')}</small>
        </div>
        <button type="button" className="fluent-button" onClick={() => languageFileRef.current?.click()}>
          <ArrowImport24Regular /> {t('settings.languageImport')}
        </button>
        <input
          ref={languageFileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label={t('settings.languageImport')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importLanguageFile(file);
            event.target.value = '';
          }}
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

      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.audioVisualizer')}</span>
          <small>{t('settings.audioVisualizerHint')}</small>
        </div>
        <Switch
          checked={settings.audioVisualizer}
          onChange={(value) => set('audioVisualizer', value)}
          label={t('settings.audioVisualizer')}
        />
      </div>

      <div className={`setting-subgroup ${settings.audioVisualizer ? '' : 'is-disabled'}`.trim()}>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.visualizerHeight')}</span></div>
          <span className="setting-inline-control">
            <RangeSlider
              value={settings.audioVisualizerHeight}
              min={0.4}
              max={1}
              step={0.05}
              onChange={(value) => set('audioVisualizerHeight', value)}
              ariaLabel={t('settings.visualizerHeight')}
              ariaValueText={`${Math.round(settings.audioVisualizerHeight * 100)}%`}
            />
            <NumberField
              value={Math.round(settings.audioVisualizerHeight * 100)}
              min={40}
              max={100}
              suffix="%"
              ariaLabel={t('settings.visualizerHeight')}
              onChange={(value) => set('audioVisualizerHeight', value / 100)}
            />
          </span>
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.visualizerOpacity')}</span></div>
          <span className="setting-inline-control">
            <RangeSlider
              value={settings.audioVisualizerOpacity}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(value) => set('audioVisualizerOpacity', value)}
              ariaLabel={t('settings.visualizerOpacity')}
              ariaValueText={`${Math.round(settings.audioVisualizerOpacity * 100)}%`}
            />
            <NumberField
              value={Math.round(settings.audioVisualizerOpacity * 100)}
              min={10}
              max={100}
              suffix="%"
              ariaLabel={t('settings.visualizerOpacity')}
              onChange={(value) => set('audioVisualizerOpacity', value / 100)}
            />
          </span>
        </div>
      </div>
    </section>
  );
}
