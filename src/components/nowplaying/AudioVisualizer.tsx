import { useEffect, useRef } from 'react';
import { player } from '../../player/engine';
import { usePlaybackStore } from '../../state/playback';
import { useSettingsStore } from '../../state/settings';

const BAR_COUNT = 64;

/**
 * Rounded-bar spectrum strip that sits behind the now-playing column.
 *
 * It reads the analyser already present in the player graph and mutates the
 * bars directly with requestAnimationFrame, so 60 fps updates never re-render
 * React or the rest of the player.
 */
export function AudioVisualizer(): React.ReactElement | null {
  const enabled = useSettingsStore((state) => state.audioVisualizer);
  const scale = useSettingsStore((state) => state.audioVisualizerHeight);
  const opacity = useSettingsStore((state) => state.audioVisualizerOpacity);
  const playing = usePlaybackStore((state) => state.isPlaying);
  const bars = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    if (!enabled) return;
    const data = new Uint8Array(256);
    const waveform = new Uint8Array(512);
    const levels = new Float32Array(BAR_COUNT);
    let frame = 0;

    const tick = (): void => {
      const analyser = player.analyserNode;
      if (analyser) {
        analyser.getByteFrequencyData(data);
        analyser.getByteTimeDomainData(waveform);
      }
      const active = usePlaybackStore.getState().isPlaying;
      const bins = Math.max(1, Math.floor(data.length * 0.72));
      let moving = false;

      for (let index = 0; index < BAR_COUNT; index += 1) {
        let target = 0;
        if (active && analyser) {
          const start = Math.min(bins - 1, Math.floor(Math.pow(index / BAR_COUNT, 1.7) * bins));
          const end = Math.max(start + 1, Math.floor(Math.pow((index + 1) / BAR_COUNT, 1.7) * bins));
          let sum = 0;
          for (let bin = start; bin < end; bin += 1) sum += data[bin] ?? 0;
          const average = sum / Math.max(1, end - start) / 255;
          // Blend the spectrum with the time-domain waveform so quiet high
          // frequencies still produce movement across the full strip.
          const waveStart = Math.floor((index / BAR_COUNT) * waveform.length);
          const waveEnd = Math.max(waveStart + 1, Math.floor(((index + 1) / BAR_COUNT) * waveform.length));
          let amplitude = 0;
          for (let sample = waveStart; sample < waveEnd; sample += 1) {
            amplitude += Math.abs((waveform[sample] ?? 128) - 128);
          }
          const wave = Math.min(1, (amplitude / Math.max(1, waveEnd - waveStart) / 128) * 2.4);
          target = Math.min(1, Math.pow(average, 0.85) * 0.55 + wave * 0.65);
        }
        const current = levels[index] * 0.72 + target * 0.28;
        levels[index] = current;
        if (current > 0.012 || target > 0) moving = true;
        const bar = bars.current[index];
        if (bar) bar.style.transform = `scaleY(${Math.max(0.025, current).toFixed(4)})`;
      }

      // While paused the bars decay once and the loop stops. Playback resumes
      // it through the `playing` dependency below.
      if (active || moving) frame = window.requestAnimationFrame(tick);
    };

    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, playing]);

  if (!enabled) return null;

  return (
    <div
      className="audio-visualizer"
      aria-hidden="true"
      style={{
        height: `min(${(scale * 10).toFixed(1)}dvh, 96px)`,
        opacity,
      }}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span
          key={index}
          ref={(element) => { bars.current[index] = element; }}
          className="audio-visualizer-bar"
        />
      ))}
    </div>
  );
}
