import { useCallback, useEffect, useRef, useState } from 'react';
import { useLibraryStore } from '../state/library';
import { usePlaybackStore } from '../state/playback';
import { useSettingsStore } from '../state/settings';

const DISMISS_KEY = 'asteria-performance-hint-dismissed';
const WARMUP_MS = 5_500;
const SAMPLE_MS = 2_800;
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
  recommend: () => void;
  applyRecommendation: () => void;
  dismiss: () => void;
  dismissPermanently: () => void;
}

/**
 * Detects sustained low frame rate or video decode drops while media is
 * playing. Network buffering is deliberately ignored: only rendering cadence
 * (requestAnimationFrame) and decoded-frame drops are sampled.
 */
export function usePerformanceGuard(enabled: boolean): PerformanceGuard {
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const currentId = useLibraryStore((state) => state.currentId);
  const [open, setOpen] = useState(false);
  const prompted = useRef(false);
  const sessionDismissed = useRef(false);

  const recommend = useCallback(() => {
    if (prompted.current || sessionDismissed.current || storageDismissed()) return;
    prompted.current = true;
    setOpen(true);
  }, []);

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
    let raf = 0;
    let started = performance.now();
    let warmupUntil = started + WARMUP_MS;
    let measuring = false;
    let frames = 0;
    let longFrames = 0;
    let previous = started;
    let videoDropped = 0;
    let baseDropped: number | null = null;
    let sampleStart = performance.now();
    const video = document.querySelector('video') as HTMLVideoElement | null;

    const tick = (time: number): void => {
      if (document.hidden) {
        started = time;
        warmupUntil = time + WARMUP_MS;
        measuring = false;
        frames = 0;
        longFrames = 0;
        previous = time;
        raf = requestAnimationFrame(tick);
        return;
      }

      frames += 1;
      if (time - previous > 42) longFrames += 1;
      previous = time;

      if (video) {
        const quality = video.getVideoPlaybackQuality?.();
        if (quality) {
          if (baseDropped === null) baseDropped = quality.droppedVideoFrames;
          videoDropped = quality.droppedVideoFrames - baseDropped;
        }
      }

      if (!measuring && time >= warmupUntil) {
        measuring = true;
        warmupUntil = time + SAMPLE_MS;
        started = time;
        sampleStart = time;
        frames = 0;
        longFrames = 0;
        videoDropped = 0;
        baseDropped = null;
        raf = requestAnimationFrame(tick);
        return;
      }

      if (measuring && time >= warmupUntil) {
        const elapsed = time - started;
        const fps = frames > 0 ? (frames * 1000) / Math.max(1, elapsed) : 60;
        const longRatio = frames > 0 ? longFrames / frames : 0;
        const droppedPerSecond = videoDropped / Math.max(1, (time - sampleStart) / 1000);
        const weak = hardwareIsWeak();
        if (fps < MIN_FPS || longRatio > 0.3 || droppedPerSecond > 8 || weak) {
          recommend();
          return;
        }
        frames = 0;
        longFrames = 0;
        measuring = false;
        started = time;
        warmupUntil = time + 6_000;
        sampleStart = time;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentId, enabled, isPlaying, recommend]);

  return { open, recommend, applyRecommendation, dismiss, dismissPermanently };
}
