import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Track } from './types';
import { uid } from './format';

export const PACK_FORMAT = 'asteria-player-pack';
export const PACK_VERSION = 1;

interface PackTracker extends Omit<Track, 'src' | 'cover' | 'source' | 'addedAt'> {
  id: string;
  media: string;
  coverFile?: string;
}

interface PackManifest {
  format: typeof PACK_FORMAT;
  version: typeof PACK_VERSION;
  exportedAt: number;
  playlist: { name: string; trackIds: string[] };
  tracks: PackTracker[];
}

export interface ImportedPack {
  name: string;
  tracks: Track[];
  trackIds: string[];
}

function safeName(value: string): string {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'track';
}

function extensionFromMime(type: string, fallback: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/flac': 'flac',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/webm': 'weba',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[type] ?? fallback;
}

function mimeFromExtension(extension: string): string {
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    flac: 'audio/flac',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/opus',
    webm: 'video/webm',
    weba: 'audio/webm',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mov: 'video/quicktime',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
  };
  return map[extension] ?? 'application/octet-stream';
}

function formatExtension(format: string | undefined, kind: Track['kind']): string {
  return format?.toLowerCase().replace(/[^a-z0-9]/g, '') || (kind === 'video' ? 'mp4' : 'mp3');
}

function extensionFromUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    const path = new URL(url, document.baseURI).pathname;
    const match = path.match(/\.([a-zA-Z0-9]{2,5})$/);
    return match ? match[1].toLowerCase() : fallback;
  } catch {
    return fallback;
  }
}

async function readBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

async function readText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function blobBytes(url: string): Promise<{ bytes: Uint8Array; blob: Blob }> {
  const blob = await readBlob(url);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), blob };
}

/** Builds a ZIP-compatible .astpp archive with the playlist and source media. */
export async function createAsteriaPack(tracks: Track[], playlistName: string): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const entries: PackTracker[] = [];
  const trackIds: string[] = [];

  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    let media: Uint8Array;
    let mediaBlob: Blob;
    try {
      ({ bytes: media, blob: mediaBlob } = await blobBytes(track.src));
    } catch {
      throw new Error(`Could not read media: ${track.title}`);
    }
    const mediaExtension = extensionFromUrl(
      track.src,
      extensionFromMime(mediaBlob.type, formatExtension(track.format, track.kind)),
    );
    const mediaPath = `media/${String(index + 1).padStart(3, '0')}-${safeName(track.id)}.${mediaExtension}`;
    files[mediaPath] = media;

    let coverFile: string | undefined;
    if (track.cover) {
      try {
        const cover = await blobBytes(track.cover);
        const coverExtension = extensionFromUrl(track.cover, extensionFromMime(cover.blob.type, 'jpg'));
        coverFile = `covers/${String(index + 1).padStart(3, '0')}-${safeName(track.id)}.${coverExtension}`;
        files[coverFile] = cover.bytes;
      } catch {
        // A missing cover is not a reason to lose the media.
      }
    }

    const metadata = { ...track } as Partial<Track>;
    delete metadata.src;
    delete metadata.cover;
    delete metadata.source;
    delete metadata.addedAt;
    if (!metadata.lyrics && track.lyricsUrl) {
      try {
        metadata.lyrics = await readText(track.lyricsUrl);
        if (!metadata.lyricsFormat) metadata.lyricsFormat = extensionFromUrl(track.lyricsUrl, 'lrc') === 'spl' ? 'spl' : 'lrc';
        delete metadata.lyricsUrl;
      } catch {
        delete metadata.lyricsUrl;
      }
    }
    if (metadata.subtitles?.length) {
      metadata.subtitles = await Promise.all(metadata.subtitles.map(async (subtitle) => {
        if (!subtitle.src || subtitle.text) return subtitle;
        try {
          const text = await readText(subtitle.src);
          const { src: _subtitleSrc, ...rest } = subtitle;
          const format = extensionFromUrl(subtitle.src, 'srt');
          return { ...rest, text, format: rest.format ?? (format === 'vtt' ? 'vtt' : format === 'ass' ? 'ass' : 'srt') };
        } catch {
          const { src: _subtitleSrc, ...rest } = subtitle;
          return rest;
        }
      }));
    }
    if (!metadata.danmakuText && track.danmakuUrl) {
      try {
        metadata.danmakuText = await readText(track.danmakuUrl);
        delete metadata.danmakuUrl;
      } catch {
        delete metadata.danmakuUrl;
      }
    }
    entries.push({
      ...(metadata as unknown as Omit<PackTracker, 'id' | 'media' | 'coverFile'>),
      id: track.id,
      media: mediaPath,
      ...(coverFile ? { coverFile } : {}),
    });
    trackIds.push(track.id);
  }

  const manifest: PackManifest = {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    exportedAt: Date.now(),
    playlist: { name: playlistName, trackIds },
    tracks: entries,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files, { level: 0 });
}

export function isAsteriaPackFile(name: string): boolean {
  return /\.astpp$/i.test(name);
}

/** Parses a pack into fresh tracks with blob-backed media and a mapped playlist. */
export async function readAsteriaPack(file: File): Promise<ImportedPack> {
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifestBytes = zip['manifest.json'];
  if (!manifestBytes) throw new Error('Pack is missing manifest.json');
  const manifest = JSON.parse(strFromU8(manifestBytes)) as Partial<PackManifest>;
  if (manifest.format !== PACK_FORMAT || manifest.version !== PACK_VERSION || !Array.isArray(manifest.tracks)) {
    throw new Error('Unsupported Asteria Player pack');
  }

  const idMap = new Map<string, string>();
  const tracks: Track[] = [];
  const urls: string[] = [];
  try {
    for (const entry of manifest.tracks) {
      const mediaBytes = zip[entry.media];
      if (!mediaBytes) continue;
      const mediaType = extensionFromUrl(entry.media, 'mp3');
      const blob = new Blob([mediaBytes], { type: mimeFromExtension(mediaType) });
      const src = URL.createObjectURL(blob);
      urls.push(src);
      let cover: string | undefined;
      if (entry.coverFile && zip[entry.coverFile]) {
        const coverType = extensionFromUrl(entry.coverFile, 'jpg');
        cover = URL.createObjectURL(new Blob([zip[entry.coverFile]], { type: mimeFromExtension(coverType) }));
        urls.push(cover);
      }
      const newId = uid('local');
      idMap.set(entry.id, newId);
      const { media: _media, coverFile: _coverFile, id: _id, ...metadata } = entry;
      tracks.push({
        ...metadata,
        id: newId,
        src,
        cover,
        source: 'local',
        addedAt: Date.now(),
        fileName: metadata.fileName ?? `${safeName(entry.id)}.${mediaType}`,
      });
    }
  } catch (error) {
    for (const url of urls) URL.revokeObjectURL(url);
    throw error;
  }

  const trackIds = (manifest.playlist?.trackIds ?? [])
    .map((id) => idMap.get(id))
    .filter((id): id is string => Boolean(id));
  return {
    name: manifest.playlist?.name?.trim() || file.name.replace(/\.astpp$/i, ''),
    tracks,
    trackIds,
  };
}

/** Small helper shared by the export dialog and tests. */
export function packFileName(name: string): string {
  return `${safeName(name)}.astpp`;
}
