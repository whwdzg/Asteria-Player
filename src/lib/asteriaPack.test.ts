import { describe, expect, it } from 'vitest';
import type { Track } from './types';
import { createAsteriaPack, readAsteriaPack } from './asteriaPack';

const track: Track = {
  id: 'pack-track',
  kind: 'audio',
  title: 'Pack Song',
  artist: 'Pack Artist',
  album: 'Pack Album',
  src: 'data:audio/mpeg;base64,SUQzBAAAAAA=',
  cover: 'data:image/png;base64,iVBORw0KGgo=',
  duration: 12,
  source: 'local',
  format: 'MP3',
  lyrics: 'line one',
};

describe('Asteria Player Pack', () => {
  it('round-trips playlist and source media through a zip archive', async () => {
    const archive = await createAsteriaPack([track], 'Test Pack');
    const imported = await readAsteriaPack(new File([archive], 'test.astpp'));
    expect(imported.name).toBe('Test Pack');
    expect(imported.tracks).toHaveLength(1);
    expect(imported.tracks[0].title).toBe('Pack Song');
    expect(imported.tracks[0].lyrics).toBe('line one');
    expect(imported.tracks[0].source).toBe('local');
    expect(imported.tracks[0].src.startsWith('blob:')).toBe(true);
    expect(imported.trackIds).toEqual([imported.tracks[0].id]);
  });
});
