import { describe, expect, it } from 'vitest';
import { findActiveLineIndex, getWordProgress, mergeTranslation, parseLyrics } from './lyrics';

describe('parseLyrics', () => {
  it('parses LRC timestamps and same-timestamp translations', () => {
    const doc = parseLyrics(`[ti:Test]
[00:01.00]Hello
[00:01.00]你好
[00:03.50]World
[00:03.50]世界
`, { duration: 8 });
    expect(doc.synced).toBe(true);
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines[0]).toMatchObject({ start: 1, end: 3.5, text: 'Hello', translation: '你好' });
    expect(doc.lines[1]).toMatchObject({ start: 3.5, end: 8, text: 'World', translation: '世界', wordTimed: false });
    expect(doc.meta.ti).toBe('Test');
  });

  it('parses SPL word timings and explicit line ends', () => {
    const doc = parseLyrics('[00:10.00]Hello <00:11.00>world[00:12.50]\n[00:13.00]Next', { duration: 20 });
    const line = doc.lines[0];
    expect(line.wordTimed).toBe(true);
    expect(line.words.map((word) => word.text)).toEqual(['Hello ', 'world']);
    expect(line.words[0].start).toBeCloseTo(10);
    expect(line.words[0].end).toBeCloseTo(11);
    expect(line.words[1].end).toBeCloseTo(12.5);
    expect(line.end).toBeCloseTo(12.5);
  });

  it('treats a timestamp-only line as an end marker, not a lyric', () => {
    const doc = parseLyrics('[00:01.00]First\n[00:04.00]\n[00:05.00]Second', { duration: 9 });
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines[0].end).toBeCloseTo(4);
    expect(doc.lines[1].start).toBeCloseTo(5);
  });

  it('supports delayed SPL word timing', () => {
    const doc = parseLyrics('[00:05.00]<00:06.00>Hello <00:07.00>there[00:08.00]', { duration: 9 });
    const words = getWordProgress(doc.lines[0], 6.5);
    expect(words[0].state).toBe('active');
    expect(words[0].progress).toBeCloseTo(0.5);
    expect(words[1].state).toBe('pending');
  });

  it('applies offset metadata and clamps the last line to the duration', () => {
    const doc = parseLyrics('[offset:500]\n[00:01.00]One\n[00:02.00]Two', { duration: 5 });
    expect(doc.lines[0].start).toBeCloseTo(1.5);
    expect(doc.lines[1].start).toBeCloseTo(2.5);
    expect(doc.lines[1].end).toBeCloseTo(5);
  });

  it('drops timestamps that start after the track ends', () => {
    const doc = parseLyrics('[00:01.00]One\n[00:30.00]Too late', { duration: 10 });
    expect(doc.lines).toHaveLength(1);
    expect(doc.lines[0].end).toBeCloseTo(10);
  });

  it('ignores LX Music awlrc compatibility fields', () => {
    const doc = parseLyrics(`[00:01.00]Hello
[awlrc:lrc:SGVsbG8=,awlrc:V29ybGQ=]
你好`, { duration: 5 });
    expect(doc.lines).toHaveLength(1);
    expect(doc.lines[0].translation).toBe('你好');
  });

  it('supports repeated line timestamps', () => {
    const doc = parseLyrics('[00:10.00][00:20.00]Again', { duration: 30 });
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines.map((line) => line.start)).toEqual([10, 20]);
  });

  it('returns unsynced plain text when no timestamps exist', () => {
    const doc = parseLyrics('First line\nSecond line');
    expect(doc.synced).toBe(false);
    expect(doc.plainText).toBe('First line\nSecond line');
    expect(doc.lines).toHaveLength(0);
  });

  it('parses translations from a separate sidecar document', () => {
    const main = parseLyrics('[00:01.00]Hello\n[00:03.00]World', { duration: 6 });
    const merged = mergeTranslation(main, '[00:01.00]你好\n[00:03.00]世界');
    expect(merged.lines[0].translation).toBe('你好');
    expect(merged.lines[1].translation).toBe('世界');
  });

  it('finds the active line by binary search', () => {
    const doc = parseLyrics('[00:01.00]One\n[00:05.00]Two\n[00:09.00]Three', { duration: 12 });
    expect(findActiveLineIndex(doc.lines, 0.5)).toBe(-1);
    expect(findActiveLineIndex(doc.lines, 1.2)).toBe(0);
    expect(findActiveLineIndex(doc.lines, 8)).toBe(1);
    expect(findActiveLineIndex(doc.lines, 11)).toBe(2);
  });
});
