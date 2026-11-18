import { describe, expect, it } from 'vitest';
import { mixinKey, signWbiParams } from './wbi';

describe('Bilibili WBI signing', () => {
  it('matches the documented example', () => {
    const imgKey = '7cd084941338484aae1ad9425b84077c';
    const subKey = '4932caff0ff746eab6f01bf08b70ac45';
    expect(mixinKey(imgKey, subKey)).toBe('ea1db124af3c7062474693fa704f4ff8');
    expect(signWbiParams({ foo: '114', bar: '514', baz: 1919810 }, imgKey, subKey, 1702204169))
      .toMatchObject({ wts: '1702204169', w_rid: '6149fdadf571698ca7e6a567265cd0ee' });
  });
});
