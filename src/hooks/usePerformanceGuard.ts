import { useCallback, useEffect, useRef, useState } from 'react';
import { useLibraryStore } from '../state/library';
import { usePlaybackStore } from '../state/playback';
import { useSettingsStore } from '../state/settings';
import { player } from '../player/engine';

const DISMISS_KEY = 'asteria-performance-hint-dismissed';
const WARMUP_MS = 5_500;
const SAMPLE_MS = 2_800;
const IDLE_MS = 7_000;
const MIN_FPS = 38;

interface RenderCapacityEvent extends Event {
  averageLoad: number;
  peakLoad: number;
  underrunRatio: number;
}

interface RenderCapacity extends EventTarget {
  start: (options?: { updateInterval?: number }) => void;
  stop: () => void;
}

type AudioContextWithCapacity = AudioContext & { renderCapacity?: RenderCapacity };

function hardwareIsWeak(): boolean {
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores <= 4 || memory <= 4;
}

function storageDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export interface PerformanceGuard {
  open: boolean;
  applyRecommendation: () => void;
  dismiss: () => void;
  dismissPermanently: () => void;
}

/**
 * Samples short render windows instead of keeping a permanent 60 fps monitor.
 * Network buffering is deliberately ignored: only rendering cadence and
 * decoded-video frame drops are considered.
 */
export function usePerformanceGuard(enabled: boolean): PerformanceGuard {
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const currentId = useLibraryStore((state) => state.currentId);
  const [open, setOpen] = useState(false);
  const prompted = useRef(false);
  const sessionDismissed = useRef(false);

  const dismiss = useCallback(() => {
    sessionDismissed.current = true;
    setOpen(false);
  }, []);

  const dismissPermanently = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore blocked storage.
    }
    sessionDismissed.current = true;
    setOpen(false);
  }, []);

  const applyRecommendation = useCallback(() => {
    useSettingsStore.getState().patch({
      liquidGlass: false,
      dynamicBackground: false,
      backgroundBpm: false,
      backgroundVideo: false,
      audioVisualizer: false,
      lyricBlur: false,
    });
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!isPlaying || !enabled || prompted.current || sessionDismissed.current || storageDismissed()) return;
    let disposed = false;
    let timer = 0;
    let raf = 0;
    let stopProbe = (): void => {};
    const video = document.querySelector('video') as HTMLVideoElement | null;

    const schedule = (delay: number): void => {
      if (disposed) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(sample, delay);
    };

    const sample = (): void => {
      if (disposed || prompted.current || sessionDismissed.current) return;
      if (document.hidden) {
        schedule(2_000);
        return;
      }
      const started = performance.now();
      const baseDropped = video?.getVideoPlaybackQuality?.().droppedVideoFrames ?? 0;
      const media = player.currentElement;
      const audioStart = media?.currentTime ?? 0;
      let buffering = false;
      let underrun = 0;
      let averageLoad = 0;
      const onBuffer = (): void => { buffering = true; };
      media?.addEventListener('waiting', onBuffer);
      media?.addEventListener('stalled', onBuffer);
      media?.addEventListener('seeking', onBuffer);
      const context = player.analyserNode?.context as AudioContextWithCapacity | undefined;
      let capacity: RenderCapacity | undefined;
      const onCapacity = (event: Event): void => {
        const update = event as RenderCapacityEvent;
        underrun = Math.max(underrun, update.underrunRatio ?? 0);
        averageLoad = Math.max(averageLoad, update.averageLoad ?? 0);
      };
      if (context?.renderCapacity) {
        capacity = context.renderCapacity;
        capacity.addEventListener('update', onCapacity);
        try {
          capacity.start({ updateInterval: 0.25 });
        } catch {
          capacity.removeEventListener('update', onCapacity);
          capacity = undefined;
        }
      }
      const stop = (): void => {
        media?.removeEventListener('waiting', onBuffer);
        media?.removeEventListener('stalled', onBuffer);
        media?.removeEventListener('seeking', onBuffer);
        if (capacity) {
          capacity.stop?.();
          capacity.removeEventListener('update', onCapacity);
        }
      };
      stopProbe = stop;
      let frames = 0;
      let longFrames = 0;
      let previous = started;

      const tick = (time: number): void => {
        if (disposed) return;
        if (document.hidden) {
          stopProbe();
          schedule(2_000);
          return;
        }
        frames += 1;
        if (time - previous > 42) longFrames += 1;
        previous = time;
        const elapsed = time - started;
        if (elapsed < SAMPLE_MS) {
          raf = requestAnimationFrame(tick);
          return;
        }

        const dropped = (video?.getVideoPlaybackQuality?.().droppedVideoFrames ?? baseDropped) - baseDropped;
        const seconds = Math.max(1, elapsed / 1000);
        const fps = (frames * 1000) / seconds;
        const longRatio = frames > 0 ? longFrames / frames : 0;
        const isAudio = media instanceof HTMLAudioElement;
        const progressed = media ? media.currentTime - audioStart : 0;
        const expected = seconds * (media?.playbackRate ?? 1);
        const audioStalled = Boolean(
          isAudio
          && media
          && !buffering
          && !media.paused
          && !media.seeking
          && media.readyState >= 3
          && progressed < expected * 0.55,
        );
        const audioContextIssue = Boolean(context && context.state !== 'running');
        const renderIssue = !buffering && (underrun > 0.01 || averageLoad > 0.92);
        stopProbe();
        if (fps < MIN_FPS || longRatio > 0.3 || dropped / seconds > 8 || audioStalled || audioContextIssue || renderIssue || hardwareIsWeak()) {
          prompted.current = true;
          setOpen(true);
          return;
        }
        schedule(IDLE_MS);
      };

      raf = requestAnimationFrame(tick);
    };

    schedule(WARMUP_MS);
    return () => {
      disposed = true;
      stopProbe();
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [currentId, enabled, isPlaying]);

  return { open, applyRecommendation, dismiss, dismissPermanently };
}
