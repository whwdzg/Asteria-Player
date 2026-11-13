/**
 * File importer. Media files are grouped with same-name sidecars; video part
 * names (P1/P2) inherit the parent folder title and keep the filename as a
 * subtitle.
 */
import type { MediaKind, SubtitleSource, Track } from './types';
import {
  extensionOf,
  guessTagsFromFileName,
  readMediaTags,
} from './metadata';
import { languageLabel, subtitleFormatFromName, subtitleLanguageFromName } from './subtitles';
import { parseDanmaku } from './danmaku';
import { baseName, uid } from './format';
import { compactImageDataUrl } from './images';

const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'weba', 'webm', 'aiff', 'aif', 'wma']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi', 'ogv']);
const LYRIC_EXTENSIONS = new Set(['lrc', 'spl', 'txt']);
// ASS is intentionally handled as danmaku, as requested by the product spec.
const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt']);
const DANMAKU_EXTENSIONS = new Set(['xml', 'json', 'ass', 'ssa']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);
const SIDECAR_EXTENSIONS = new Set([
  ...LYRIC_EXTENSIONS,
  ...SUBTITLE_EXTENSIONS,
  ...DANMAKU_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
]);
const DANMAKU_HINTS = /(danmaku|danmu|弹幕|comment|chat)/i;
const DANMAKU_PRIORITY = ['xml', 'json', 'ass', 'ssa'] as const;

/** Lower is preferred when a media file has multiple same-name danmaku files. */
export function danmakuPriority(name: string): number {
  const index = DANMAKU_PRIORITY.indexOf(extensionOf(name) as typeof DANMAKU_PRIORITY[number]);
  return index === -1 ? DANMAKU_PRIORITY.length : index;
}

/** Stable priority order: XML, JSON, ASS, SSA, then unknown. */
export function selectDanmakuFiles(files: File[]): File[] {
  return [...files].sort((a, b) => danmakuPriority(a.name) - danmakuPriority(b.name) || a.name.localeCompare(b.name));
}

export interface ImportedTrackGroup {
  track: Track;
  warnings: string[];
}

export interface ImportResult {
  tracks: Track[];
  warnings: string[];
}

type ProgressCallback = (done: number, total: number, name: string) => void;

function kindOf(file: File): MediaKind | undefined {
  const extension = extensionOf(file.name);
  // Chromium maps `.spl` to `audio/soundpadlist`, and some platforms report
  // odd MIME types for subtitles. Extension wins for known sidecar files.
  if (SIDECAR_EXTENSIONS.has(extension)) return undefined;
  if (AUDIO_EXTENSIONS.has(extension)) {
    if (extension === 'webm' && file.type.startsWith('video/')) return 'video';
    return 'audio';
  }
  if (VIDEO_EXTENSIONS.has(extension) || file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return undefined;
}

function isDanmaku(name: string, text?: string): boolean {
  const extension = extensionOf(name);
  if (extension === 'ass' || extension === 'ssa') return true;
  if (extension === 'xml') return true;
  if (DANMAKU_HINTS.test(name)) return true;
  if (!text) return false;
  return /<d\s+p="/.test(text) || (/^\s*\[/.test(text) && /"time"\s*:/.test(text) && /"text"\s*:/.test(text));
}

function danmakuBase(name: string): string {
  const stem = name.slice(0, name.lastIndexOf('.'));
  const language = subtitleLanguageFromName(name);
  const base = language.lang ? language.base : stem;
  return normalizeStem(base.replace(/[.\-_\s]+(?:danmaku|danmu|弹幕|comments?)$/i, ''));
}

function normalizeStem(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function lyricBase(name: string): { base: string; translation: boolean; lang?: string } {
  const stem = name.slice(0, name.lastIndexOf('.'));
  const translation = /(?:^|[.\-_\s])(?:trans|translation|译文|翻譯|翻译)(?:$|[.\-_\s])/i.test(stem);
  const language = subtitleLanguageFromName(name);
  const cleaned = stem
    .replace(/(?:^|[.\-_\s])(?:trans|translation|译文|翻譯|翻译)(?:$|[.\-_\s])/gi, '')
    .replace(/[.\-_\s]+$/, '');
  const base = language.lang ? language.base : cleaned;
  return { base: normalizeStem(base), translation, lang: language.lang };
}

interface MediaGroup {
  media: File;
  path: string;
  base: string;
  sidecars: File[];
}

function parentFolder(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : '';
}

/** P1, P2, Part 3, 第4P and similar multi-part video names. */
export function isPartVideoName(stem: string): boolean {
  return /^p\s*\d+(?:[.\-_\s].*)?$/i.test(stem)
    || /^part\s*\d+/i.test(stem)
    || /^第?\d+p$/i.test(stem)
    || /^\d+/.test(stem);
}

/**
 * Imports in folders such as `My Show/P1.mp4` should keep the folder as the
 * title and show the filename as a subtitle instead of treating P1 as a title.
 */
export function deriveVideoLabels(fileName: string, path: string): { title?: string; subtitle?: string } {
  const stem = fileName.slice(0, fileName.lastIndexOf('.'));
  if (!isPartVideoName(stem)) return {};
  const folder = parentFolder(path).trim();
  return {
    title: folder || undefined,
    subtitle: stem,
  };
}

function filePath(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relative && relative.length > 0 ? relative : file.name;
}

function groupFiles(files: File[]): { groups: MediaGroup[]; orphans: string[] } {
  const media = files
    .filter((file) => kindOf(file) !== undefined)
    .map((file) => {
      const path = filePath(file);
      const name = baseName(path);
      const stem = name.slice(0, name.lastIndexOf('.'));
      return { media: file, path, base: normalizeStem(stem), sidecars: [] as File[] } satisfies MediaGroup;
    })
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

  const sidecars = files.filter((file) => {
    const extension = extensionOf(file.name);
    return (
      LYRIC_EXTENSIONS.has(extension) ||
      SUBTITLE_EXTENSIONS.has(extension) ||
      DANMAKU_EXTENSIONS.has(extension) ||
      IMAGE_EXTENSIONS.has(extension)
    );
  });
  const orphans: string[] = [];

  for (const sidecar of sidecars) {
    const path = filePath(sidecar);
    const name = baseName(path);
    const extension = extensionOf(name);
    let candidate = '';
    if (extension === 'lrc' || extension === 'spl' || extension === 'txt') {
      candidate = lyricBase(name).base;
    } else if (SUBTITLE_EXTENSIONS.has(extension)) {
      candidate = normalizeStem(subtitleLanguageFromName(name).base);
    } else if (DANMAKU_EXTENSIONS.has(extension)) {
      candidate = danmakuBase(name);
    } else if (IMAGE_EXTENSIONS.has(extension)) {
      candidate = normalizeStem(name.slice(0, name.lastIndexOf('.')));
    }

    const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    let match = media
      .filter((group) => group.base === candidate || group.base.startsWith(`${candidate} `) || candidate.startsWith(`${group.base} `))
      .filter((group) => {
        const groupDirectory = group.path.includes('/') ? group.path.slice(0, group.path.lastIndexOf('/')) : '';
        return !directory || !groupDirectory || groupDirectory === directory;
      })
      .sort((a, b) => b.base.length - a.base.length)[0];

    // Some collections prefix the cover with "cover" instead of the track name.
    if (!match && IMAGE_EXTENSIONS.has(extension) && /^(cover|folder|front|albumart)$/i.test(candidate)) {
      match = media[0];
    }

    if (match) match.sidecars.push(sidecar);
    else orphans.push(name);
  }

  return { groups: media, orphans };
}

function coverFromSidecars(files: File[]): File | undefined {
  return files.find((file) => IMAGE_EXTENSIONS.has(extensionOf(file.name)));
}

async function readText(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) return '';
  return file.text();
}

export async function importFiles(
  files: File[],
  onProgress?: ProgressCallback,
  onTrack?: (track: Track) => void,
): Promise<ImportResult> {
  const unique = Array.from(new Map(files.map((file) => [`${filePath(file)}:${file.size}:${file.lastModified}`, file])).values());
  const { groups, orphans } = groupFiles(unique);
  const tracks: Track[] = [];
  const warnings: string[] = [];
  if (orphans.length) warnings.push(...orphans.slice(0, 5));

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    onProgress?.(index, groups.length, group.media.name);
    try {
      const kind = kindOf(group.media);
      if (!kind) continue;
      const tags = await readMediaTags(group.media);
      const lyricFiles = group.sidecars.filter((file) => LYRIC_EXTENSIONS.has(extensionOf(file.name)));
      const translationFile = lyricFiles.find((file) => lyricBase(baseName(file.name)).translation);
      const mainLyricFile = lyricFiles
        .filter((file) => file !== translationFile)
        .sort((a, b) => {
          const priority = (file: File): number => (extensionOf(file.name) === 'spl' ? 0 : extensionOf(file.name) === 'lrc' ? 1 : 2);
          return priority(a) - priority(b);
        })[0];
      const lyrics = mainLyricFile ? await readText(mainLyricFile) : undefined;
      const translation = translationFile ? await readText(translationFile) : undefined;
      const subtitleFiles = group.sidecars.filter((file) => SUBTITLE_EXTENSIONS.has(extensionOf(file.name)));
      const subtitles: SubtitleSource[] = [];
      for (const file of subtitleFiles) {
        const info = subtitleLanguageFromName(file.name);
        const text = await readText(file);
        if (!text.trim()) continue;
        const id = `${uid('sub')}`;
        subtitles.push({
          id,
          lang: info.lang ?? 'und',
          label: info.lang ? languageLabel(info.lang) : baseName(file.name),
          text,
          format: subtitleFormatFromName(file.name),
        });
      }
      // Use exactly one danmaku file: XML > JSON > ASS > SSA. If the preferred
      // file is empty/malformed, fall through to the next one without merging.
      let danmakuText: string | undefined;
      const danmakuFiles = selectDanmakuFiles(group.sidecars.filter((file) => DANMAKU_EXTENSIONS.has(extensionOf(file.name))));
      for (const file of danmakuFiles) {
        const text = await readText(file);
        if (!isDanmaku(file.name, text)) continue;
        try {
          const comments = parseDanmaku(text);
          if (comments.length) {
            danmakuText = JSON.stringify(comments);
            break;
          }
        } catch {
          // A malformed XML/JSON/ASS file should not block the media import.
        }
      }
      const coverFile = coverFromSidecars(group.sidecars);
      const cover = coverFile
        ? URL.createObjectURL(coverFile)
        : await compactImageDataUrl(tags.cover);
      const guessed = guessTagsFromFileName(group.media.name);
      const videoLabels = kind === 'video' ? deriveVideoLabels(group.media.name, group.path) : {};
      const src = URL.createObjectURL(group.media);
      const format = tags.format || extensionOf(group.media.name).toUpperCase();
      const track: Track = {
        id: uid('local'),
        kind,
        title: videoLabels.title || tags.title || guessed.title,
        subtitle: videoLabels.subtitle,
        artist: tags.artist || guessed.artist || '',
        album: tags.album,
        src,
        cover,
        duration: tags.duration ?? 0,
        sampleRate: tags.sampleRate,
        bitDepth: tags.bitDepth,
        discNumber: tags.discNumber,
        trackNumber: tags.trackNumber,
        bitrate: tags.bitrate ?? (tags.duration ? Math.round((group.media.size * 8) / tags.duration) : undefined),
        format,
        fileName: group.media.name,
        fileSize: group.media.size,
        source: 'local',
        lyrics,
        lyricsEncoding: lyrics ? 'UTF-8' : undefined,
        lyricsFormat: mainLyricFile ? (extensionOf(mainLyricFile.name) === 'spl' ? 'spl' : 'lrc') : undefined,
        embeddedLyrics: tags.lyrics,
        translation,
        subtitles: subtitles.length ? subtitles : undefined,
        danmakuText,
        addedAt: Date.now(),
      };
      if (onTrack) onTrack(track);
      else tracks.push(track);
    } catch (error) {
      warnings.push(`${group.media.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  onProgress?.(groups.length, groups.length, '');
  return { tracks, warnings };
}
