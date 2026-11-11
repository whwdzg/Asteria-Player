import {
  ArrowRepeat124Regular,
  ArrowRepeatAll24Regular,
  ArrowRepeatAllOff24Regular,
  ArrowShuffle24Regular,
  Next24Filled,
  Pause24Filled,
  Play24Filled,
  Previous24Filled,
  SkipBack1024Regular,
  SkipForward1024Regular,
} from '@fluentui/react-icons';
import type { PlayMode } from '../../lib/types';
import { player } from '../../player/engine';
import { useLibraryStore } from '../../state/library';
import { usePlaybackStore } from '../../state/playback';
import { useSettingsStore } from '../../state/settings';
import { useUiStore } from '../../state/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useShortcutHint } from '../../hooks/useShortcuts';
import { IconButton } from '../common/IconButton';

const MODES: PlayMode[] = ['all', 'one', 'none', 'shuffle'];

export function PlayModeIcon({ mode }: { mode: PlayMode }): React.ReactElement {
  if (mode === 'one') return <ArrowRepeat124Regular />;
  if (mode === 'none') return <ArrowRepeatAllOff24Regular />;
  if (mode === 'shuffle') return <ArrowShuffle24Regular />;
  return <ArrowRepeatAll24Regular />;
}

export function TransportControls(): React.ReactElement {
  const hasTrack = useLibraryStore((state) => Boolean(state.currentId));
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const isLoading = usePlaybackStore((state) => state.isLoading);
  const mode = useSettingsStore((state) => state.playMode);
  const patch = useSettingsStore((state) => state.patch);
  const { t } = useI18n();
  const previousHint = useShortcutHint('previous');
  const rewindHint = useShortcutHint('rewind10');
  const playHint = useShortcutHint('playPause');
  const forwardHint = useShortcutHint('forward10');
  const nextHint = useShortcutHint('next');
  const modeHint = useShortcutHint('cycleMode');

  const cycleMode = (): void => {
    const index = MODES.indexOf(mode);
    const next = MODES[(index + 1) % MODES.length];
    patch({ playMode: next });
    useUiStore.getState().pushToast(t('player.modeChanged', { mode: t(`player.mode.${next}`) }));
  };

  const playLabel = `${isPlaying ? t('player.pause') : t('player.play')}${playHint}`;

  return (
    <div className={`transport-controls ${hasTrack ? '' : 'is-empty'}`.trim()} role="group" aria-label={t('player.play')}>
      <div className="transport-main">
        <IconButton
          label={`${t('player.previous')}${previousHint}`}
          tooltip={`${t('player.previous')}${previousHint}`}
          onClick={() => player.previous()}
          disabled={!hasTrack}
        >
          <Previous24Filled />
        </IconButton>
        <IconButton
          label={`${t('player.rewind10')}${rewindHint}`}
          tooltip={`${t('player.rewind10')}${rewindHint}`}
          onClick={() => player.rewind()}
          disabled={!hasTrack}
        >
          <SkipBack1024Regular />
        </IconButton>
        <button
          type="button"
          className={`play-button ${isLoading && hasTrack ? 'is-loading' : ''}`.trim()}
          aria-label={playLabel}
          data-tooltip={playLabel}
          onClick={() => player.toggle()}
          disabled={!hasTrack}
        >
          <span className="play-button-ring" aria-hidden="true" />
          {isPlaying ? <Pause24Filled /> : <Play24Filled />}
        </button>
        <IconButton
          label={`${t('player.forward10')}${forwardHint}`}
          tooltip={`${t('player.forward10')}${forwardHint}`}
          onClick={() => player.forward()}
          disabled={!hasTrack}
        >
          <SkipForward1024Regular />
        </IconButton>
        <IconButton
          label={`${t('player.next')}${nextHint}`}
          tooltip={`${t('player.next')}${nextHint}`}
          onClick={() => player.next()}
          disabled={!hasTrack}
        >
          <Next24Filled />
        </IconButton>
      </div>
      <IconButton
        label={`${t(`player.mode.${mode}`)}${modeHint}`}
        tooltip={`${t(`player.mode.${mode}`)}${modeHint}`}
        active={mode !== 'all'}
        onClick={cycleMode}
        className="mode-button transport-mode"
      >
        <PlayModeIcon mode={mode} />
      </IconButton>
    </div>
  );
}
