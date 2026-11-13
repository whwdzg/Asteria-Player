import type { Track } from '../lib/types';
import { clamp } from '../lib/format';
import { useClockStore } from '../state/clock';
import { ALL_SEQUENCE, useLibraryStore } from '../state/library';
import { usePlaybackStore } from '../state/playback';
import { useSettingsStore, EQ_FREQUENCIES } from '../state/settings';
import { revokeTrackUrls } from '../lib/mediaFiles';
import { useSleepTimerStore } from '../state/sleepTimer';

const SEEK_STEP = 10;

/**
 * Owns the two media elements and the Web Audio graph. UI code only calls the
 * public methods; all playback state is broadcast through narrow Zustand stores
 * so 20 Hz time updates never re-render the whole application.
 */
export class PlayerEngine {
  private audio: HTMLAudioElement | null = null;
  private video: HTMLVideoElement | null = null;
  private active: HTMLMediaElement | null = null;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private sources = new WeakSet<HTMLMediaElement>();
  private initialized = false;
  private raf = 0;
  private lastFrame = 0;
  private loadedTrackId: string | null = null;
  private settingsUnsubscribe: (() => void) | null = null;
  private mediaSessionReady = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('aria-hidden', 'true');
    this.audio = audio;

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.className = 'player-video';
    this.video = video;

    this.bind(audio);
    this.bind(video);
    this.applyVolume();
    this.applyEq();
    this.settingsUnsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (state.volume !== previous.volume || state.muted !== previous.muted) this.applyVolume();
      if (state.eqEnabled !== previous.eqEnabled || state.eqGains !== previous.eqGains) this.applyEq();
      if (state.playbackRate !== previous.playbackRate) this.applyPlaybackRate();
    });
    this.setupMediaSession();

    const track = this.currentTrack();
    if (track) this.load(track, { autoplay: false, position: useSettingsStore.getState().lastPosition });
  }

  get videoElement(): HTMLVideoElement | null {
    this.initialize();
    return this.video;
  }

  get currentElement(): HTMLMediaElement | null {
    return this.active;
  }

  /** Frequency data source for the audio visualizer; null until playback starts. */
  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  private bind(element: HTMLMediaElement): void {
    const onPlay = () => {
      if (this.active !== element) return;
      usePlaybackStore.getState().setPlaying(true);
      usePlaybackStore.getState().setLoading(false);
      usePlaybackStore.getState().setError(null);
      this.startClock();
      this.updateMediaSessionState();
    };
    const onPause = () => {
      if (this.active !== element) return;
      usePlaybackStore.getState().setPlaying(false);
      this.stopClock();
      this.syncClock(true);
      this.updateMediaSessionState();
      const time = element.currentTime;
      if (time > 0) useSettingsStore.getState().setLastPosition(time);
    };
    element.addEventListener('playing', onPlay);
    element.addEventListener('pause', onPause);
    element.addEventListener('waiting', () => {
      if (this.active === element) usePlaybackStore.getState().setLoading(true);
    });
    element.addEventListener('canplay', () => {
      if (this.active === element) usePlaybackStore.getState().setLoading(false);
    });
    element.addEventListener('loadedmetadata', () => {
      if (this.active !== element) return;
      if (Number.isFinite(element.duration) && element.duration > 0) {
        useClockStore.getState().setDuration(element.duration);
        const id = useLibraryStore.getState().currentId;
        if (id) useLibraryStore.getState().updateTrackDuration(id, element.duration);
        this.updateMediaSessionPosition();
      }
      usePlaybackStore.getState().setLoading(false);
    });
    element.addEventListener('durationchange', () => {
      if (this.active !== element) return;
      if (Number.isFinite(element.duration) && element.duration > 0) {
        useClockStore.getState().setDuration(element.duration);
      }
    });
    element.addEventListener('progress', () => {
      if (this.active === element) this.syncBuffered();
    });
    element.addEventListener('timeupdate', () => {
      if (this.active === element) this.syncClock();
    });
    element.addEventListener('seeked', () => {
      if (this.active === element) this.syncClock(true);
    });
    element.addEventListener('ended', () => {
      if (this.active === element) this.handleEnded();
    });
    element.addEventListener('error', () => {
      if (this.active !== element) return;
      usePlaybackStore.getState().setLoading(false);
      usePlaybackStore.getState().setPlaying(false);
      usePlaybackStore.getState().setError('media');
    });
  }

  private currentTrack(): Track | undefined {
    const { tracks, currentId } = useLibraryStore.getState();
    return tracks.find((track) => track.id === currentId);
  }

  private elementFor(track: Track): HTMLMediaElement | null {
    return track.kind === 'video' ? this.video : this.audio;
  }

  private ensureGraph(element: HTMLMediaElement): void {
    if (!this.context) {
      try {
        const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        this.context = new AudioContextCtor();
        this.filters = EQ_FREQUENCIES.map((frequency) => {
          const filter = this.context!.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = frequency;
          filter.Q.value = 0.9;
          filter.gain.value = 0;
          return filter;
        });
        this.gain = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.82;
        this.compressor.threshold.value = -3;
        this.compressor.knee.value = 8;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        for (let i = 0; i < this.filters.length - 1; i += 1) {
          this.filters[i].connect(this.filters[i + 1]);
        }
        this.filters[this.filters.length - 1].connect(this.gain);
        this.gain.connect(this.compressor);
        this.compressor.connect(this.analyser);
        this.analyser.connect(this.context.destination);
        this.applyVolume();
        this.applyEq();
      } catch {
        this.context = null;
        this.gain = null;
        return;
      }
    }
    if (!this.context || !this.filters.length) return;
    if (!this.sources.has(element)) {
      try {
        const source = this.context.createMediaElementSource(element);
        source.connect(this.filters[0]);
        this.sources.add(element);
        element.volume = 1;
        element.muted = false;
      } catch {
        // CORS-restricted streams cannot be routed through Web Audio; fall
        // back to the element's own volume (capped at 100%).
      }
    }
    if (this.context.state === 'suspended') void this.context.resume();
    this.applyVolume();
  }

  private applyVolume(): void {
    const { volume, muted } = useSettingsStore.getState();
    if (this.gain && this.context) {
      this.gain.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, 0.012);
    }
    for (const element of [this.audio, this.video]) {
      if (!element) continue;
      if (this.gain) {
        element.volume = 1;
        element.muted = false;
      } else {
        element.volume = clamp(volume, 0, 1);
        element.muted = muted;
      }
    }
  }

  private applyEq(): void {
    const { eqEnabled, eqGains } = useSettingsStore.getState();
    this.filters.forEach((filter, index) => {
      filter.gain.value = eqEnabled ? eqGains[index] ?? 0 : 0;
    });
  }

  private applyPlaybackRate(): void {
    const { playbackRate } = useSettingsStore.getState();
    if (this.audio) this.audio.playbackRate = playbackRate;
    if (this.video) this.video.playbackRate = playbackRate;
  }

  load(track: Track, options: { autoplay?: boolean; position?: number } = {}): void {
    this.initialize();
    const element = this.elementFor(track);
    if (!element) return;

    if (this.active && this.active !== element) {
      this.active.pause();
      this.active.removeAttribute('src');
      this.active.load();
    }

    if (this.loadedTrackId !== track.id) {
      this.loadedTrackId = track.id;
      element.src = track.src;
      element.load();
    }
    this.active = element;
    element.playbackRate = useSettingsStore.getState().playbackRate;
    useLibraryStore.getState().setCurrent(track.id);
    useSettingsStore.getState().setLastTrack(track.id);
    usePlaybackStore.getState().setError(null);
    usePlaybackStore.getState().setLoading(true);
    useClockStore.getState().reset();
    useClockStore.getState().setDuration(track.duration || 0);
    this.setupMediaMetadata(track);

    const position = Math.max(0, options.position ?? 0);
    if (position > 0) {
      const applyPosition = (): void => {
        try {
          element.currentTime = Math.min(position, Number.isFinite(element.duration) ? Math.max(0, element.duration - 0.2) : position);
        } catch {
          // Metadata may not be ready yet.
        }
        this.syncClock(true);
      };
      if (element.readyState >= 1) applyPosition();
      else element.addEventListener('loadedmetadata', applyPosition, { once: true });
    }

    if (options.autoplay) this.play();
  }

  play(): void {
    this.initialize();
    const track = this.currentTrack();
    if (!track) {
      const first = useLibraryStore.getState().tracks[0];
      if (!first) return;
      this.load(first, { autoplay: true });
      return;
    }
    if (!this.active || this.loadedTrackId !== track.id) {
      this.load(track, { autoplay: true });
      return;
    }
    this.ensureGraph(this.active);
    const element = this.active;
    const promise = element.play();
    if (promise) {
      promise.catch((error: DOMException) => {
        if (error?.name === 'AbortError') return;
        usePlaybackStore.getState().setPlaying(false);
        usePlaybackStore.getState().setLoading(false);
        if (error?.name === 'NotAllowedError') usePlaybackStore.getState().setError('blocked');
        else usePlaybackStore.getState().setError('media');
      });
    }
  }

  pause(): void {
    this.active?.pause();
  }

  toggle(): void {
    if (usePlaybackStore.getState().isPlaying) this.pause();
    else this.play();
  }

  setPlaybackRate(rate: number): void {
    useSettingsStore.getState().setPlaybackRate(rate);
    this.applyPlaybackRate();
  }

  playPause(): void {
    this.toggle();
  }

  seek(time: number): void {
    const element = this.active;
    if (!element) return;
    const duration = useClockStore.getState().duration || element.duration || 0;
    const next = clamp(time, 0, duration > 0 ? duration : time);
    try {
      element.currentTime = next;
    } catch {
      return;
    }
    useClockStore.getState().setClock(next);
    this.updateMediaSessionPosition();
  }

  seekBy(delta: number): void {
    const current = this.active?.currentTime ?? useClockStore.getState().time;
    this.seek(current + delta);
  }

  rewind(): void {
    this.seekBy(-SEEK_STEP);
  }

  forward(): void {
    this.seekBy(SEEK_STEP);
  }

  previous(): void {
    const element = this.active;
    if (element && element.currentTime > 3) {
      this.seek(0);
      return;
    }
    this.step(-1, false);
  }

  next(): void {
    this.step(1, false);
  }

  private step(direction: 1 | -1, fromEnded: boolean): void {
    const library = useLibraryStore.getState();
    const queue = library.queue.length ? library.queue : library.tracks.map((track) => track.id);
    const currentId = library.currentId;
    if (!queue.length) return;
    const mode = useSettingsStore.getState().playMode;
    const index = currentId ? queue.indexOf(currentId) : -1;

    if (fromEnded && mode === 'one') {
      this.seek(0);
      this.play();
      return;
    }

    let nextId: string | undefined;
    if (mode === 'shuffle') {
      if (queue.length === 1) nextId = queue[0];
      else {
        let candidate = queue[Math.floor(Math.random() * queue.length)];
        let attempts = 0;
        while (candidate === currentId && attempts < 8) {
          candidate = queue[Math.floor(Math.random() * queue.length)];
          attempts += 1;
        }
        nextId = candidate;
      }
    } else if (direction === 1) {
      if (index < queue.length - 1) nextId = queue[index + 1];
      else if (!fromEnded || mode === 'all') nextId = queue[0];
    } else {
      if (index > 0) nextId = queue[index - 1];
      else nextId = queue[queue.length - 1];
    }

    if (!nextId) {
      // No-repeat mode reached the end of the queue.
      this.pause();
      return;
    }
    const track = library.tracks.find((item) => item.id === nextId);
    if (!track) return;
    const shouldPlay = fromEnded ? true : usePlaybackStore.getState().isPlaying;
    this.load(track, { autoplay: shouldPlay });
  }

  playTrack(id: string): void {
    const library = useLibraryStore.getState();
    const track = library.tracks.find((item) => item.id === id);
    if (!track) return;
    const alreadyCurrent = library.currentId === id && this.loadedTrackId === id;
    if (alreadyCurrent) {
      if (usePlaybackStore.getState().isPlaying) {
        this.pause();
      } else {
        if (this.active && this.active.ended) this.seek(0);
        this.play();
      }
      return;
    }
    this.load(track, { autoplay: true });
  }

  removeTracks(ids: string[]): void {
    const library = useLibraryStore.getState();
    const removingCurrent = library.currentId ? ids.includes(library.currentId) : false;
    const removed = library.tracks.filter((track) => ids.includes(track.id));
    const wasPlaying = usePlaybackStore.getState().isPlaying;
    const idSet = new Set(ids);
    const order = library.queue.length ? library.queue : library.tracks.map((track) => track.id);
    const index = library.currentId ? order.indexOf(library.currentId) : -1;
    const nextCandidate = [
      ...order.slice(index + 1),
      ...order.slice(0, Math.max(0, index)).reverse(),
    ].find((id) => !idSet.has(id));
    library.removeTracks(ids);
    removed.forEach((track) => revokeTrackUrls(track));
    if (removingCurrent) {
      this.loadedTrackId = null;
      const next = nextCandidate
        ? useLibraryStore.getState().tracks.find((track) => track.id === nextCandidate)
        : useLibraryStore.getState().tracks[0];
      if (next) this.load(next, { autoplay: wasPlaying });
      else {
        this.active?.pause();
        this.active?.removeAttribute('src');
        this.active?.load();
        this.active = null;
        usePlaybackStore.getState().setPlaying(false);
        usePlaybackStore.getState().setLoading(false);
        useClockStore.getState().reset();
      }
    }
  }

  resetQueueToAll(): void {
    const library = useLibraryStore.getState();
    library.setQueue(library.tracks.map((track) => track.id), ALL_SEQUENCE);
  }

  private handleEnded(): void {
    const sleep = useSleepTimerStore.getState();
    if (sleep.enabled && sleep.mode === 'trackEnd') {
      sleep.finish();
      usePlaybackStore.getState().setPlaying(false);
      this.stopClock();
      this.syncClock(true);
      return;
    }
    const { autoPlayNext, playMode } = useSettingsStore.getState();
    if (!autoPlayNext) {
      usePlaybackStore.getState().setPlaying(false);
      this.stopClock();
      this.syncClock(true);
      return;
    }
    if (playMode === 'one') {
      this.seek(0);
      this.play();
      return;
    }
    this.step(1, true);
  }

  private startClock(): void {
    if (this.raf) return;
    this.lastFrame = 0;
    const tick = (now: number): void => {
      if (!this.active || this.active.paused) {
        this.raf = 0;
        return;
      }
      if (now - this.lastFrame >= 45) {
        this.lastFrame = now;
        this.syncClock();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopClock(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private syncClock(force = false): void {
    const element = this.active;
    if (!element) return;
    const time = element.currentTime;
    const clock = useClockStore.getState();
    if (force || Math.abs(clock.time - time) > 0.015) clock.setClock(time);
    this.syncBuffered();
  }

  private syncBuffered(): void {
    const element = this.active;
    if (!element) return;
    let buffered = 0;
    for (let i = 0; i < element.buffered.length; i += 1) {
      buffered = Math.max(buffered, element.buffered.end(i));
    }
    useClockStore.getState().setBuffered(buffered);
  }

  ensureCurrent(): void {
    this.initialize();
    const { currentId, tracks } = useLibraryStore.getState();
    if (currentId && tracks.some((track) => track.id === currentId)) return;
    if (!tracks.length) {
      this.active?.pause();
      usePlaybackStore.getState().setPlaying(false);
      usePlaybackStore.getState().setLoading(false);
      useClockStore.getState().reset();
      return;
    }
    const preferred = useSettingsStore.getState().lastTrackId;
    const track = tracks.find((item) => item.id === preferred) ?? tracks[0];
    this.load(track, {
      autoplay: false,
      position: track.id === preferred ? useSettingsStore.getState().lastPosition : 0,
    });
  }

  dispose(): void {
    this.stopClock();
    this.active?.pause();
    this.settingsUnsubscribe?.();
    this.context?.close();
    this.active?.removeAttribute('src');
    this.active?.load();
  }

  private setupMediaMetadata(track: Track): void {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album ?? '',
        artwork: track.cover
          ? [{ src: track.cover, sizes: '512x512', type: track.cover.startsWith('data:image/png') ? 'image/png' : 'image/jpeg' }]
          : undefined,
      });
    } catch {
      // MediaSession metadata is best-effort.
    }
  }

  private setupMediaSession(): void {
    if (!('mediaSession' in navigator) || this.mediaSessionReady) return;
    this.mediaSessionReady = true;
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => this.play()],
      ['pause', () => this.pause()],
      ['previoustrack', () => this.previous()],
      ['nexttrack', () => this.next()],
      ['seekbackward', (details) => this.seekBy(-(details.seekOffset ?? SEEK_STEP))],
      ['seekforward', (details) => this.seekBy(details.seekOffset ?? SEEK_STEP)],
      ['seekto', (details) => { if (details.seekTime !== undefined) this.seek(details.seekTime); }],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions are not supported everywhere.
      }
    }
  }

  private updateMediaSessionState(): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = usePlaybackStore.getState().isPlaying ? 'playing' : 'paused';
    this.updateMediaSessionPosition();
  }

  private updateMediaSessionPosition(): void {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const duration = useClockStore.getState().duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.active?.playbackRate ?? 1,
        position: clamp(this.active?.currentTime ?? 0, 0, duration),
      });
    } catch {
      // Ignore transient invalid position states.
    }
  }
}

export const player = new PlayerEngine();
