import type { MediaTags } from '../types';
import { baseName, stripExtension } from '../format';
import { ascii, u32be } from './bytes';
import { parseId3 } from './id3';
import { parseFlac } from './flac';
import { parseMp4, parseWav } from './mp4';

const MP3_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MP3_RATES = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
} as const;

/** Finds the first MPEG Layer III frame and reads its sample rate/bitrate. */
export function parseMp3Frame(bytes: Uint8Array, start = 0): Partial<MediaTags> {
  const end = Math.min(bytes.length - 4, start + 512 * 1024);
  for (let i = start; i < end; i += 1) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;
    const versionBits = (bytes[i + 1] >> 3) & 0x03;
    const layerBits = (bytes[i + 1] >> 1) & 0x03;
    if (layerBits !== 1 || versionBits === 1) continue;
    const bitrateIndex = (bytes[i + 2] >> 4) & 0x0f;
    const rateIndex = (bytes[i + 2] >> 2) & 0x03;
    if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) continue;
    const rates = MP3_RATES[versionBits as 0 | 2 | 3];
    const table = versionBits === 3 ? MP3_BITRATES_V1_L3 : MP3_BITRATES_V2_L3;
    return { sampleRate: rates[rateIndex], bitrate: table[bitrateIndex] * 1000 };
  }
  return {};
}

export function extensionOf(fileName: string): string {
  const at = fileName.lastIndexOf('.');
  return at >= 0 ? fileName.slice(at + 1).toLowerCase() : '';
}

export function guessTagsFromFileName(fileName: string): { title: string; artist?: string } {
  let stem = stripExtension(baseName(fileName)).replace(/^\d{1,3}[\s._-]+/, '').trim();
  stem = stem.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*(?:official|lyrics|mv|audio)[^)]*\)/gi, '').trim();
  const dash = stem.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) {
    return { artist: dash[0].trim(), title: dash.slice(1).join(' - ').trim() };
  }
  return { title: stem || baseName(fileName) };
}

export async function readMediaTags(file: File): Promise<MediaTags> {
  const extension = extensionOf(file.name);
  const format = extension === 'm4a' || extension === 'mp4' || extension === 'mov'
    ? extension.toUpperCase()
    : extension === 'mp3'
      ? 'MP3'
      : extension === 'flac'
        ? 'FLAC'
        : extension.toUpperCase();
  const headSize = Math.min(file.size, 12 * 1024 * 1024);
  const head = new Uint8Array(await file.slice(0, headSize).arrayBuffer());
  let tags: MediaTags = {};

  if (ascii(head, 0, 3) === 'ID3') {
    const id3 = parseId3(head);
    if (id3) {
      tags = { ...id3.tags };
      Object.assign(tags, parseMp3Frame(head, id3.tagSize));
    }
  } else if (ascii(head, 0, 4) === 'fLaC') {
    tags = { ...(parseFlac(head) ?? {}) };
  } else if (ascii(head, 4, 4) === 'ftyp') {
    tags = { ...(parseMp4(head) ?? {}) };
  } else if (ascii(head, 0, 4) === 'RIFF') {
    tags = { ...(parseWav(head) ?? {}) };
  } else if (ascii(head, 0, 4) === 'OggS') {
    tags = parseOgg(head);
  }

  if (!tags.title || !tags.artist) {
    const guessed = guessTagsFromFileName(file.name);
    if (!tags.title) tags.title = guessed.title;
    if (!tags.artist && guessed.artist) tags.artist = guessed.artist;
  }
  tags.format = format || tags.format;
  if (tags.sampleRate && !tags.bitrate && tags.duration) {
    // Fallback for uncompressed containers.
    tags.bitrate = Math.round((file.size * 8) / tags.duration);
  }
  return tags;
}

/** Minimal Ogg Vorbis/Opus header + Vorbis comment reader. */
const tagNumber = (value: string): number | undefined => {
  const parsed = Number.parseInt(value.split('/')[0] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function parseOgg(bytes: Uint8Array): MediaTags {
  const tags: MediaTags = {};
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 512 * 1024)));
  const rateMatch = /(?:vorbis|OpusHead)[\s\S]{0,40}?/.exec(text);
  if (rateMatch) {
    // Vorbis identification headers are binary; the sample rate lives at a
    // fixed offset after the packet signature.
    const index = text.indexOf('\u0001vorbis');
    if (index >= 0) tags.sampleRate = u32be(bytes, index + 12);
  }
  const comment = /vorbis[\s\S]*?\u0003vorbis([\s\S]{0,20000})/.exec(text);
  if (comment) {
    const values = comment[1].split('\u0000');
    for (const value of values) {
      const [key, ...rest] = value.split('=');
      const payload = rest.join('=').trim();
      if (!payload) continue;
      if (key === 'TITLE') tags.title = payload;
      if (key === 'ARTIST') tags.artist = payload;
      if (key === 'ALBUM') tags.album = payload;
      if (key === 'TRACKNUMBER') tags.trackNumber = tagNumber(payload);
      if (key === 'DISCNUMBER') tags.discNumber = tagNumber(payload);
      if (key === 'LYRICS' || key === 'UNSYNCEDLYRICS') tags.lyrics = payload;
    }
  }
  return tags;
}

export { parseId3, parseFlac, parseMp4, parseWav };
