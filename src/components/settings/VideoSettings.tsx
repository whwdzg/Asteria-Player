import { Chat24Regular, SlideText24Regular } from '@fluentui/react-icons';
import type { Settings } from '../../lib/types';
import { languageLabel } from '../../lib/subtitles';
import { useI18n } from '../../i18n/I18nProvider';
import { useLibraryStore } from '../../state/library';
import { useSettingsStore } from '../../state/settings';
import { Dropdown } from '../common/Dropdown';
import { NumberField } from '../common/NumberField';
import { RangeSlider } from '../common/RangeSlider';
import { Switch } from '../common/Switch';
import { fontOptions } from './fontOptions';

export function VideoSettings(): React.ReactElement {
  const settings = useSettingsStore();
  const patch = useSettingsStore((state) => state.patch);
  const tracks = useLibraryStore((state) => state.tracks);
  const { t } = useI18n();

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    patch({ [key]: value } as Partial<Settings>);
  };

  const subtitleMap = new Map<string, string>();
  for (const track of tracks) {
    for (const subtitle of track.subtitles ?? []) {
      if (!subtitleMap.has(subtitle.lang)) subtitleMap.set(subtitle.lang, subtitle.label);
    }
  }
  if (settings.subtitleLang !== 'auto' && settings.subtitleLang !== 'off' && !subtitleMap.has(settings.subtitleLang)) {
    subtitleMap.set(settings.subtitleLang, languageLabel(settings.subtitleLang));
  }
  const subtitleOptions = [
    { value: 'auto', label: t('settings.subtitleAuto') },
    { value: 'off', label: t('settings.subtitleOff') },
    ...[...subtitleMap.entries()].map(([value, label]) => ({ value, label })),
  ];

  return (
    <section className="settings-section" aria-labelledby="settings-video">
      <h3 id="settings-video" className="section-title">
        <SlideText24Regular /> {t('settings.video')}
      </h3>

      <div className="setting-row">
        <div className="setting-label"><span>{t('settings.subtitle')}</span></div>
        <Dropdown
          value={settings.subtitleLang}
          onChange={(value) => set('subtitleLang', value)}
          options={subtitleOptions}
          ariaLabel={t('settings.subtitle')}
          menuLabel={t('settings.subtitle')}
        />
      </div>

      <div className="setting-row is-stacked">
        <div className="setting-label"><span className="setting-subhead">{t('settings.subtitleStyle')}</span></div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.subtitleBg')}</span></div>
          <span className="setting-inline-control">
            <RangeSlider
              value={settings.subtitleBgOpacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => set('subtitleBgOpacity', value)}
              ariaLabel={t('settings.subtitleBg')}
              ariaValueText={`${Math.round(settings.subtitleBgOpacity * 100)}%`}
            />
            <NumberField
              value={Math.round(settings.subtitleBgOpacity * 100)}
              min={0}
              max={100}
              suffix="%"
              ariaLabel={t('settings.subtitleBg')}
              onChange={(value) => set('subtitleBgOpacity', value / 100)}
            />
          </span>
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.subtitleOpacity')}</span></div>
          <span className="setting-inline-control">
            <RangeSlider
              value={settings.subtitleTextOpacity}
              min={0.2}
              max={1}
              step={0.01}
              onChange={(value) => set('subtitleTextOpacity', value)}
              ariaLabel={t('settings.subtitleOpacity')}
              ariaValueText={`${Math.round(settings.subtitleTextOpacity * 100)}%`}
            />
            <NumberField
              value={Math.round(settings.subtitleTextOpacity * 100)}
              min={20}
              max={100}
              suffix="%"
              ariaLabel={t('settings.subtitleOpacity')}
              onChange={(value) => set('subtitleTextOpacity', value / 100)}
            />
          </span>
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.subtitleFont')}</span></div>
          <Dropdown
            value={settings.subtitleFont}
            onChange={(value) => set('subtitleFont', value as Settings['subtitleFont'])}
            options={fontOptions(t)}
            ariaLabel={t('settings.subtitleFont')}
            menuLabel={t('settings.subtitleFont')}
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span><Chat24Regular className="inline-icon" /> {t('settings.danmaku')}</span>
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
          <div className="setting-label"><span>{t('settings.danmakuTop')}</span></div>
          <Switch
            checked={settings.danmakuTop}
            onChange={(value) => set('danmakuTop', value)}
            label={t('settings.danmakuTop')}
            disabled={!settings.danmakuEnabled}
          />
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.danmakuScroll')}</span></div>
          <Switch
            checked={settings.danmakuScroll}
            onChange={(value) => set('danmakuScroll', value)}
            label={t('settings.danmakuScroll')}
            disabled={!settings.danmakuEnabled}
          />
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.danmakuWeight')}</span></div>
          <span className="setting-inline-control">
            <RangeSlider
              value={settings.danmakuWeight}
              min={300}
              max={800}
              step={100}
              onChange={(value) => set('danmakuWeight', value)}
              ariaLabel={t('settings.danmakuWeight')}
              ariaValueText={`${settings.danmakuWeight}`}
              disabled={!settings.danmakuEnabled}
            />
            <NumberField
              value={settings.danmakuWeight}
              min={300}
              max={800}
              step={100}
              ariaLabel={t('settings.danmakuWeight')}
              onChange={(value) => set('danmakuWeight', value)}
            />
          </span>
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.danmakuSize')}</span></div>
          <span className="setting-inline-control">
            <RangeSlider
              value={settings.danmakuSize}
              min={12}
              max={48}
              step={1}
              onChange={(value) => set('danmakuSize', value)}
              ariaLabel={t('settings.danmakuSize')}
              ariaValueText={`${settings.danmakuSize}px`}
              disabled={!settings.danmakuEnabled}
            />
            <NumberField
              value={settings.danmakuSize}
              min={12}
              max={48}
              step={1}
              suffix="px"
              ariaLabel={t('settings.danmakuSize')}
              onChange={(value) => set('danmakuSize', value)}
            />
          </span>
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.danmakuArea')}</span></div>
          <Dropdown
            value={settings.danmakuArea}
            onChange={(value) => set('danmakuArea', value as Settings['danmakuArea'])}
            options={[
              { value: 'quarter', label: t('settings.areaQuarter') },
              { value: 'half', label: t('settings.areaHalf') },
              { value: 'threeQuarter', label: t('settings.areaThreeQuarter') },
              { value: 'full', label: t('settings.areaFull') },
            ]}
            ariaLabel={t('settings.danmakuArea')}
            menuLabel={t('settings.danmakuArea')}
          />
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.danmakuOpacity')}</span></div>
          <span className="setting-inline-control">
            <RangeSlider
              value={settings.danmakuOpacity}
              min={0.2}
              max={1}
              step={0.01}
              onChange={(value) => set('danmakuOpacity', value)}
              ariaLabel={t('settings.danmakuOpacity')}
              ariaValueText={`${Math.round(settings.danmakuOpacity * 100)}%`}
              disabled={!settings.danmakuEnabled}
            />
            <NumberField
              value={Math.round(settings.danmakuOpacity * 100)}
              min={20}
              max={100}
              suffix="%"
              ariaLabel={t('settings.danmakuOpacity')}
              onChange={(value) => set('danmakuOpacity', value / 100)}
            />
          </span>
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.danmakuSpeed')}</span></div>
          <span className="setting-inline-control">
            <RangeSlider
              value={settings.danmakuSpeed}
              min={0.5}
              max={2.5}
              step={0.05}
              onChange={(value) => set('danmakuSpeed', value)}
              ariaLabel={t('settings.danmakuSpeed')}
              ariaValueText={`${settings.danmakuSpeed.toFixed(2)}×`}
              disabled={!settings.danmakuEnabled}
            />
            <NumberField
              value={settings.danmakuSpeed}
              min={0.5}
              max={2.5}
              step={0.05}
              suffix="×"
              decimals={2}
              ariaLabel={t('settings.danmakuSpeed')}
              onChange={(value) => set('danmakuSpeed', value)}
            />
          </span>
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.danmakuFont')}</span></div>
          <Dropdown
            value={settings.danmakuFont}
            onChange={(value) => set('danmakuFont', value as Settings['danmakuFont'])}
            options={fontOptions(t)}
            ariaLabel={t('settings.danmakuFont')}
            menuLabel={t('settings.danmakuFont')}
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span>{t('settings.fullscreenClock')}</span>
          <small>{t('settings.fullscreenClockHint')}</small>
        </div>
        <Switch
          checked={settings.fullscreenClock}
          onChange={(value) => set('fullscreenClock', value)}
          label={t('settings.fullscreenClock')}
        />
      </div>
      <div className={`setting-subgroup ${settings.fullscreenClock ? '' : 'is-disabled'}`.trim()}>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.fsClockHours')}</span></div>
          <Switch
            checked={settings.fullscreenClockHours}
            onChange={(value) => set('fullscreenClockHours', value)}
            label={t('settings.fsClockHours')}
            disabled={!settings.fullscreenClock}
          />
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.fsClockSeconds')}</span></div>
          <Switch
            checked={settings.fullscreenClockSeconds}
            onChange={(value) => set('fullscreenClockSeconds', value)}
            label={t('settings.fsClockSeconds')}
            disabled={!settings.fullscreenClock}
          />
        </div>
        <div className="setting-row compact">
          <div className="setting-label"><span>{t('settings.fsClockDate')}</span></div>
          <Switch
            checked={settings.fullscreenClockDate}
            onChange={(value) => set('fullscreenClockDate', value)}
            label={t('settings.fsClockDate')}
            disabled={!settings.fullscreenClock}
          />
        </div>
      </div>
    </section>
  );
}
