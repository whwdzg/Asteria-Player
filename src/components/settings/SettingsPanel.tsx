import {
  Desktop24Regular,
  Dismiss24Regular,
  Info24Regular,
  TextFont24Regular,
  Translate24Regular,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
  Globe24Regular,
  SlideText24Regular,
  PaintBrush24Regular,
  Play24Regular,
} from '@fluentui/react-icons';
import { useMemo } from 'react';
import type { Settings } from '../../lib/types';
import { languageLabel } from '../../lib/subtitles';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useSettingsStore } from '../../state/settings';
import { IconButton } from '../common/IconButton';
import { RangeSlider } from '../common/RangeSlider';
import { Segmented } from '../common/Segmented';
import { Select } from '../common/Select';
import { Switch } from '../common/Switch';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.ReactElement {
  const settings = useSettingsStore();
  const patch = useSettingsStore((state) => state.patch);
  const tracks = useLibraryStore((state) => state.tracks);
  const { t, languages, setLanguage, preference } = useI18n();

  const languageOptions = useMemo(
    () => [
      { value: 'system', label: t('common.system') },
      ...languages.map((language) => ({ value: language.code, label: language.nativeLabel || language.label })),
    ],
    [languages, t],
  );

  const subtitleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const track of tracks) {
      for (const subtitle of track.subtitles ?? []) {
        if (!map.has(subtitle.lang)) map.set(subtitle.lang, subtitle.label);
      }
    }
    if (settings.subtitleLang !== 'auto' && settings.subtitleLang !== 'off' && !map.has(settings.subtitleLang)) {
      map.set(settings.subtitleLang, languageLabel(settings.subtitleLang));
    }
    return [
      { value: 'auto', label: t('settings.subtitleAuto') },
      { value: 'off', label: t('settings.subtitleOff') },
      ...[...map.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [tracks, settings.subtitleLang, t]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    patch({ [key]: value } as Partial<Settings>);
  };

  return (
    <div className="settings-panel" role="document">
      <header className="settings-header">
        <div>
          <h2>{t('settings.title')}</h2>
          <p>{t('app.tagline')}</p>
        </div>
        <IconButton label={t('common.close')} variant="subtle" onClick={onClose}>
          <Dismiss24Regular />
        </IconButton>
      </header>

      <div className="settings-scroll">
        <section className="settings-section" aria-labelledby="settings-appearance">
          <h3 id="settings-appearance" className="section-title">
            <PaintBrush24Regular /> {t('settings.appearance')}
          </h3>
          <div className="setting-row is-stacked">
            <div className="setting-label">
              <span>{t('settings.theme')}</span>
            </div>
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
            <Select
              value={preference}
              onChange={setLanguage}
              options={languageOptions}
              ariaLabel={t('settings.language')}
              icon={<Globe24Regular />}
            />
          </div>

          <div className="setting-row">
            <div className="setting-label">
              <span>{t('settings.liquidGlass')}</span>
              <small>{t('settings.liquidGlassHint')}</small>
            </div>
            <Switch
              checked={settings.liquidGlass}
              onChange={(value) => set('liquidGlass', value)}
              label={t('settings.liquidGlass')}
            />
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-lyrics">
          <h3 id="settings-lyrics" className="section-title">
            <TextFont24Regular /> {t('settings.lyrics')}
          </h3>
          <div className="setting-row is-stacked">
            <div className="setting-label">
              <span>{t('settings.lyricSize')}</span>
              <small>{Math.round(settings.lyricSize * 100)}%</small>
            </div>
            <RangeSlider
              value={settings.lyricSize}
              min={0.8}
              max={1.4}
              step={0.05}
              onChange={(value) => set('lyricSize', value)}
              ariaLabel={t('settings.lyricSize')}
              ariaValueText={`${Math.round(settings.lyricSize * 100)}%`}
            />
          </div>
          <div className="setting-row is-stacked">
            <div className="setting-label">
              <span>{t('settings.lyricWeight')}</span>
            </div>
            <Segmented
              size="sm"
              value={settings.lyricWeight}
              onChange={(value) => set('lyricWeight', value)}
              ariaLabel={t('settings.lyricWeight')}
              options={[
                { value: 300, label: t('settings.weightLight') },
                { value: 400, label: t('settings.weightRegular') },
                { value: 600, label: t('settings.weightSemibold') },
              ]}
            />
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

        <section className="settings-section" aria-labelledby="settings-video">
          <h3 id="settings-video" className="section-title">
            <SlideText24Regular /> {t('settings.video')}
          </h3>
          <div className="setting-row">
            <div className="setting-label">
              <span>{t('settings.subtitle')}</span>
            </div>
            <Select
              value={settings.subtitleLang}
              onChange={(value) => set('subtitleLang', value)}
              options={subtitleOptions}
              ariaLabel={t('settings.subtitle')}
            />
          </div>
          <div className="setting-row">
            <div className="setting-label">
              <span>{t('settings.danmaku')}</span>
              <small>{t('settings.danmakuHint')}</small>
            </div>
            <Switch
              checked={settings.danmakuEnabled}
              onChange={(value) => set('danmakuEnabled', value)}
              label={t('settings.danmaku')}
            />
          </div>
          <div className={`setting-subgroup ${settings.danmakuEnabled ? '' : 'is-disabled'}`.trim()}>
            <div className="setting-row compact">
              <div className="setting-label">
                <span>{t('settings.danmakuTop')}</span>
              </div>
              <Switch
                checked={settings.danmakuTop}
                onChange={(value) => set('danmakuTop', value)}
                label={t('settings.danmakuTop')}
                disabled={!settings.danmakuEnabled}
              />
            </div>
            <div className="setting-row compact">
              <div className="setting-label">
                <span>{t('settings.danmakuScroll')}</span>
              </div>
              <Switch
                checked={settings.danmakuScroll}
                onChange={(value) => set('danmakuScroll', value)}
                label={t('settings.danmakuScroll')}
                disabled={!settings.danmakuEnabled}
              />
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-playback">
          <h3 id="settings-playback" className="section-title">
            <Play24Regular /> {t('settings.behavior')}
          </h3>
          <div className="setting-row is-stacked">
            <div className="setting-label">
              <span>{t('settings.shortcuts')}</span>
            </div>
            <p className="shortcuts-hint">{t('settings.shortcutsHint')}</p>
          </div>
        </section>

        <section className="settings-section about-section" aria-labelledby="settings-about">
          <h3 id="settings-about" className="section-title">
            <Info24Regular /> {t('settings.about')}
          </h3>
          <div className="about-card">
            <span className="about-mark" aria-hidden="true">A</span>
            <div>
              <strong>{t('app.name')}</strong>
              <p>{t('settings.version')}</p>
              <p>{t('settings.madeWith')}</p>
            </div>
          </div>
          <p className="language-note">
            <Translate24Regular /> {t('settings.languageHint')}
          </p>
        </section>
      </div>
    </div>
  );
}
