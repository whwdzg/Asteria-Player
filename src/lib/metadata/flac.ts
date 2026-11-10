import type { MediaTags } from '../types';
import { ascii, dataUrl, u32be, u32le } from './bytes';

interface FlacMetadata {
  type: number;
  offset: number;
  length: number;
}

function parseStreamInfo(bytes: Uint8Array, offset: number): Partial<MediaTags> {
  if (offset + 18 > bytes.length) return {};
  const p = offset;
  const sampleRate = ((bytes[p + 10] ?? 0) << 12) | ((bytes[p + 11] ?? 0) << 4) | ((bytes[p + 12] ?? 0) >> 4);
  const bits = (((bytes[p + 12] ?? 0) & 0x01) << 4) | ((bytes[p + 13] ?? 0) >> 4);
  const totalSamples = ((bytes[p + 13] ?? 0) & 0x0f) * 0x100000000 + u32be(bytes, p + 14);
  return {
    sampleRate: sampleRate || undefined,
    bitDepth: bits + 1,
    duration: sampleRate ? totalSamples / sampleRate : undefined,
  };
}

function parseVorbisComment(bytes: Uint8Array, offset: number, length: number): MediaTags {
  const tags: MediaTags = {};
  const end = Math.min(bytes.length, offset + length);
  let cursor = offset;
  if (cursor + 4 > end) return tags;
  const vendorLength = u32le(bytes, cursor);
  cursor += 4 + vendorLength;
  if (cursor + 4 > end) return tags;
  const count = u32le(bytes, cursor);
  cursor += 4;
  for (let i = 0; i < count && cursor + 4 <= end; i += 1) {
    const itemLength = u32le(bytes, cursor);
    cursor += 4;
    if (itemLength < 0 || cursor + itemLength > end) break;
    const item = new TextDecoder('utf-8').decode(bytes.subarray(cursor, cursor + itemLength));
    cursor += itemLength;
    const equals = item.indexOf('=');
    if (equals <= 0) continue;
    const key = item.slice(0, equals).toUpperCase();
    const value = item.slice(equals + 1).trim();
    if (!value) continue;
    switch (key) {
      case 'TITLE': tags.title = value; break;
      case 'ARTIST': tags.artist = value; break;
      case 'ALBUM': tags.album = value; break;
      case 'ALBUMARTIST': if (!tags.artist) tags.artist = value; break;
      case 'LYRICS':
      case 'UNSYNCEDLYRICS':
      case 'SYNCEDLYRICS':
        tags.lyrics = tags.lyrics ? `${tags.lyrics}\n${value}` : value;
        break;
      case 'LYRICS_TRANSLATION':
      case 'TRANSLATION':
        tags.lyrics = tags.lyrics ? `${tags.lyrics}\n${value}` : value;
        break;
      default: break;
    }
  }
  return tags;
}

function parsePicture(bytes: Uint8Array, offset: number, length: number): string | undefined {
  const end = Math.min(bytes.length, offset + length);
  let cursor = offset;
  if (cursor + 8 > end) return undefined;
  cursor += 4; // picture type
  const mimeLength = u32be(bytes, cursor);
  cursor += 4;
  if (cursor + mimeLength > end) return undefined;
  const mime = ascii(bytes, cursor, mimeLength);
  cursor += mimeLength;
  if (cursor + 4 > end) return undefined;
  const descriptionLength = u32be(bytes, cursor);
  cursor += 4 + descriptionLength;
  if (cursor + 20 > end) return undefined;
  cursor += 16; // width, height, depth, colors
  const dataLength = u32be(bytes, cursor);
  cursor += 4;
  if (cursor + dataLength > end) return undefined;
  return dataUrl(mime || 'image/jpeg', bytes.subarray(cursor, cursor + dataLength));
}

export function parseFlac(bytes: Uint8Array): MediaTags | null {
  if (ascii(bytes, 0, 4) !== 'fLaC') return null;
  const tags: MediaTags = {};
  let cursor = 4;
  let last = false;
  const blocks: FlacMetadata[] = [];
  while (!last && cursor + 4 <= bytes.length && blocks.length < 64) {
    const header = bytes[cursor];
    last = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const length = ((bytes[cursor + 1] ?? 0) << 16) | ((bytes[cursor + 2] ?? 0) << 8) | (bytes[cursor + 3] ?? 0);
    const offset = cursor + 4;
    if (offset + length > bytes.length) break;
    blocks.push({ type, offset, length });
    cursor = offset + length;
  }
  for (const block of blocks) {
    if (block.type === 0) Object.assign(tags, parseStreamInfo(bytes, block.offset));
    if (block.type === 4) Object.assign(tags, parseVorbisComment(bytes, block.offset, block.length));
    if (block.type === 6 && !tags.cover) tags.cover = parsePicture(bytes, block.offset, block.length);
  }
  return tags;
}
