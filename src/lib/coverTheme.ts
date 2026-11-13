import type { Track } from './types';
import { hashString } from './format';

const NEUTRAL = '#8e9aa6';
const cache = new Map<string, Promise<string>>();

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;
  return { h: hue * 360, s: saturation, l: lightness };
}

function loadImage(url: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (cors) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('cover image failed'));
    image.src = url;
  });
}

async function extract(url: string): Promise<string> {
  let image: HTMLImageElement;
  try {
    image = await loadImage(url, true);
  } catch {
    // Non-CORS artwork can still be displayed, but cannot be sampled. Use a
    // neutral player accent instead of a random generated colour.
    return NEUTRAL;
  }
  if (!image.naturalWidth || !image.naturalHeight) return NEUTRAL;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return NEUTRAL;
    context.drawImage(image, 0, 0, 28, 28);
    const { data } = context.getImageData(0, 0, 28, 28);
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 160) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luminance < 12 || luminance > 246) continue;
      red += r;
      green += g;
      blue += b;
      count += 1;
    }
    if (!count) return NEUTRAL;
    const hsl = rgbToHsl(red / count, green / count, blue / count);
    // Keep the cover's hue but heavily desaturate it. Clamp lightness so the
    // accent remains readable against the dark player chrome.
    const saturation = Math.min(0.36, Math.max(0.08, hsl.s * 0.38));
    const lightness = Math.min(0.72, Math.max(0.55, hsl.l));
    return `hsl(${Math.round(hsl.h)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%)`;
  } catch {
    return NEUTRAL;
  }
}

/** Derive a muted player accent from the current cover / video thumbnail. */
export function coverThemeColor(track: Track | undefined): Promise<string> {
  if (!track?.cover) return Promise.resolve(NEUTRAL);
  const key = `${hashString(track.cover)}:${track.cover.length}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const request = extract(track.cover);
  cache.set(key, request);
  if (cache.size > 32) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return request;
}

export const NEUTRAL_PLAYER_ACCENT = NEUTRAL;
