import { describe, expect, it } from 'vitest';
import { clearDeepLink, parseDeepLink } from './deepLink';

const base = 'https://whwdzg.github.io/Asteria-Player/';

describe('Asteria deep links', () => {
  it('reads URL and kind from the query string', () => {
    const href = `${base}?url=${encodeURIComponent('https://cdn.example/song.mp3')}&kind=audio&theme=dark`;
    expect(parseDeepLink(href)).toEqual({ url: 'https://cdn.example/song.mp3', kind: 'audio' });
    expect(clearDeepLink(href)).toBe('/Asteria-Player/?theme=dark');
  });

  it('supports hash parameters and ignores unsafe protocols', () => {
    expect(parseDeepLink(`${base}#url=https%3A%2F%2Fexample.com%2Fvideo.mp4&type=video`))
      .toEqual({ url: 'https://example.com/video.mp4', kind: 'video' });
    expect(parseDeepLink(`${base}?url=javascript%3Aalert(1)`)).toBeNull();
    expect(parseDeepLink(base)).toBeNull();
  });
});
