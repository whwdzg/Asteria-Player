import type { MediaTags } from '../types';
import { ascii, dataUrl, decodeText, findTerminator, syncSafe, u32be } from './bytes';

const tagNumber = (value: string): number | undefined => {
  const parsed = Number.parseInt(value.split('/')[0] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function deUnsynchronize(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let write = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    out[write] = bytes[i];
    write += 1;
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i += 1;
  }
  return out.subarray(0, write);
}

function readTextFrame(data: Uint8Array): string {
  if (!data.length) return '';
  return decodeText(data.subarray(1), data[0]);
}

function readUserText(data: Uint8Array): { description: string; value: string } | null {
  if (data.length < 2) return null;
  const encoding = data[0];
  const end = findTerminator(data, 1, encoding);
  const description = decodeText(data.subarray(1, end), encoding);
  const offset = Math.min(data.length, end + (encoding === 1 || encoding === 2 ? 2 : 1));
  return { description, value: decodeText(data.subarray(offset), encoding) };
}

function readUnsynchronizedLyrics(data: Uint8Array): string {
  if (data.length < 5) return '';
  const encoding = data[0];
  const end = findTerminator(data, 4, encoding);
  const offset = end + (encoding === 1 || encoding === 2 ? 2 : 1);
  return decodeText(data.subarray(offset), encoding);
}

function readPicture(data: Uint8Array): string | undefined {
  if (data.length < 4) return undefined;
  const encoding = data[0];
  const mimeEnd = findTerminator(data, 1, 0);
  const mime = ascii(data, 1, Math.max(0, mimeEnd - 1)).replace(/\0/g, '') || 'image/jpeg';
  const descriptionStart = mimeEnd + 2;
  const descriptionEnd = findTerminator(data, descriptionStart, encoding);
  const offset = descriptionEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
  const picture = data.subarray(Math.min(data.length, offset));
  if (!picture.length) return undefined;
  return dataUrl(mime === 'image/jpg' ? 'image/jpeg' : mime, picture);
}

/** Parses an ID3v2 tag located at the start of `bytes`. */
export function parseId3(bytes: Uint8Array): { tags: MediaTags; tagSize: number } | null {
  if (ascii(bytes, 0, 3) !== 'ID3' || bytes.length < 10) return null;
  const major = bytes[3];
  if (major < 2 || major > 4) return null;
  const flags = bytes[5];
  const tagSize = syncSafe(bytes, 6);
  let tag = bytes.subarray(10, Math.min(bytes.length, 10 + tagSize));
  if (flags & 0x80) tag = deUnsynchronize(tag);

  const tags: MediaTags = {};
  const userLyrics: string[] = [];
  let offset = 0;

  if ((flags & 0x40) && major >= 3 && tag.length >= 4) {
    if (major === 3) offset = 4 + u32be(tag, 0);
    else offset = syncSafe(tag, 0);
  }

  while (offset + 10 <= tag.length) {
    if (major === 2) {
      const id = ascii(tag, offset, 3);
      if (!/^[A-Z0-9]{3}$/.test(id)) break;
      const size = (tag[offset + 3] << 16) | (tag[offset + 4] << 8) | tag[offset + 5];
      const data = tag.subarray(offset + 6, offset + 6 + size);
      if (id === 'TT2') tags.title = readTextFrame(data);
      if (id === 'TP1') tags.artist = readTextFrame(data);
      if (id === 'TAL') tags.album = readTextFrame(data);
      if (id === 'ULT') tags.lyrics = readUnsynchronizedLyrics(data);
      offset += 6 + size;
      continue;
    }

    const id = ascii(tag, offset, 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = major === 4 ? syncSafe(tag, offset + 4) : u32be(tag, offset + 4);
    const frameFlags = (tag[offset + 8] << 8) | tag[offset + 9];
    if (size <= 0 || offset + 10 + size > tag.length) break;
    const data = tag.subarray(offset + 10, offset + 10 + size);
    const compressed = (major === 3 && (frameFlags & 0x0080) !== 0) || (major === 4 && (frameFlags & 0x0009) !== 0);
    const encrypted = (major === 3 && (frameFlags & 0x0040) !== 0) || (major === 4 && (frameFlags & 0x0004) !== 0);
    if (!compressed && !encrypted) {
      switch (id) {
        case 'TIT2': tags.title = readTextFrame(data); break;
        case 'TPE1': tags.artist = readTextFrame(data); break;
        case 'TPE2': if (!tags.artist) tags.artist = readTextFrame(data); break;
        case 'TALB': tags.album = readTextFrame(data); break;
        case 'TRCK': tags.trackNumber = tagNumber(readTextFrame(data)); break;
        case 'TPOS': tags.discNumber = tagNumber(readTextFrame(data)); break;
        case 'TLEN': {
          const ms = Number(readTextFrame(data));
          if (Number.isFinite(ms) && ms > 0) tags.duration = ms / 1000;
          break;
        }
        case 'USLT': tags.lyrics = readUnsynchronizedLyrics(data) || tags.lyrics; break;
        case 'APIC': tags.cover = readPicture(data) ?? tags.cover; break;
        case 'TXXX': {
          const value = readUserText(data);
          if (value && /lyric|歌词|歌詞/i.test(value.description)) userLyrics.push(value.value);
          if (value && /translat|翻译|翻譯/i.test(value.description)) tags.lyrics = `${tags.lyrics ?? ''}\n${value.value}`.trim();
          break;
        }
        case 'SYLT': {
          // Prefer USLT. SYLT is a raw synced lyric format that most editors
          // never produce; leave it untouched when a plain USLT exists.
          break;
        }
        default: break;
      }
    }
    offset += 10 + size;
  }

  if (!tags.lyrics && userLyrics.length) tags.lyrics = userLyrics.join('\n');
  if (!tags.title) tags.title = undefined;
  if (!tags.artist) tags.artist = undefined;
  if (!tags.album) tags.album = undefined;
  return { tags, tagSize: 10 + tagSize };
}

export function id3Version(bytes: Uint8Array): string | undefined {
  if (ascii(bytes, 0, 3) !== 'ID3') return undefined;
  return `ID3v2.${bytes[3]}.${bytes[4]}`;
}

