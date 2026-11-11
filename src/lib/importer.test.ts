import { describe, expect, it } from 'vitest';
import { deriveVideoLabels, isPartVideoName } from './importer';

describe('video part naming', () => {
  it('recognises P1/P2/Part/第N P styles', () => {
    expect(isPartVideoName('P1')).toBe(true);
    expect(isPartVideoName('p12')).toBe(true);
    expect(isPartVideoName('P1 opening')).toBe(true);
    expect(isPartVideoName('Part 3')).toBe(true);
    expect(isPartVideoName('第4P')).toBe(true);
    expect(isPartVideoName('Episode 1')).toBe(false);
  });

  it('uses the parent folder as title and the filename as subtitle', () => {
    expect(deriveVideoLabels('P1.mp4', 'My Show/P1.mp4')).toEqual({
      title: 'My Show',
      subtitle: 'P1',
    });
    expect(deriveVideoLabels('P2 片头.mkv', 'My Show/Season 1/P2 片头.mkv')).toEqual({
      title: 'Season 1',
      subtitle: 'P2 片头',
    });
  });

  it('leaves ordinary video names alone', () => {
    expect(deriveVideoLabels('concert.mp4', 'My Show/concert.mp4')).toEqual({});
  });
});
