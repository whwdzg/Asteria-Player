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

  const cycleMode = (): void => {
    const index = MODES.indexOf(mode);
    const next = MODES[(index + 1) % MODES.length];
    patch({ playMode: next });
    useUiStore.getState().pushToast(t('player.modeChanged', { mode: t(`player.mode.${next}`) }));
  };

  return (
    <div className={`transport-controls ${hasTrack ? '' : 'is-empty'}`.trim()} role="group" aria-label={t('player.play')}>
      <IconButton
        label={t('player.previous')}
        tooltip={t('player.previous')}
        onClick={() => player.previous()}
        disabled={!hasTrack}
      >
        <Previous24Filled />
      </IconButton>
      <IconButton
        label={t('player.rewind10')}
        tooltip={t('player.rewind10')}
        onClick={() => player.rewind()}
        disabled={!hasTrack}
      >
        <SkipBack1024Regular />
      </IconButton>
      <button
        type="button"
        className={`play-button ${isLoading && hasTrack ? 'is-loading' : ''}`.trim()}
        aria-label={isPlaying ? t('player.pause') : t('player.play')}
        data-tooltip={isPlaying ? t('player.pause') : t('player.play')}
        onClick={() => player.toggle()}
        disabled={!hasTrack}
      >
        <span className="play-button-ring" aria-hidden="true" />
        {isPlaying ? <Pause24Filled /> : <Play24Filled />}
      </button>
      <IconButton
        label={t('player.forward10')}
        tooltip={t('player.forward10')}
        onClick={() => player.forward()}
        disabled={!hasTrack}
      >
        <SkipForward1024Regular />
      </IconButton>
      <IconButton
        label={t('player.next')}
        tooltip={t('player.next')}
        onClick={() => player.next()}
        disabled={!hasTrack}
      >
        <Next24Filled />
      </IconButton>
      <span className="transport-divider" aria-hidden="true" />
      <IconButton
        label={t(`player.mode.${mode}`)}
        tooltip={t(`player.mode.${mode}`)}
        active={mode !== 'all'}
        onClick={cycleMode}
        className="mode-button"
      >
        <PlayModeIcon mode={mode} />
      </IconButton>
    </div>
  );
}
