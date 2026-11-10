import type { MediaTags } from '../types';
import { ascii, dataUrl, u32be, u64be } from './bytes';

interface Atom {
  type: string;
  start: number;
  dataStart: number;
  end: number;
}

function readAtoms(bytes: Uint8Array, start: number, end: number, limit = 10000): Atom[] {
  const atoms: Atom[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor + 8 <= end && guard < limit) {
    guard += 1;
    let size = u32be(bytes, cursor);
    const type = ascii(bytes, cursor + 4, 4);
    let dataStart = cursor + 8;
    if (size === 1) {
      if (cursor + 16 > end) break;
      size = u64be(bytes, cursor + 8);
      dataStart = cursor + 16;
    } else if (size === 0) {
      size = end - cursor;
    }
    if (size < 8 || cursor + size > end) break;
    atoms.push({ type, start: cursor, dataStart, end: cursor + size });
    cursor += size;
    if (!/^[\x20-\x7e©]{4}$/.test(type)) break;
  }
  return atoms;
}

function child(bytes: Uint8Array, parent: Atom, type: string): Atom | undefined {
  return readAtoms(bytes, parent.dataStart, parent.end).find((atom) => atom.type === type);
}

function path(bytes: Uint8Array, root: Atom, types: string[]): Atom | undefined {
  let current: Atom | undefined = root;
  for (const type of types) {
    if (!current) return undefined;
    current = child(bytes, current, type);
  }
  return current;
}

function readValue(bytes: Uint8Array, item: Atom): { value: string; dataType: number; binary: Uint8Array } | null {
  const dataAtom = child(bytes, item, 'data');
  if (!dataAtom) return null;
  if (dataAtom.dataStart + 8 > dataAtom.end) return null;
  const dataType = u32be(bytes, dataAtom.dataStart) & 0xffffff;
  const payloadStart = dataAtom.dataStart + 8;
  const payload = bytes.subarray(payloadStart, dataAtom.end);
  return { value: new TextDecoder('utf-8').decode(payload).replace(/\u0000+$/g, '').trim(), dataType, binary: payload };
}

const TAG_KEYS: Record<string, keyof MediaTags> = {
  '©nam': 'title',
  '©ART': 'artist',
  'aART': 'artist',
  '©alb': 'album',
  '©lyr': 'lyrics',
};

export function parseMp4(bytes: Uint8Array): MediaTags | null {
  if (bytes.length < 16) return null;
  const top = readAtoms(bytes, 0, bytes.length);
  const moov = top.find((atom) => atom.type === 'moov');
  if (!moov) return null;
  const tags: MediaTags = {};

  const mvhd = child(bytes, moov, 'mvhd');
  if (mvhd && mvhd.dataStart + 20 <= mvhd.end) {
    const version = bytes[mvhd.dataStart];
    const timescale = version === 1 ? u32be(bytes, mvhd.dataStart + 20) : u32be(bytes, mvhd.dataStart + 12);
    const duration = version === 1 ? u64be(bytes, mvhd.dataStart + 24) : u32be(bytes, mvhd.dataStart + 16);
    if (timescale && duration) tags.duration = duration / timescale;
  }

  const trak = child(bytes, moov, 'trak');
  const mdhd = trak ? path(bytes, trak, ['mdia', 'mdhd']) : undefined;
  if (mdhd && mdhd.dataStart + 20 <= mdhd.end) {
    const version = bytes[mdhd.dataStart];
    const timescale = version === 1 ? u32be(bytes, mdhd.dataStart + 20) : u32be(bytes, mdhd.dataStart + 12);
    if (timescale > 4000 && timescale < 400000) tags.sampleRate = timescale;
  }

  const meta = path(bytes, moov, ['udta', 'meta']);
  if (!meta) return Object.keys(tags).length ? tags : null;
  // `meta` is a full box: skip version + flags before its children.
  const metaChildren = readAtoms(bytes, meta.dataStart + 4, meta.end);
  const ilst = metaChildren.find((atom) => atom.type === 'ilst');
  if (!ilst) return Object.keys(tags).length ? tags : null;
  for (const item of readAtoms(bytes, ilst.dataStart, ilst.end)) {
    const key = TAG_KEYS[item.type];
    if (!key) continue;
    const value = readValue(bytes, item);
    if (!value) continue;
    if (key === 'lyrics') {
      tags.lyrics = tags.lyrics ? `${tags.lyrics}\n${value.value}` : value.value;
    } else if (item.type === 'aART') {
      if (!tags.artist) tags.artist = value.value;
    } else {
      tags[key] = value.value as never;
    }
  }
  const cover = readAtoms(bytes, ilst.dataStart, ilst.end).find((item) => item.type === 'covr');
  if (cover) {
    const value = readValue(bytes, cover);
    if (value?.binary.length) {
      tags.cover = dataUrl(value.dataType === 14 ? 'image/png' : 'image/jpeg', value.binary);
    }
  }
  return Object.keys(tags).length ? tags : null;
}

export function parseWav(bytes: Uint8Array): MediaTags | null {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') return null;
  const tags: MediaTags = {};
  let cursor = 12;
  while (cursor + 8 <= bytes.length) {
    const type = ascii(bytes, cursor, 4);
    const size = bytes[cursor + 4] | (bytes[cursor + 5] << 8) | (bytes[cursor + 6] << 16) | (bytes[cursor + 7] << 24);
    const start = cursor + 8;
    if (type === 'fmt ' && start + 16 <= bytes.length) {
      const channels = bytes[start + 2] | (bytes[start + 3] << 8);
      const sampleRate = bytes[start + 4] | (bytes[start + 5] << 8) | (bytes[start + 6] << 16) | (bytes[start + 7] << 24);
      const bits = bytes[start + 14] | (bytes[start + 15] << 8);
      if (sampleRate) tags.sampleRate = sampleRate;
      if (bits) tags.bitDepth = bits;
      if (channels > 2) tags.format = `WAV · ${channels}ch`;
    }
    if (type === 'data' && tags.sampleRate && tags.bitDepth) {
      const bytesPerSecond = tags.sampleRate * (tags.bitDepth / 8) * 2;
      if (bytesPerSecond > 0) tags.duration = size / bytesPerSecond;
    }
    if (size <= 0) break;
    cursor = start + size + (size % 2);
  }
  return Object.keys(tags).length ? tags : null;
}
