import { describe, expect, it } from 'vitest';
import {
  activeCue,
  languageLabel,
  normalizeLanguage,
  parseAss,
  parseSrt,
  parseSubtitle,
  parseVtt,
  pickSubtitleLanguage,
  subtitleLanguageFromName,
} from './subtitles';

describe('subtitles', () => {
  it('parses SRT cues with multiline text', () => {
    const cues = parseSrt(`1
00:00:01,000 --> 00:00:03,500
Hello
World

2
00:00:04,000 --> 00:00:06,000
Second
`);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3.5, text: 'Hello\nWorld' });
    expect(cues[1].text).toBe('Second');
    expect(activeCue(cues, 2)?.text).toContain('Hello');
    expect(activeCue(cues, 3.8)).toBeUndefined();
  });

  it('parses WebVTT cues without cue identifiers', () => {
    const cues = parseVtt(`WEBVTT

00:00:01.000 --> 00:00:02.000 align:start
Hello <b>world</b>

00:00:03.000 --> 00:00:04.000
Again
`);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('Hello world');
  });

  it('parses ASS dialogue events and strips override tags', () => {
    const cues = parseAss(`[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\\i1}Hello\\Nworld
Dialogue: 0,0:00:04.00,0:00:06.00,Default,,0,0,0,,Second, with comma
`);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('Hello\nworld');
    expect(cues[1].text).toBe('Second, with comma');
  });

  it('detects subtitle formats', () => {
    expect(parseSubtitle('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi').format).toBe('vtt');
    expect(parseSubtitle('[Script Info]\n\n[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:02.00,Hi').format).toBe('ass');
    expect(parseSubtitle('1\n00:00:01,000 --> 00:00:02,000\nHi').format).toBe('srt');
  });

  it('extracts and normalizes language suffixes', () => {
    expect(subtitleLanguageFromName('movie.zh-CN.srt')).toEqual({ base: 'movie', lang: 'zh-CN' });
    expect(subtitleLanguageFromName('movie.en.vtt').lang).toBe('en');
    expect(subtitleLanguageFromName('movie.cht.ass').lang).toBe('zh-TW');
    expect(normalizeLanguage('CHS')).toBe('zh-CN');
    expect(languageLabel('ja')).toBe('日本語');
  });

  it('picks a subtitle by preference or system language', () => {
    const subtitles = [
      { id: 'en', lang: 'en', label: 'English' },
      { id: 'zh', lang: 'zh-CN', label: '中文' },
    ];
    expect(pickSubtitleLanguage(subtitles, 'en', ['zh-CN'])?.id).toBe('en');
    expect(pickSubtitleLanguage(subtitles, 'auto', ['en-US'])?.id).toBe('en');
    expect(pickSubtitleLanguage(subtitles, 'auto', ['zh-CN'])?.id).toBe('zh');
    expect(pickSubtitleLanguage(subtitles, 'off', ['zh-CN'])).toBeUndefined();
  });
});
