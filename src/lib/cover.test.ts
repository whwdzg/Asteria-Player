import { describe, expect, it } from 'vitest';
import { highResolutionCover } from './cover';

describe('high-resolution artwork', () => {
  it('upgrades iTunes artwork renditions for the lightbox', () => {
    expect(highResolutionCover('https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg'))
      .toBe('https://is1-ssl.mzstatic.com/image/thumb/a/1200x1200bb.jpg');
    expect(highResolutionCover('https://is1-ssl.mzstatic.com/image/thumb/a/600x600bb.png'))
      .toBe('https://is1-ssl.mzstatic.com/image/thumb/a/1200x1200bb.png');
  });

  it('leaves local and unknown URLs untouched', () => {
    expect(highResolutionCover('blob:http://localhost/cover')).toBe('blob:http://localhost/cover');
    expect(highResolutionCover('demo/covers/aurora-drift.webp')).toBe('demo/covers/aurora-drift.webp');
    expect(highResolutionCover(undefined)).toBeUndefined();
  });
});
