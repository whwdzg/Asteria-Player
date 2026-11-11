import { describe, expect, it } from 'vitest';
import { mergeSubtitles, pickBilibiliPage } from './bilibili';
import { applySongCandidate } from './onlineMatch';
import type { Track } from './types';

const track: Track = {
  id: 't',
  kind: 'audio',
  title: 'Old title',
  artist: 'Old artist',
  src: 'blob:test',
  duration: 100,
  source: 'local',
  cover: 'https://old.example/cover.jpg',
  lyrics: 'old lyrics',
  lyricsFormat: 'lrc',
};

describe('online matching helpers', () => {
  it('picks the P-numbered Bilibili page and falls back to P1', () => {
    const pages = [
      { page: 1, cid: 11, part: 'P1' },
      { page: 2, cid: 22, part: 'P2' },
    ];
    expect(pickBilibiliPage(pages, 'P2')?.cid).toBe(22);
    expect(pickBilibiliPage(pages, 'P1')?.cid).toBe(11);
    expect(pickBilibiliPage(pages, undefined)?.cid).toBe(11);
  });

  it('merges fetched subtitles by language', () => {
    const merged = mergeSubtitles(
      [{ id: 'old', lang: 'zh-CN', label: '中文', text: 'old' }],
      [
        { id: 'new', lang: 'zh-CN', label: '中文', text: 'new' },
        { id: 'en', lang: 'en', label: 'English', text: 'hi' },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.lang === 'zh-CN')?.text).toBe('new');
  });

  it('does not wipe an existing cover or lyrics with a partial match', () => {
    const patch = applySongCandidate(track, {
      id: 'candidate',
      title: 'New title',
      artist: 'New artist',
      providers: ['itunes'],
      score: 0.8,
    });
    expect(patch.title).toBe('New title');
    expect(patch.cover).toBe(track.cover);
    expect(patch.lyrics).toBe(track.lyrics);
  });

  it('applies matched artwork and lyrics when present', () => {
    const patch = applySongCandidate(track, {
      id: 'candidate',
      title: 'New title',
      artist: 'New artist',
      cover: 'https://new.example/cover.jpg',
      lyrics: '[00:00.00]New',
      lyricsFormat: 'lrc',
      providers: ['itunes', 'lrclib'],
      score: 0.9,
    });
    expect(patch.cover).toBe('https://new.example/cover.jpg');
    expect(patch.lyrics).toBe('[00:00.00]New');
  });
});
