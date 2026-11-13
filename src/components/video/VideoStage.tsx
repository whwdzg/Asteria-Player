/**
 * Video surface: element mounting, auto-hiding chrome, gestures, danmaku,
 * subtitles and the video-properties entry point.
 */
import {
  Chat24Regular,
  ClosedCaption24Regular,
  FullScreenMaximize24Regular,
  FullScreenMinimize24Regular,
  Info24Regular,
  LockClosed24Regular,
  LockOpen24Regular,
  Pause24Filled,
  Play24Filled,
  Speaker224Regular,
  SpinnerIos20Regular,
  WeatherSunny24Regular,
} from '@fluentui/react-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../../lib/types';
import { languageLabel } from '../../lib/subtitles';
import { formatTime } from '../../lib/format';
import { useLibraryStore } from '../../state/library';
import { usePlaybackStore } from '../../state/playback';
import { useSettingsStore } from '../../state/settings';
import { useUiStore } from '../../state/ui';
import { player } from '../../player/engine';
import { useI18n } from '../../i18n/I18nProvider';
import { useShortcutHint } from '../../hooks/useShortcuts';
import { useTouchDevice } from '../../hooks/useTouchDevice';
import { useVideoGestures } from '../../hooks/useVideoGestures';
import { IconButton } from '../common/IconButton';
import { ScrollText } from '../common/ScrollText';
import { Menu, type MenuAnchor } from '../common/Menu';
import { DanmakuLayer } from './DanmakuLayer';
import { FullscreenClock } from './FullscreenClock';
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
  const locked = useUiStore((state) => state.videoLocked);
  const setVideoLocked = useUiStore((state) => state.setVideoLocked);
  const mirror = useSettingsStore((state) => state.mirrorVideo);
  const colorVision = useSettingsStore((state) => state.colorVisionAssist);
  const videoFit = useSettingsStore((state) => state.videoFit);
  const setDetailsTrackId = useUiStore((state) => state.setDetailsTrackId);
  const updateTrack = useLibraryStore((state) => state.updateTrack);
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const [subtitleMenu, setSubtitleMenu] = useState<MenuAnchor | null>(null);
  const isTouch = useTouchDevice();
  const fullscreenHint = useShortcutHint('fullscreen');
  const thumbnailAttempts = useRef(new Set<string>());
  const [toolsHidden, setToolsHidden] = useState(false);
  const [lockRevealed, setLockRevealed] = useState(false);
  const [tempSpeed, setTempSpeed] = useState(false);
  const toolsTimer = useRef(0);
  const clickTimer = useRef(0);
  const lockTimer = useRef(0);

  const showTools = useCallback((): void => {
    window.clearTimeout(toolsTimer.current);
    setToolsHidden(false);
    if (!fullscreen && !isTouch && isPlaying) {
      toolsTimer.current = window.setTimeout(() => setToolsHidden(true), 2800);
    }
  }, [fullscreen, isPlaying, isTouch]);

  const holdTools = useCallback((): void => {
    window.clearTimeout(toolsTimer.current);
    setToolsHidden(false);
  }, []);

  const revealLock = useCallback((): void => {
    setLockRevealed(true);
    window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => setLockRevealed(false), 3000);
  }, []);

  useEffect(() => {
    const onReveal = (): void => revealLock();
    window.addEventListener('asteria:lock-reveal', onReveal);
    return () => window.removeEventListener('asteria:lock-reveal', onReveal);
  }, [revealLock]);

  useEffect(() => {
    if (locked) revealLock();
    else setLockRevealed(false);
    return () => window.clearTimeout(lockTimer.current);
  }, [locked, revealLock]);

  useEffect(() => {
    setVideoLocked(false);
    return () => setVideoLocked(false);
  }, [setVideoLocked, track?.id]);

  useEffect(() => () => window.clearTimeout(clickTimer.current), []);

  useEffect(() => {
    const onTempSpeed = (event: Event): void => {
      setTempSpeed(Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active));
    };
    window.addEventListener('asteria:temp-speed', onTempSpeed);
    return () => window.removeEventListener('asteria:temp-speed', onTempSpeed);
  }, []);

  useEffect(() => {
    if (fullscreen || isTouch) {
      setToolsHidden(false);
      return;
    }
    showTools();
    return () => window.clearTimeout(toolsTimer.current);
  }, [fullscreen, isTouch, showTools, track?.id]);

  useEffect(() => {
    if (subtitleMenu) showTools();
  }, [showTools, subtitleMenu]);

  const gestures = useVideoGestures({ track, isTouch });
  const hud = gestures.hud;

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

  // Some local/remote videos have no sidecar artwork. Capture one representative
  // frame after data arrives so queue covers, ambience and properties use it.
  useEffect(() => {
    if (!track || track.kind !== 'video' || track.cover) return;
    if (thumbnailAttempts.current.has(track.id)) return;
    const video = player.videoElement;
    if (!video) return;
    thumbnailAttempts.current.add(track.id);

    let cancelled = false;
    let captured = false;
    let seekTimer = 0;
    let fallbackTimer = 0;

    const capture = (): void => {
      if (cancelled || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      try {
        const scale = Math.min(1, 640 / video.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob || cancelled) return;
          captured = true;
          updateTrack(track.id, { cover: URL.createObjectURL(blob) });
        }, 'image/jpeg', 0.72);
      } catch {
        // Cross-origin media can taint the canvas; keep the fallback artwork.
      }
    };

    const captureFromPreview = (target: number): void => {
      if (cancelled || !Number.isFinite(video.duration) || video.duration <= 0) {
        capture();
        return;
      }
      const previous = video.currentTime;
      let done = false;
      const onSeeked = (): void => {
        if (done) return;
        done = true;
        window.clearTimeout(seekTimer);
        video.removeEventListener('seeked', onSeeked);
        capture();
        try { video.currentTime = previous; } catch { /* metadata may still be settling */ }
      };
      video.addEventListener('seeked', onSeeked);
      try {
        video.currentTime = Math.min(target, Math.max(0, video.duration - 0.05));
      } catch {
        video.removeEventListener('seeked', onSeeked);
        capture();
        return;
      }
      seekTimer = window.setTimeout(() => {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', onSeeked);
        capture();
      }, 900);
    };

    const onLoadedData = (): void => {
      if (cancelled) return;
      if (video.currentTime > 0.05) capture();
      else captureFromPreview(Math.min(1, Math.max(0.1, video.duration * 0.1)));
    };

    video.addEventListener('loadeddata', onLoadedData);
    if (video.readyState >= 2) onLoadedData();
    else {
      // loadeddata normally fires once metadata/data arrive; seek as a fallback
      // for servers that only provide a frame after a range request.
      fallbackTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (video.readyState >= 2) capture();
        else if (video.duration > 0.2) captureFromPreview(Math.min(1, video.duration * 0.1));
      }, 1600);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(seekTimer);
      window.clearTimeout(fallbackTimer);
      video.removeEventListener('loadeddata', onLoadedData);
      // StrictMode mounts effects twice in development; allow the second pass
      // to capture when the first pass was cancelled before a frame arrived.
      if (!captured) thumbnailAttempts.current.delete(track.id);
    };
  }, [track?.id, track?.cover, track?.kind, updateTrack]);

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
        className={`video-frame ${toolsHidden && !fullscreen && !isTouch ? 'tools-hidden' : ''} ${colorVision ? 'has-color-vision' : ''}`.trim()}
        data-fit={fullscreen ? videoFit : 'contain'}
        data-mirror={mirror ? 'true' : 'false'}
        style={{ '--video-cover': track.cover ? `url("${track.cover}")` : 'none' } as React.CSSProperties}
        onClick={(event) => {
          if (locked) { revealLock(); return; }
          if (isTouch) return;
          if ((event.target as HTMLElement).closest('button, .video-top-tools')) return;
          window.clearTimeout(clickTimer.current);
          clickTimer.current = window.setTimeout(() => player.toggle(), 250);
        }}
        onDoubleClick={(event) => {
          if (locked) { revealLock(); return; }
          if (isTouch) return;
          if ((event.target as HTMLElement).closest('button, .video-top-tools')) return;
          window.clearTimeout(clickTimer.current);
          onToggleFullscreen();
        }}
        onContextMenu={(event) => { if (isTouch || locked) event.preventDefault(); }}
        onPointerDown={locked ? () => revealLock() : gestures.handlers.onPointerDown}
        onPointerMove={(event) => {
          if (locked) { revealLock(); return; }
          gestures.handlers.onPointerMove(event);
          showTools();
        }}
        onPointerUp={locked ? () => revealLock() : gestures.handlers.onPointerUp}
        onPointerCancel={locked ? () => revealLock() : gestures.handlers.onPointerCancel}
        onPointerLeave={() => {
          if (!locked && !fullscreen && !isTouch && isPlaying && !subtitleMenu) setToolsHidden(true);
        }}
      >
        <div className="video-media" ref={hostRef} />
        <div className="video-backdrop-glow" aria-hidden="true" />
        <div className="video-scrim" aria-hidden="true" />

        <div
          className="video-top-tools"
          onClick={(event) => event.stopPropagation()}
          onPointerEnter={holdTools}
          onPointerMove={(event) => {
            event.stopPropagation();
            holdTools();
          }}
          onPointerLeave={showTools}
        >
          <div className="video-identity">
            <span className="video-badge"><span className="live-dot" /> {t('np.video')}</span>
            <h1><ScrollText text={track.title} /></h1>
            <p>{track.subtitle || track.artist}{track.album ? ` · ${track.album}` : ''}</p>
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
            {/* Kept beside the subtitle/danmaku controls so it is reachable in fullscreen. */}
            <IconButton
              className={`video-lock-button ${lockRevealed ? 'is-revealed' : ''}`.trim()}
              label={locked ? t('video.unlock') : t('video.lock')}
              tooltip={locked ? t('video.unlock') : t('video.lock')}
              active={locked}
              onClick={(event) => {
                event.stopPropagation();
                const next = !locked;
                setVideoLocked(next);
                setLockRevealed(true);
                if (!next) setToolsHidden(false);
              }}
            >
              {locked ? <LockOpen24Regular /> : <LockClosed24Regular />}
            </IconButton>
            <IconButton
              className="video-properties-button"
              label={t('details.videoTitle')}
              tooltip={t('details.videoTitle')}
              onClick={() => setDetailsTrackId(track.id)}
            >
              <Info24Regular />
            </IconButton>
            <IconButton
              label={`${fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}${fullscreenHint}`}
              tooltip={`${fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}${fullscreenHint}`}
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
        {fullscreen ? <FullscreenClock /> : null}

        {hud ? (
          <div className={`gesture-hud is-${hud.kind}`} aria-live="polite">
            {hud.kind === 'seek' ? (
              <>
                <strong>{formatTime(hud.current)}</strong>
                <span>{hud.delta >= 0 ? '+' : ''}{Math.round(hud.delta)}s</span>
              </>
            ) : hud.kind === 'volume' || hud.kind === 'brightness' ? (
              <>
                {hud.kind === 'volume' ? <Speaker224Regular /> : <WeatherSunny24Regular />}
                <span>{Math.round(hud.value * 100)}%</span>
                <span className="gesture-bar" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, (hud.value / (hud.kind === 'volume' ? 1.2 : 1)) * 100)}%` }} />
                </span>
              </>
            ) : hud.kind === 'danmaku' ? (
              <><Chat24Regular /><strong>{t('np.danmaku')}</strong><span>{hud.enabled ? t('common.on') : t('common.off')}</span></>
            ) : hud.kind === 'speed' ? (
              <><strong>{hud.value}×</strong><span>{t('player.playbackRate')}</span></>
            ) : hud.kind === 'play' ? (
              <><Play24Filled /><span>{t('player.play')}</span></>
            ) : (
              <><Pause24Filled /><span>{t('player.pause')}</span></>
            )}
          </div>
        ) : tempSpeed ? (
          <div className="gesture-hud is-speed" aria-live="polite">
            <strong>2×</strong><span>{t('player.tempSpeed')}</span>
          </div>
        ) : null}
      </div>

      <div className="video-meta-card">
        <div className="video-meta-heading">
          <span className="video-badge"><span className="live-dot" /> {t('np.video')}</span>
          <h2>{track.title}</h2>
          <p>{track.subtitle || track.artist}{track.album ? ` · ${track.album}` : ''}</p>
        </div>
        <div className="video-meta-chips">
          {track.format ? <span>{track.format}</span> : null}
          {track.videoWidth && track.videoHeight ? <span>{track.videoWidth} × {track.videoHeight}</span> : null}
          {track.subtitles?.length ? <span>{t('np.subtitles')} · {subtitleLabel}</span> : null}
          {hasDanmaku(track) ? <span>{t('np.danmaku')} · {danmakuEnabled ? t('common.on') : t('common.off')}</span> : null}
        </div>
        <button type="button" className="text-button video-detail-button" onClick={() => setDetailsTrackId(track.id)}>
          <Info24Regular /> {t('details.videoTitle')}
        </button>
      </div>
    </section>
  );
}
