import { describe, expect, it } from 'vitest';
import { lowerBound, parseDanmaku } from './danmaku';

describe('danmaku', () => {
  it('parses Bilibili XML comments, modes and colors', () => {
    const comments = parseDanmaku(`<?xml version="1.0"?>
<i>
  <d p="1.2,1,25,16777215,0,0,0,0">Hello &amp; welcome</d>
  <d p="2.4,5,25,16711680,0,0,0,0">Top comment</d>
  <d p="3.0,4,25,255,0,0,0,0">Bottom</d>
</i>`);
    expect(comments).toHaveLength(3);
    expect(comments[0]).toMatchObject({ time: 1.2, mode: 'scroll', color: '#ffffff', text: 'Hello & welcome' });
    expect(comments[1]).toMatchObject({ mode: 'top', color: '#ff0000' });
    expect(comments[2].mode).toBe('bottom');
    expect(lowerBound(comments, 2)).toBe(1);
  });

  it('parses JSON danmaku arrays', () => {
    const comments = parseDanmaku(JSON.stringify([
      { time: 1.5, text: 'One', mode: 'top', color: '#00ff00', size: 25 },
      { time: 0.5, text: 'Two', mode: 1, color: 16777215 },
    ]));
    expect(comments.map((comment) => comment.text)).toEqual(['Two', 'One']);
    expect(comments[1].mode).toBe('top');
  });
});
