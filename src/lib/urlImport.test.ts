import { describe, expect, it } from 'vitest';
import { importRemoteUrls, isBilibiliUrl, kindFromUrl } from './urlImport';

describe('online URL import', () => {
  it('classifies direct media links and creates remote tracks', async () => {
    expect(kindFromUrl('https://cdn.example/album/song.flac')).toBe('audio');
    expect(kindFromUrl('https://cdn.example/movie/trailer.mp4')).toBe('video');
    expect(kindFromUrl('https://cdn.example/download?id=42', 'video')).toBe('video');

    const seen: string[] = [];
    const result = await importRemoteUrls([
      'https://cdn.example/album/My%20Song.mp3',
      'https://cdn.example/movie/trailer.mp4',
    ], { onTrack: (track) => seen.push(track.title) });
    expect(seen).toEqual(['My Song', 'trailer']);
    expect(result.warnings).toEqual([]);
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0]).toMatchObject({
      kind: 'audio',
      title: 'My Song',
      source: 'url',
      src: 'https://cdn.example/album/My%20Song.mp3',
    });
    expect(result.tracks[1]).toMatchObject({ kind: 'video', title: 'trailer', source: 'url' });
  });

  it('recognises BV/AV ids and Bilibili URLs', () => {
    expect(isBilibiliUrl('BV1xx411c7mD')).toBe(true);
    expect(isBilibiliUrl('av170001')).toBe(true);
    expect(isBilibiliUrl('https://www.bilibili.com/video/BV1xx411c7mD?p=2')).toBe(true);
    expect(isBilibiliUrl('https://example.com/video.mp4')).toBe(false);
  });

  it('rejects unsupported Bilibili list and short links before any network request', async () => {
    const list = await importRemoteUrls(['https://space.bilibili.com/123/video']);
    expect(list.tracks).toHaveLength(0);
    expect(list.warnings[0]).toMatch(/list\/space/i);

    const short = await importRemoteUrls(['https://b23.tv/abc123']);
    expect(short.tracks).toHaveLength(0);
    expect(short.warnings[0]).toMatch(/short links/i);
  });

  it('keeps failed entries as warnings and imports the rest', async () => {
    const result = await importRemoteUrls([
      'not a link',
      'https://cdn.example/audio.ogg',
    ]);
    expect(result.tracks).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.tracks[0].kind).toBe('audio');
  });
});
