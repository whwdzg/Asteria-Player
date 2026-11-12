import type { Track } from './types';
import { hashString } from './format';

const PALETTES = [
  ['#67e8f9', '#3b82f6', '#1e1b4b'],
  ['#f9a8d4', '#a855f7', '#172554'],
  ['#fcd34d', '#f97316', '#3b0764'],
  ['#6ee7b7', '#0ea5e9', '#082f49'],
  ['#fda4af', '#e11d48', '#1e1b4b'],
  ['#c4b5fd', '#6366f1', '#0f172a'],
];

export function coverFallback(track: Pick<Track, 'id' | 'title' | 'accent'>): {
  background: string;
  accent: string;
} {
  const seed = hashString(track.id || track.title);
  const palette = PALETTES[seed % PALETTES.length];
  const angle = 120 + (seed % 100);
  const x = 20 + (seed % 60);
  const y = 15 + ((seed >> 4) % 60);
  const accent = track.accent ?? palette[0];
  return {
    accent,
    background: [
      `radial-gradient(120% 120% at ${x}% ${y}%, ${palette[0]}cc 0%, transparent 52%)`,
      `radial-gradient(110% 110% at ${100 - x}% ${100 - y}%, ${palette[1]}bb 0%, transparent 58%)`,
      `linear-gradient(${angle}deg, ${palette[2]} 0%, #0b1020 100%)`,
    ].join(', '),
  };
}

/** Upgrade known artwork CDNs to a larger rendition for the lightbox. */
export function highResolutionCover(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/mzstatic\.com/.test(url)) return url.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, '/1200x1200bb.$1');
  return url;
}

export function accentFor(track: Track | undefined): string {
  if (!track) return '#4cc2ff';
  return track.accent ?? coverFallback(track).accent;
}
