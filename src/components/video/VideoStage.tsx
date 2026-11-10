import {
  Chat24Regular,
  ClosedCaption24Regular,
  FullScreenMaximize24Regular,
  FullScreenMinimize24Regular,
  Info24Regular,
  Play24Filled,
  SpinnerIos20Regular,
} from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../../lib/types';
import { languageLabel } from '../../lib/subtitles';
import { useLibraryStore } from '../../state/library';
import { usePlaybackStore } from '../../state/playback';
import { useSettingsStore } from '../../state/settings';
import { useUiStore } from '../../state/ui';
import { player } from '../../player/engine';
import { useI18n } from '../../i18n/I18nProvider';
import { IconButton } from '../common/IconButton';
import { Menu, type MenuAnchor } from '../common/Menu';
import { DanmakuLayer } from './DanmakuLayer';
import { SubtitleOverlay } from './SubtitleOverlay';

function hasDanmaku(track: Track): boolean {
  return Boolean(track.danmakuText || track.danmakuUrl);
}

export function VideoStage({ onToggleFullscreen }: { onToggleFullscreen: () => void }): React.ReactElement | null {
  const track = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const isLoading = usePlaybackStore((state) => state.isLoading);
  const subtitleLang = useSettingsStore((state) => state.subtitleLang);
  const patch = useSettingsStore((state) => state.patch);
  const danmakuEnabled = useSettingsStore((state) => state.danmakuEnabled);
  const fullscreen = useUiStore((state) => state.fullscreen);
  const setDetailsTrackId = useUiStore((state) => state.setDetailsTrackId);
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const [subtitleMenu, setSubtitleMenu] = useState<MenuAnchor | null>(null);

  useEffect(() => {
    const element = player.videoElement;
    const host = hostRef.current;
    if (!element || !host) return;
    host.appendChild(element);
    element.classList.add('player-video');
    return () => {
      if (element.parentElement === host) host.removeChild(element);
    };
  }, []);

  const subtitleLabel = useMemo(() => {
    if (!track?.subtitles?.length) return t('settings.subtitleOff');
    if (subtitleLang === 'off') return t('settings.subtitleOff');
    if (subtitleLang === 'auto') return t('settings.subtitleAuto');
    return languageLabel(subtitleLang);
  }, [subtitleLang, t, track]);

  if (!track) return null;

  const subtitleMenuItems = [
    {
      id: 'auto',
      label: t('settings.subtitleAuto'),
      checked: subtitleLang === 'auto',
      onSelect: () => patch({ subtitleLang: 'auto' }),
    },
    {
      id: 'off',
      label: t('settings.subtitleOff'),
      checked: subtitleLang === 'off',
      onSelect: () => patch({ subtitleLang: 'off' }),
    },
    ...(track.subtitles ?? []).map((subtitle) => ({
      id: subtitle.id,
      label: subtitle.label,
      checked: subtitleLang === subtitle.lang,
      onSelect: () => patch({ subtitleLang: subtitle.lang }),
    })),
  ];

  return (
    <section className="video-view" aria-label={track.title}>
      <div
        className="video-frame"
        style={{ '--video-cover': track.cover ? `url("${track.cover}")` : 'none' } as React.CSSProperties}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button, .video-top-tools')) return;
          player.toggle();
        }}
      >
        <div className="video-media" ref={hostRef} />
        <div className="video-backdrop-glow" aria-hidden="true" />
        <div className="video-scrim" aria-hidden="true" />

        <div className="video-top-tools" onClick={(event) => event.stopPropagation()}>
          <div className="video-identity">
            <span className="video-badge"><span className="live-dot" /> {t('np.video')}</span>
            <h1>{track.title}</h1>
            <p>{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
          </div>
          <div className="video-quick-tools">
            {track.subtitles?.length ? (
              <>
                <IconButton
                  label={`${t('np.subtitles')} · ${subtitleLabel}`}
                  tooltip={t('np.subtitles')}
                  active={subtitleLang !== 'off'}
                  onClick={(event) => setSubtitleMenu({ rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}
                >
                  <ClosedCaption24Regular />
                </IconButton>
                <Menu
                  open={Boolean(subtitleMenu)}
                  anchor={subtitleMenu}
                  items={subtitleMenuItems}
                  onClose={() => setSubtitleMenu(null)}
                  label={t('np.subtitles')}
                />
              </>
            ) : null}
            {hasDanmaku(track) ? (
              <IconButton
                label={t('np.danmaku')}
                tooltip={t('np.danmaku')}
                active={danmakuEnabled}
                onClick={() => patch({ danmakuEnabled: !danmakuEnabled })}
              >
                <Chat24Regular />
              </IconButton>
            ) : null}
            <IconButton
              label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
              tooltip={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
              onClick={onToggleFullscreen}
            >
              {fullscreen ? <FullScreenMinimize24Regular /> : <FullScreenMaximize24Regular />}
            </IconButton>
          </div>
        </div>

        <div className="video-center-control" onClick={(event) => event.stopPropagation()}>
          {isLoading ? (
            <span className="video-loading" aria-label={t('loading')}><SpinnerIos20Regular /></span>
          ) : !isPlaying ? (
            <button
              type="button"
              className="video-play-toggle"
              aria-label={t('player.play')}
              onClick={() => player.toggle()}
            >
              <Play24Filled />
            </button>
          ) : null}
        </div>

        <DanmakuLayer track={track} />
        <SubtitleOverlay track={track} />
      </div>

      <div className="video-meta-card">
        <div className="video-meta-heading">
          <span className="video-badge"><span className="live-dot" /> {t('np.video')}</span>
          <h2>{track.title}</h2>
          <p>{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
        </div>
        <div className="video-meta-chips">
          {track.format ? <span>{track.format}</span> : null}
          {track.videoWidth && track.videoHeight ? <span>{track.videoWidth} × {track.videoHeight}</span> : null}
          {track.subtitles?.length ? <span>{t('np.subtitles')} · {subtitleLabel}</span> : null}
          {hasDanmaku(track) ? <span>{t('np.danmaku')} · {danmakuEnabled ? t('common.on') : t('common.off')}</span> : null}
        </div>
        <button type="button" className="text-button video-detail-button" onClick={() => setDetailsTrackId(track.id)}>
          <Info24Regular /> {t('details.title')}
        </button>
      </div>
    </section>
  );
}
