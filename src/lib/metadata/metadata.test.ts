import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { readMediaTags } from './index';

async function demoFile(name: string, mime: string): Promise<File> {
  const bytes = await readFile(new URL(`../../../public/demo/audio/${name}`, import.meta.url));
  return new File([bytes], name, { type: mime });
}

describe('embedded media tags', () => {
  it('reads ID3 title, artist, album, cover and USLT lyrics', async () => {
    const tags = await readMediaTags(await demoFile('liquid-glass.mp3', 'audio/mpeg'));
    expect(tags.title).toBe('Liquid Glass');
    expect(tags.artist).toBe('Mira Voss');
    expect(tags.album).toBe('Refraction');
    expect(tags.lyrics).toContain('Liquid glass, liquid light');
    expect(tags.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(tags.sampleRate).toBe(44100);
    expect(tags.format).toBe('MP3');
  });

  it('reads FLAC stream info, Vorbis comments and picture', async () => {
    const tags = await readMediaTags(await demoFile('paper-planes.flac', 'audio/flac'));
    expect(tags.title).toBe('纸飞机穿过清晨');
    expect(tags.artist).toBe('Kite Ensemble');
    expect(tags.sampleRate).toBe(48000);
    expect(tags.bitDepth).toBe(24);
    expect(tags.duration).toBeGreaterThan(70);
    expect(tags.lyrics).toContain('纸飞机');
    expect(tags.cover?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('reads the embedded cover from an MP3 with a large APIC frame', async () => {
    const tags = await readMediaTags(await demoFile('aurora-drift.mp3', 'audio/mpeg'));
    expect(tags.title).toBe('Aurora Drift');
    expect(tags.cover?.length).toBeGreaterThan(10000);
    expect(tags.sampleRate).toBe(48000);
    expect(tags.bitrate).toBeGreaterThanOrEqual(128000);
  });
});
