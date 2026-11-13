import {
  ChevronDown24Regular,
  Speaker024Regular,
  Speaker124Regular,
  Speaker224Regular,
  SpeakerMute24Regular,
  ArrowReset24Regular,
  MusicNote224Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useSettingsStore, EQ_FREQUENCIES } from '../../state/settings';
import { useI18n } from '../../i18n/I18nProvider';
import { useShortcutTooltip } from '../../hooks/useShortcuts';
import { IconButton } from '../common/IconButton';
import { NumberField } from '../common/NumberField';
import { RangeSlider } from '../common/RangeSlider';
import { Switch } from '../common/Switch';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useUiStore } from '../../state/ui';

const PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0],
  bass: [6, 4, 0, -1, -2],
  vocal: [-2, 0, 4, 3, 1],
  rock: [4, 2, -1, 3, 4],
};

const FREQ_LABELS = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'];

function VolumeIcon({ volume, muted }: { volume: number; muted: boolean }): React.ReactElement {
  if (muted || volume <= 0.001) return <SpeakerMute24Regular />;
  if (volume < 0.34) return <Speaker024Regular />;
  if (volume < 0.7) return <Speaker124Regular />;
  return <Speaker224Regular />;
}

export function VolumePanel(): React.ReactElement {
  const volume = useSettingsStore((state) => state.volume);
  const muted = useSettingsStore((state) => state.muted);
  const setVolume = useSettingsStore((state) => state.setVolume);
  const toggleMute = useSettingsStore((state) => state.toggleMute);
  const eqEnabled = useSettingsStore((state) => state.eqEnabled);
  const eqGains = useSettingsStore((state) => state.eqGains);
  const setEqGain = useSettingsStore((state) => state.setEqGain);
  const patch = useSettingsStore((state) => state.patch);
  const [expanded, setExpanded] = useState(eqEnabled);
  const isMobile = useMediaQuery('(max-width: 700px)');
  const pushToast = useUiStore((state) => state.pushToast);
  const clearActive = eqEnabled && eqGains.some((gain) => gain !== 0);
  const { t } = useI18n();
  const muteTooltip = useShortcutTooltip('mute', muted ? t('player.unmute') : t('player.mute'));

  const toggleClearSound = (): void => {
    if (clearActive) {
      patch({ eqEnabled: false, eqGains: [0, 0, 0, 0, 0] });
      pushToast(t('mobile.clearSoundOff'));
    } else {
      patch({ eqEnabled: true, eqGains: [3, 1, 0, 2, 3] });
      setExpanded(true);
      pushToast(t('mobile.clearSoundOn'));
    }
  };

  const setPreset = (name: string): void => {
    patch({ eqEnabled: true, eqGains: [...PRESETS[name]] });
    setExpanded(true);
  };

  return (
    <div className="panel volume-panel">
      <div className="panel-heading">
        <div>
          <h3>{t('volume.title')}</h3>
          <p className="panel-hint">{t('volume.hint')}</p>
        </div>
        <NumberField
          value={Math.round(volume * 100)}
          min={0}
          max={120}
          step={1}
          suffix="%"
          ariaLabel={t('volume.title')}
          onChange={(value) => setVolume(value / 100)}
        />
      </div>

      <div className="volume-row">
        <IconButton
          label={muteTooltip}
          tooltip={muteTooltip}
          variant="subtle"
          size="sm"
          onClick={toggleMute}
        >
          <VolumeIcon volume={volume} muted={muted} />
        </IconButton>
        <RangeSlider
          value={volume}
          min={0}
          max={1.2}
          step={0.01}
          onChange={setVolume}
          ariaLabel={t('a11y.volume')}
          ariaValueText={`${Math.round(volume * 100)}%`}
          className="volume-range"
        />
      </div>

      {isMobile ? (
        <button
          type="button"
          className={`clear-sound-row ${clearActive ? 'is-active' : ''}`.trim()}
          onClick={toggleClearSound}
          aria-pressed={clearActive}
        >
          <span><MusicNote224Regular /> {t('mobile.clearSound')}</span>
          <span>{clearActive ? t('common.on') : t('common.off')}</span>
        </button>
      ) : null}

      <div className={`eq-section ${expanded ? 'is-expanded' : ''}`.trim()}>
        <button
          type="button"
          className="eq-header"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span className="eq-title">
            <span className={`eq-glyph ${eqEnabled ? 'is-on' : ''}`.trim()} aria-hidden="true">
              <i /><i /><i /><i /><i />
            </span>
            {t('volume.eq')}
          </span>
          <span className="eq-header-right">
            <span className="eq-state">{eqEnabled ? t('common.on') : t('common.off')}</span>
            <ChevronDown24Regular className="eq-chevron" aria-hidden="true" />
          </span>
        </button>

        {expanded ? (
          <div className="eq-body">
            <div className="eq-toolbar">
              <Switch
                checked={eqEnabled}
                onChange={(checked) => patch({ eqEnabled: checked })}
                label={t('volume.eqOn')}
              />
              <div className="eq-presets" role="group" aria-label={t('volume.eq')}>
                {(['flat', 'bass', 'vocal', 'rock'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="preset-chip"
                    onClick={() => setPreset(preset)}
                  >
                    {t(`volume.preset.${preset}`)}
                  </button>
                ))}
                <button
                  type="button"
                  className="preset-reset"
                  onClick={() => patch({ eqGains: [0, 0, 0, 0, 0] })}
                  aria-label={t('volume.reset')}
                  data-tooltip={t('volume.reset')}
                >
                  <ArrowReset24Regular />
                </button>
              </div>
            </div>
            <div className="eq-bands" aria-hidden={!eqEnabled}>
              {EQ_FREQUENCIES.map((frequency, index) => (
                <div className={`eq-band ${eqEnabled ? '' : 'is-disabled'}`.trim()} key={frequency}>
                  <span className="eq-freq">{FREQ_LABELS[index]}</span>
                  <RangeSlider
                    value={eqGains[index]}
                    min={-12}
                    max={12}
                    step={1}
                    onChange={(value) => setEqGain(index, value)}
                    ariaLabel={`${FREQ_LABELS[index]} ${t('volume.eq')}`}
                    ariaValueText={`${eqGains[index] > 0 ? '+' : ''}${eqGains[index]} dB`}
                    disabled={!eqEnabled}
                    className="eq-range"
                  />
                  <span className="eq-gain">{eqGains[index] > 0 ? '+' : ''}{eqGains[index]}</span>
                </div>
              ))}
            </div>
            <p className="eq-hint">{t('volume.eqHint')}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
