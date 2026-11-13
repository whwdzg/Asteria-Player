import { useCallback, useEffect, useRef, useState } from 'react';
import { useLibraryStore } from '../state/library';
import { usePlaybackStore } from '../state/playback';
import { useSettingsStore } from '../state/settings';

const DISMISS_KEY = 'asteria-performance-hint-dismissed';
const WARMUP_MS = 5_500;
const SAMPLE_MS = 2_800;
const IDLE_MS = 7_000;
const MIN_FPS = 38;

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
      let frames = 0;
      let longFrames = 0;
      let previous = started;

      const tick = (time: number): void => {
        if (disposed) return;
        if (document.hidden) {
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
        if (fps < MIN_FPS || longRatio > 0.3 || dropped / seconds > 8 || hardwareIsWeak()) {
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
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [currentId, enabled, isPlaying]);

  return { open, applyRecommendation, dismiss, dismissPermanently };
}
