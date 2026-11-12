import {
  FullScreenMaximize24Regular,
  FullScreenMinimize24Regular,
  Settings24Regular,
  Speaker224Regular,
  TextBulletListLtr24Regular,
  Video24Regular,
} from '@fluentui/react-icons';
import { lazy, Suspense, useRef, type ReactNode } from 'react';
import { formatRate } from '../../lib/format';
import { usePlaybackStore } from '../../state/playback';
import { useSettingsStore } from '../../state/settings';
import { useUiStore, type PopoverId } from '../../state/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useDismiss } from '../../hooks/useDismiss';
import { useShortcutHint } from '../../hooks/useShortcuts';
import { IconButton } from '../common/IconButton';
import { PopoverCard } from '../common/PopoverCard';
import { VolumePanel } from '../settings/VolumePanel';
import { BrightnessPanel } from '../settings/BrightnessPanel';
import { PlaybackRatePanel } from '../settings/PlaybackRatePanel';

const SettingsPanel = lazy(() => import('../settings/SettingsPanel').then((module) => ({ default: module.SettingsPanel })));

interface UtilitySlotProps {
  open: boolean;
  onClose: () => void;
  label: string;
  active?: boolean;
  onClick: () => void;
  panel: ReactNode;
  className?: string;
  trigger: ReactNode;
}

function UtilitySlot({
  open,
  onClose,
  label,
  active = false,
  onClick,
  panel,
  className = '',
  trigger,
}: UtilitySlotProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose, open);
  return (
    <div ref={ref} className={`utility-item ${open ? 'is-open' : ''} ${className}`.trim()}>
      <IconButton
        label={label}
        tooltip={label}
        active={active || open}
        onClick={onClick}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {trigger}
      </IconButton>
      {open ? <div className="utility-popover">{panel}</div> : null}
    </div>
  );
}

interface UtilityBarProps {
  onToggleFullscreen: () => void;
}

export function UtilityBar({ onToggleFullscreen }: UtilityBarProps): React.ReactElement {
  const volume = useSettingsStore((state) => state.volume);
  const muted = useSettingsStore((state) => state.muted);
  const playbackRate = useSettingsStore((state) => state.playbackRate);
  const fullscreen = useUiStore((state) => state.fullscreen);
  const popover = useUiStore((state) => state.popover);
  const setPopover = useUiStore((state) => state.setPopover);
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const queueView = useUiStore((state) => state.queueView);
  const openQueue = useUiStore((state) => state.openQueue);
  const setQueueView = useUiStore((state) => state.setQueueView);
  const isLoading = usePlaybackStore((state) => state.isLoading);
  const { t } = useI18n();
  const fullscreenHint = useShortcutHint('fullscreen');
  const queueHint = useShortcutHint('queue');
  const settingsHint = useShortcutHint('settings');

  const volumeLabel = muted ? t('player.unmute') : `${t('player.volume')} · ${Math.round(volume * 100)}%`;
  const fullscreenLabel = `${fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}${fullscreenHint}`;
  const queueLabel = `${t('player.queue')}${queueHint}`;
  const settingsLabel = `${t('player.settings')}${settingsHint}`;
  const speedLabel = `${t('player.playbackRate')} · ${formatRate(playbackRate)}`;

  const togglePopover = (id: PopoverId): void => {
    setPopover(popover === id ? null : id);
  };

  return (
    <div className="utility-bar" role="group" aria-label={t('player.settings')}>
      <UtilitySlot
        open={popover === 'speed'}
        onClose={() => setPopover(null)}
        onClick={() => togglePopover('speed')}
        label={speedLabel}
        trigger={<span className="speed-glyph">{formatRate(playbackRate)}</span>}
        className="speed-slot"
        panel={<PopoverCard label={t('speed.title')}><PlaybackRatePanel /></PopoverCard>}
      />
      <UtilitySlot
        open={popover === 'volume'}
        onClose={() => setPopover(null)}
        onClick={() => togglePopover('volume')}
        label={volumeLabel}
        trigger={<Speaker224Regular />}
        className="volume-slot"
        panel={<PopoverCard label={t('volume.title')}><VolumePanel /></PopoverCard>}
      />
      <UtilitySlot
        open={popover === 'brightness'}
        onClose={() => setPopover(null)}
        onClick={() => togglePopover('brightness')}
        label={t('player.videoOptions')}
        trigger={<Video24Regular />}
        className="brightness-slot"
        panel={<PopoverCard label={t('video.options')}><BrightnessPanel /></PopoverCard>}
      />
      <IconButton
        label={fullscreenLabel}
        tooltip={fullscreenLabel}
        active={fullscreen}
        onClick={onToggleFullscreen}
        className="fullscreen-button"
      >
        {fullscreen ? <FullScreenMinimize24Regular /> : <FullScreenMaximize24Regular />}
      </IconButton>
      <IconButton
        label={queueLabel}
        tooltip={queueLabel}
        active={queueView !== 'closed'}
        onClick={() => (queueView === 'closed' ? openQueue('sidebar') : setQueueView('closed'))}
        className="queue-button"
      >
        <TextBulletListLtr24Regular />
      </IconButton>
      <UtilitySlot
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onClick={() => setSettingsOpen(!settingsOpen)}
        label={settingsLabel}
        trigger={<Settings24Regular className={isLoading ? 'spin-slow' : ''} />}
        className="settings-slot"
        panel={
          <PopoverCard label={t('settings.title')} className="settings-popover">
            <Suspense fallback={<div className="panel-loading" aria-hidden="true"><span /></div>}>
              <SettingsPanel onClose={() => setSettingsOpen(false)} />
            </Suspense>
          </PopoverCard>
        }
      />
    </div>
  );
}
