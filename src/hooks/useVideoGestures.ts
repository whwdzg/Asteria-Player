import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Track } from '../lib/types';
import { clamp } from '../lib/format';
import { player } from '../player/engine';
import { usePlaybackStore } from '../state/playback';
import { useSettingsStore } from '../state/settings';
import { useUiStore } from '../state/ui';

export type GestureHud =
  | { kind: 'seek'; current: number; delta: number }
  | { kind: 'volume'; value: number }
  | { kind: 'brightness'; value: number }
  | { kind: 'speed'; value: number }
  | { kind: 'play' | 'pause' }
  | null;

interface GestureOptions {
  track: Track | undefined;
  isTouch: boolean;
}

interface GestureHandlers {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
}

interface GestureState {
  startX: number;
  startY: number;
  startTime: number;
  duration: number;
  time: number;
  volume: number;
  brightness: number;
  axis: 'seek' | 'volume' | 'brightness' | null;
  moved: boolean;
  longPress: boolean;
  targetTime: number;
}

export function useVideoGestures({ track, isTouch }: GestureOptions): {
  hud: GestureHud;
  handlers: GestureHandlers;
} {
  const [hud, setHud] = useState<GestureHud>(null);
  const state = useRef<GestureState | null>(null);
  const longPressTimer = useRef(0);
  const singleTapTimer = useRef(0);
  const lastTap = useRef(0);
  const hudTimer = useRef(0);
  const lastSeek = useRef(0);
  const pointerId = useRef<number | null>(null);

  useEffect(() => () => {
    window.clearTimeout(longPressTimer.current);
    window.clearTimeout(singleTapTimer.current);
    window.clearTimeout(hudTimer.current);
    const video = player.videoElement;
    if (video) video.playbackRate = useSettingsStore.getState().playbackRate;
  }, []);

  const flashHud = useCallback((value: GestureHud, duration = 700): void => {
    window.clearTimeout(hudTimer.current);
    setHud(value);
    hudTimer.current = window.setTimeout(() => setHud(null), duration);
  }, []);

  const restoreRate = (): void => {
    const video = player.videoElement;
    if (video) video.playbackRate = useSettingsStore.getState().playbackRate;
  };

  const toggleChrome = (): void => {
    const ui = useUiStore.getState();
    if (ui.chromeVisible) ui.setChromeVisible(false);
    else window.dispatchEvent(new Event('asteria:reveal-chrome'));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isTouch || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, .video-top-tools, .video-meta-card')) return;
    if (pointerId.current !== null) return;
    pointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const media = player.currentElement;
    state.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      duration: media?.duration && Number.isFinite(media.duration) ? media.duration : track?.duration ?? 0,
      time: media?.currentTime ?? 0,
      volume: useSettingsStore.getState().volume,
      brightness: useSettingsStore.getState().brightness,
      axis: null,
      moved: false,
      longPress: false,
      targetTime: 0,
    };
    longPressTimer.current = window.setTimeout(() => {
      if (!state.current || state.current.moved || !usePlaybackStore.getState().isPlaying) return;
      state.current.longPress = true;
      const video = player.videoElement;
      if (video) video.playbackRate = 2;
      flashHud({ kind: 'speed', value: 2 }, 1200);
    }, 480);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const current = state.current;
    if (!current || pointerId.current !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) > 9) {
      current.moved = true;
      window.clearTimeout(longPressTimer.current);
      if (current.longPress) return;
    }
    if (!current.moved) return;

    if (!current.axis) {
      if (Math.abs(dx) > Math.abs(dy) * 1.15) current.axis = 'seek';
      else if (Math.abs(dy) > Math.abs(dx) * 1.15) {
        const ratio = current.startX / Math.max(1, event.currentTarget.clientWidth);
        current.axis = ratio < 0.42 ? 'brightness' : ratio > 0.58 ? 'volume' : null;
      }
    }
    if (!current.axis) return;
    event.preventDefault();

    if (current.axis === 'seek') {
      const frameWidth = Math.max(1, event.currentTarget.clientWidth);
      const span = current.duration || 0;
      const target = clamp(current.time + (dx / frameWidth) * span * 0.65, 0, span);
      current.targetTime = target;
      const now = performance.now();
      if (now - lastSeek.current > 90) {
        lastSeek.current = now;
        player.seek(target);
      }
      flashHud({ kind: 'seek', current: target, delta: target - current.time }, 900);
      return;
    }

    const frameHeight = Math.max(1, event.currentTarget.clientHeight);
    const delta = -dy / frameHeight;
    if (current.axis === 'volume') {
      const next = clamp(current.volume + delta * 1.2, 0, 1.2);
      useSettingsStore.getState().setVolume(next);
      flashHud({ kind: 'volume', value: next }, 900);
    } else {
      const next = clamp(current.brightness + delta, 0, 1);
      useSettingsStore.getState().setBrightness(next);
      flashHud({ kind: 'brightness', value: next }, 900);
    }
  };

  const finish = (event: PointerEvent<HTMLDivElement>): void => {
    const current = state.current;
    if (!current || pointerId.current !== event.pointerId) return;
    window.clearTimeout(longPressTimer.current);
    if (current.axis === 'seek') player.seek(current.targetTime);
    if (current.longPress) restoreRate();
    pointerId.current = null;
    state.current = null;
    if (current.moved) return;

    const now = performance.now();
    if (!current.longPress && now - current.startTime < 520) {
      if (now - lastTap.current < 300) {
        window.clearTimeout(singleTapTimer.current);
        lastTap.current = 0;
        player.toggle();
        flashHud(usePlaybackStore.getState().isPlaying ? { kind: 'pause' } : { kind: 'play' }, 700);
        return;
      }
      lastTap.current = now;
      window.clearTimeout(singleTapTimer.current);
      singleTapTimer.current = window.setTimeout(() => {
        lastTap.current = 0;
        toggleChrome();
      }, 280);
    }
  };

  return {
    hud,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: (event) => {
        window.clearTimeout(longPressTimer.current);
        restoreRate();
        pointerId.current = null;
        state.current = null;
        setHud(null);
        void event;
      },
    },
  };
}
