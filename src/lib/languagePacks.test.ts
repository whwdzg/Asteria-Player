import { describe, expect, it } from 'vitest';
import { mergeLanguagePacks, parseLanguagePackJson } from './languagePacks';

describe('language pack JSON', () => {
  it('parses a pack and ignores non-string translations', () => {
    const pack = parseLanguagePackJson(JSON.stringify({
      version: 1,
      code: 'ja',
      label: '日本語',
      nativeLabel: '日本語',
      translations: { 'app.name': 'Asteria', ignored: 3 },
    }));
    expect(pack.code).toBe('ja');
    expect(pack.translations).toEqual({ 'app.name': 'Asteria' });
  });

  it('accepts a flat dictionary with the filename as code', () => {
    const pack = parseLanguagePackJson(JSON.stringify({ 'app.name': 'Asteria', 'player.play': 'Play' }), 'ja.json');
    expect(pack.code).toBe('ja');
    expect(pack.label).toBe('JA');
    expect(pack.translations['player.play']).toBe('Play');
  });

  it('accepts a wrapped pack', () => {
    const pack = parseLanguagePackJson(JSON.stringify({
      pack: { code: 'ko', label: '한국어', translations: { 'app.name': 'Asteria' } },
    }));
    expect(pack.code).toBe('ko');
  });

  it('rejects unsafe or incomplete packs', () => {
    expect(() => parseLanguagePackJson('{')).toThrow(/Invalid JSON/);
    expect(() => parseLanguagePackJson(JSON.stringify({ code: 'bad code', label: 'X', translations: { a: 'b' } }))).toThrow(/code/);
    expect(() => parseLanguagePackJson(JSON.stringify({ code: 'ja', label: 'X', translations: {} }))).toThrow(/translations/);
  });

  it('lets an imported pack override a built-in code', () => {
    const merged = mergeLanguagePacks(
      [{ code: 'en', label: 'English', file: 'en.json' }],
      [{ code: 'en', label: 'Custom', translations: { a: 'b' }, importedAt: 1 }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe('Custom');
    expect(merged[0].source).toBe('imported');
  });
});
