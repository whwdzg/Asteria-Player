import { describe, expect, it } from 'vitest';
import { checkJsonSyntax, tokenizeJson } from './jsonEditor';

describe('JSON editor helpers', () => {
  it('accepts valid JSON', () => {
    expect(checkJsonSyntax('{"theme":"dark","volume":0.5}')).toBeNull();
  });

  it('reports a one-based line and column for malformed JSON', () => {
    const issue = checkJsonSyntax('{\n  "theme": "dark",\n  "volume":\n}');
    expect(issue).not.toBeNull();
    expect(issue?.line).toBe(4);
    expect(issue?.column).toBeGreaterThan(0);
    expect(issue?.message.length).toBeGreaterThan(0);
  });

  it('tokenises keys, strings, numbers and literals for the highlight overlay', () => {
    const tokens = tokenizeJson('{"ok":true,"n":12,"text":"hello"}');
    expect(tokens.filter((token) => token.type === 'key').map((token) => token.text)).toEqual([
      '"ok"', '"n"', '"text"',
    ]);
    expect(tokens.some((token) => token.type === 'literal' && token.text === 'true')).toBe(true);
    expect(tokens.some((token) => token.type === 'number' && token.text === '12')).toBe(true);
    expect(tokens.some((token) => token.type === 'string' && token.text === '"hello"')).toBe(true);
  });

  it('preserves invalid text instead of dropping it', () => {
    const text = '{"broken": nope}';
    expect(tokenizeJson(text).map((token) => token.text).join('')).toBe(text);
  });
});
