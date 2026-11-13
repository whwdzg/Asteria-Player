/**
 * Application shell: library bootstrapping, ambient background, responsive
 * layout and global chrome/gesture coordination.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownload24Regular, ArrowImport24Regular, FolderOpen24Regular, Link24Regular } from '@fluentui/react-icons';
import './styles/index.css';
import type { Track } from './lib/types';
import { BottomBar } from './components/chrome/BottomBar';
import { CollapsedBarButton } from './components/chrome/CollapsedBarButton';
import { TooltipLayer } from './components/common/TooltipLayer';
import { NowPlaying } from './components/nowplaying/NowPlaying';
import { MobilePlayer } from './components/mobile/MobilePlayer';
import { VideoStage } from './components/video/VideoStage';
import { Toasts } from './components/overlays/Toasts';
import { WelcomeDialog } from './components/overlays/WelcomeDialog';
import { ScanMediaDialog } from './components/overlays/ScanMediaDialog';
import { ScanMediaPrompt } from './components/overlays/ScanMediaPrompt';
import { PerformanceDialog } from './components/overlays/PerformanceDialog';

import { useAppearance } from './hooks/useTheme';
import { useFullscreen } from './hooks/useFullscreen';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutoHideChrome } from './hooks/useAutoHideChrome';
import { useTouchDevice } from './hooks/useTouchDevice';
import { usePerformanceGuard } from './hooks/usePerformanceGuard';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useOrientationFullscreen } from './hooks/useOrientationFullscreen';
import { useI18n } from './i18n/I18nProvider';
import { loadDemoLibrary } from './lib/demo';
import { getDemoPreference, hasUsedApp, markAppUsed, setDemoPreference } from './lib/demoPreference';
import { findUnreadableTracks } from './lib/mediaIntegrity';
import { isPwaStandalone, restorePwaLibrary, startPwaLibraryPersistence } from './lib/pwaLibrary';
import { coverThemeColor, NEUTRAL_PLAYER_ACCENT } from './lib/coverTheme';
import { clamp } from './lib/format';
import { collectDroppedFiles } from './lib/mediaFiles';
import { player } from './player/engine';
import { useImporter } from './player/ImportProvider';
import { useLibraryStore } from './state/library';
import { usePlaybackStore } from './state/playback';
import { useSleepTimerStore } from './state/sleepTimer';
import { useSettingsStore } from './state/settings';
import { useUiStore } from './state/ui';

const LazyQueuePanel = lazy(() => import('./components/queue/QueuePanel').then((module) => ({ default: module.QueuePanel })));
const LazyDetailsDialog = lazy(() => import('./components/overlays/DetailsDialog').then((module) => ({ default: module.DetailsDialog })));
const LazyPlaylistDialog = lazy(() => import('./components/overlays/PlaylistDialog').then((module) => ({ default: module.PlaylistDialog })));
const LazyCollectionPage = lazy(() => import('./components/overlays/CollectionPage').then((module) => ({ default: module.CollectionPage })));

function AmbientBackdrop({ track, accent }: { track?: Track; accent: string }): React.ReactElement {
  const dynamic = useSettingsStore((state) => state.dynamicBackground);
  const followVideo = useSettingsStore((state) => state.backgroundVideo);
  const bpmMotion = useSettingsStore((state) => state.backgroundBpm);
  const videoLayer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = videoLayer.current;
    if (!layer) return;
    layer.classList.remove('is-live');
    layer.style.backgroundImage = '';
    if (!dynamic || !followVideo || track?.kind !== 'video') return;

    const video = player.videoElement;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 45;
    const context = canvas.getContext('2d');
    if (!context) return;

    let disposed = false;
    const update = (): void => {
      if (disposed || document.hidden || video.readyState < 2 || !video.videoWidth) return;
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.55);
        layer.style.backgroundImage = `url(${frame})`;
        layer.classList.add('is-live');
      } catch {
        // Cross-origin frames taint the canvas; keep the static thumbnail.
      }
    };
    update();
    const timer = window.setInterval(update, 1100);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      layer.classList.remove('is-live');
      layer.style.backgroundImage = '';
    };
  }, [dynamic, followVideo, track?.id, track?.kind]);

  const beat = 60 / (track?.bpm ?? 92);
  const breathe = dynamic && bpmMotion ? `${clamp(beat * 24, 11, 20)}s` : '16s';
  const driftA = dynamic && bpmMotion ? `${clamp(beat * 44, 22, 38)}s` : '30s';
  const driftB = dynamic && bpmMotion ? `${clamp(beat * 54, 28, 46)}s` : '36s';

  return (
    <div
      className="ambient"
      aria-hidden="true"
      style={{
        '--ambient-accent': accent,
        '--ambient-breathe': breathe,
        '--ambient-drift-a': driftA,
        '--ambient-drift-b': driftB,
      } as React.CSSProperties}
    >
      {track?.cover ? <div className="ambient-cover" style={{ backgroundImage: `url("${track.cover}")` }} /> : null}
      <div className="ambient-video" ref={videoLayer} />
      <div className="ambient-orb orb-a" />
      <div className="ambient-orb orb-b" />
      <div className="ambient-grid" />
      <div className="ambient-grain" />
    </div>
  );
}

function AppHeader(): React.ReactElement {
  const { t } = useI18n();
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><img src="icons/icon-192.png" alt="" /></span>
        <div className="brand-copy">
          <span className="brand-name">{t('app.name')}</span>
          <span className="brand-tagline">{t('app.tagline')}</span>
        </div>
      </div>
    </header>
  );
}

function StageSkeleton(): React.ReactElement {
  return (
    <div className="stage-skeleton" aria-hidden="true">
      <div className="skeleton-art" />
      <div className="skeleton-lyrics">
        <span style={{ width: '38%' }} />
        <span style={{ width: '72%' }} />
        <span style={{ width: '60%' }} />
        <span style={{ width: '80%' }} />
        <span style={{ width: '52%' }} />
      </div>
    </div>
  );
}

function EmptyStage(): React.ReactElement {
  const { t } = useI18n();
  const { openFiles, openFolder, openUrl } = useImporter();
  return (
    <section className="empty-stage">
      <div className="empty-orb" aria-hidden="true">
        <span className="empty-orbit" />
        <img className="empty-mark" src="icons/icon-192.png" alt="" aria-hidden="true" />
      </div>
      <h1>{t('empty.title')}</h1>
      <p>{t('empty.hint')}</p>
      <div className="empty-actions">
        <button type="button" className="fluent-button primary" onClick={openFiles}>
          <ArrowImport24Regular /> {t('menu.importFiles')}
        </button>
        <button type="button" className="fluent-button" onClick={openFolder}>
          <FolderOpen24Regular /> {t('menu.importFolder')}
        </button>
        <button type="button" className="fluent-button" onClick={openUrl}>
          <Link24Regular /> {t('menu.importUrl')}
        </button>
      </div>
      <div className="empty-formats">
        <span>MP3</span><span>FLAC</span><span>WAV</span><span>M4A</span><span>MP4</span><span>WEBM</span>
        <span>LRC</span><span>SPL</span><span>SRT</span><span>VTT</span><span>ASS</span><span>XML</span>
      </div>
    </section>
  );
}

function DropOverlay(): React.ReactElement | null {
  const active = useUiStore((state) => state.dragActive);
  const { t } = useI18n();
  if (!active) return null;
  return (
    <div className="drop-overlay">
      <div className="drop-card">
        <span className="drop-icon"><ArrowDownload24Regular /></span>
        <h2>{t('drop.title')}</h2>
        <p>{t('drop.hint')}</p>
      </div>
    </div>
  );
}

export default function App(): React.ReactElement {
  useAppearance();
  const { t } = useI18n();
  const appRef = useRef<HTMLDivElement>(null);
  const { fullscreen, toggleFullscreen, exitFullscreen } = useFullscreen(appRef);
  const { importFiles, openFiles, openFolder, openUrl } = useImporter();
  const current = useLibraryStore((state) => state.tracks.find((item) => item.id === state.currentId));
  const tracks = useLibraryStore((state) => state.tracks);
  const loaded = useLibraryStore((state) => state.loaded);
  const queueView = useUiStore((state) => state.queueView);
  const detailsTrackId = useUiStore((state) => state.detailsTrackId);
  const playlistDialogOpen = useUiStore((state) => state.playlistDialogOpen);
  const collectionView = useUiStore((state) => state.collectionView);
  const chromeVisible = useUiStore((state) => state.chromeVisible);
  const videoLocked = useUiStore((state) => state.videoLocked);
  const brightness = useSettingsStore((state) => state.brightness);
  const dynamicBackground = useSettingsStore((state) => state.dynamicBackground);
  const performanceEffectsOn = useSettingsStore((state) =>
    state.liquidGlass
    || state.dynamicBackground
    || state.backgroundBpm
    || state.backgroundVideo
    || state.audioVisualizer
    || state.lyricBlur);
  const performanceGuard = usePerformanceGuard(performanceEffectsOn);
  const playbackError = usePlaybackStore((state) => state.error);
  const setError = usePlaybackStore((state) => state.setError);
  const [bootError, setBootError] = useState(false);
  const [playerAccent, setPlayerAccent] = useState(NEUTRAL_PLAYER_ACCENT);
  const sleepEnabled = useSleepTimerStore((state) => state.enabled);
  const sleepMode = useSleepTimerStore((state) => state.mode);
  const sleepEndsAt = useSleepTimerStore((state) => state.endsAt);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomePwaHint, setWelcomePwaHint] = useState(false);
  const [bootReady, setBootReady] = useState(false);
  const barCollapsed = useUiStore((state) => state.barCollapsed);
  const bootStarted = useRef(false);
  const dragCounter = useRef(0);

  const loadDemoContent = useCallback(() => {
    let cancelled = false;
    loadDemoLibrary()
      .then((demoTracks) => {
        // If the user starts an import while the demo request is in flight,
        // keep the real content and never merge demo items back in.
        if (cancelled || getDemoPreference() !== 'demo') return;
        useLibraryStore.getState().setDemoTracks(demoTracks);
        player.initialize();
        player.ensureCurrent();
      })
      .catch((error: unknown) => {
        console.error(error);
        if (cancelled) return;
        useLibraryStore.getState().setLoaded(true);
        setBootError(true);
        player.initialize();
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (bootStarted.current) return;
    bootStarted.current = true;

    const boot = async (): Promise<void> => {
      // Installed PWA sessions restore the real playlist before any onboarding.
      if (isPwaStandalone()) {
        const restored = await restorePwaLibrary();
        if (restored?.tracks.length) {
          const library = useLibraryStore.getState();
          library.setDemoTracks(restored.tracks);
          const known = new Set(restored.tracks.map((track) => track.id));
          if (restored.session) {
            const queue = restored.session.queue.filter((id) => known.has(id));
            if (queue.length) library.setQueue(queue, restored.session.sequenceId);
            const current = restored.session.currentId && known.has(restored.session.currentId)
              ? restored.session.currentId
              : null;
            library.setCurrent(current);
          }
          player.initialize();
          const state = useLibraryStore.getState();
          const current = state.tracks.find((track) => track.id === state.currentId);
          if (current) {
            player.load(current, {
              autoplay: false,
              position: current.id === useSettingsStore.getState().lastTrackId
                ? useSettingsStore.getState().lastPosition
                : 0,
            });
          } else {
            player.ensureCurrent();
          }
          setBootReady(true);
          window.setTimeout(() => {
            void findUnreadableTracks(restored.tracks, { timeout: 3000, concurrency: 2 })
              .then((invalid) => {
                if (invalid.length) useUiStore.getState().promptScanMedia(invalid.length);
              })
              .catch(() => {});
          }, 1200);
          return;
        }
      }

      if (isPwaStandalone()) {
        const preference = getDemoPreference();
        if (preference === 'demo') {
          loadDemoContent();
          setBootReady(true);
          return;
        }
        useLibraryStore.getState().setLoaded(true);
        player.initialize();
        setWelcomeOpen(true);
        setBootReady(true);
        return;
      }

      // A normal browser tab never persists imported media across reloads.
      // Ask again on every refresh; returning visitors also get the PWA hint.
      setWelcomePwaHint(hasUsedApp());
      useLibraryStore.getState().setLoaded(true);
      player.initialize();
      setWelcomeOpen(true);
      setBootReady(true);
    };

    void boot();
  }, [loadDemoContent]);

  useEffect(() => {
    if (!bootReady) return;
    return startPwaLibraryPersistence();
  }, [bootReady]);

  const useDemoContent = useCallback(() => {
    markAppUsed();
    setDemoPreference('demo');
    setWelcomeOpen(false);
    loadDemoContent();
  }, [loadDemoContent]);

  useEffect(() => {
    if (!sleepEnabled || sleepMode !== 'duration' || !sleepEndsAt) return;
    let timer = 0;
    const check = (): void => {
      window.clearTimeout(timer);
      if (!useSleepTimerStore.getState().enabled) return;
      const remaining = sleepEndsAt - Date.now();
      if (remaining <= 0) {
        player.pause();
        useSleepTimerStore.getState().finish();
        useUiStore.getState().pushToast(t('sleep.finished'));
        return;
      }
      timer = window.setTimeout(check, Math.min(remaining, 60_000));
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [sleepEnabled, sleepEndsAt, sleepMode, t]);

  useEffect(() => {
    if (!bootError) return;
    useUiStore.getState().pushToast(t('toast.error'), 'error');
  }, [bootError, t]);

  useEffect(() => {
    if (!playbackError) return;
    useUiStore.getState().pushToast(playbackError === 'blocked' ? t('toast.playBlocked') : t('toast.error'), 'error');
    setError(null);
  }, [playbackError, setError, t]);

  useEffect(() => {
    let cancelled = false;
    if (!current) {
      setPlayerAccent(NEUTRAL_PLAYER_ACCENT);
      return () => { cancelled = true; };
    }
    void coverThemeColor(current).then((accent) => {
      if (!cancelled) setPlayerAccent(accent);
    });
    return () => { cancelled = true; };
  }, [current?.id, current?.cover]);

  useEffect(() => {
    document.documentElement.style.setProperty('--track-accent', playerAccent);
    document.documentElement.style.setProperty('--media-brightness', String(brightness));
  }, [playerAccent, brightness]);

  const isVideo = current?.kind === 'video';
  const isTouch = useTouchDevice();
  const isMobileViewport = useMediaQuery('(max-width: 700px)');
  const useMobilePlayer = isTouch && isMobileViewport && !isVideo && !fullscreen;

  useEffect(() => {
    // Selecting a video returns to its main surface instead of leaving the
    // queue or settings sheet on top of the new item.
    if (isTouch && isMobileViewport && isVideo) useUiStore.getState().closeOverlays();
  }, [current?.id, isMobileViewport, isTouch, isVideo]);
  useAutoHideChrome(fullscreen, Boolean(isVideo), isTouch);
  useOrientationFullscreen(Boolean(isVideo), exitFullscreen);
  useKeyboardShortcuts({ toggleFullscreen, exitFullscreen, isVideo: Boolean(isVideo) });

  useEffect(() => {
    const hasFiles = (event: DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const onDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragCounter.current += 1;
      useUiStore.getState().setDragActive(true);
    };
    const onDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) useUiStore.getState().setDragActive(false);
    };
    const onDrop = (event: DragEvent): void => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragCounter.current = 0;
      useUiStore.getState().setDragActive(false);
      if (!event.dataTransfer) return;
      void collectDroppedFiles(event.dataTransfer).then((files) => importFiles(files));
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [importFiles]);

  useEffect(() => {
    document.body.classList.toggle('is-fullscreen', fullscreen);
    return () => document.body.classList.remove('is-fullscreen');
  }, [fullscreen]);

  const rootClasses = [
    'app',
    fullscreen ? 'is-fullscreen' : '',
    fullscreen && isVideo ? 'is-video-fullscreen' : '',
    chromeVisible ? 'chrome-visible' : 'chrome-hidden',
    isVideo ? 'is-video-mode' : 'is-audio-mode',
    queueView === 'full' ? 'queue-is-full' : '',
    queueView !== 'closed' ? 'queue-is-open' : '',
    dynamicBackground ? 'has-dynamic-bg' : 'is-static-bg',
    isTouch ? 'is-touch' : 'is-desktop',
    useMobilePlayer ? 'is-mobile-player' : '',
    collectionView ? 'is-collection-open' : '',
    barCollapsed ? 'is-bar-collapsed' : '',
    videoLocked && isVideo ? 'is-video-locked' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={appRef} className={rootClasses} data-kind={isVideo ? 'video' : 'audio'}>
      <AmbientBackdrop track={current} accent={playerAccent} />
      <AppHeader />
      <main className="app-main">
        {!loaded ? <StageSkeleton /> : !tracks.length ? <EmptyStage /> : current?.kind === 'video' ? (
          <VideoStage onToggleFullscreen={toggleFullscreen} />
        ) : useMobilePlayer ? (
          <MobilePlayer onToggleFullscreen={toggleFullscreen} />
        ) : (
          <NowPlaying />
        )}
      </main>

      <BottomBar onToggleFullscreen={toggleFullscreen} />
      <CollapsedBarButton />
      <ScanMediaDialog />
      <ScanMediaPrompt />
      <PerformanceDialog
        open={performanceGuard.open}
        onClose={performanceGuard.dismiss}
        onDismissPermanently={performanceGuard.dismissPermanently}
        onApply={() => {
          performanceGuard.applyRecommendation();
          useUiStore.getState().pushToast(t('performance.disabled'));
        }}
      />
      {welcomeOpen ? (
        <WelcomeDialog
          showPwaHint={welcomePwaHint}
          onOpenFiles={() => { markAppUsed(); setWelcomeOpen(false); openFiles(); }}
          onOpenFolder={() => { markAppUsed(); setWelcomeOpen(false); openFolder(); }}
          onOpenUrl={() => { markAppUsed(); setWelcomeOpen(false); openUrl(); }}
          onUseDemo={useDemoContent}
        />
      ) : null}
      {collectionView ? (
        <Suspense fallback={null}>
          <LazyCollectionPage />
        </Suspense>
      ) : null}

      {queueView !== 'closed' ? (
        <Suspense fallback={null}>
          <LazyQueuePanel variant={queueView === 'full' ? 'full' : 'sidebar'} />
        </Suspense>
      ) : null}

      <Toasts />
      {detailsTrackId ? (
        <Suspense fallback={null}>
          <LazyDetailsDialog />
        </Suspense>
      ) : null}
      {playlistDialogOpen ? (
        <Suspense fallback={null}>
          <LazyPlaylistDialog />
        </Suspense>
      ) : null}
      <DropOverlay />
      <TooltipLayer />
    </div>
  );
}
