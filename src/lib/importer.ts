import type { MediaKind, SubtitleSource, Track } from './types';
import {
  extensionOf,
  guessTagsFromFileName,
  readMediaTags,
} from './metadata';
import { languageLabel, subtitleFormatFromName, subtitleLanguageFromName } from './subtitles';
import { baseName, uid } from './format';

const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'weba', 'webm', 'aiff', 'aif', 'wma']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi', 'ogv']);
const LYRIC_EXTENSIONS = new Set(['lrc', 'spl', 'txt']);
const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt', 'ass', 'ssa']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);
const SIDECAR_EXTENSIONS = new Set([
  ...LYRIC_EXTENSIONS,
  ...SUBTITLE_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  'xml',
  'json',
]);
const DANMAKU_HINTS = /(danmaku|danmu|弹幕|comment|chat)/i;

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
  if (DANMAKU_HINTS.test(name)) return true;
  if (!text) return false;
  return /<d\s+p="/.test(text) || (/^\s*\[/.test(text) && /"time"\s*:/.test(text) && /"text"\s*:/.test(text));
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
      IMAGE_EXTENSIONS.has(extension) ||
      extension === 'xml' ||
      extension === 'json'
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
    } else if (extension === 'xml' || extension === 'json') {
      candidate = normalizeStem(name.slice(0, name.lastIndexOf('.')));
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

export async function importFiles(files: File[], onProgress?: ProgressCallback): Promise<ImportResult> {
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
      let danmakuText: string | undefined;
      for (const file of group.sidecars) {
        const extension = extensionOf(file.name);
        if (extension !== 'xml' && extension !== 'json') continue;
        const text = await readText(file);
        if (isDanmaku(file.name, text)) {
          danmakuText = text;
          break;
        }
      }
      const coverFile = coverFromSidecars(group.sidecars);
      const cover = coverFile ? URL.createObjectURL(coverFile) : tags.cover;
      const guessed = guessTagsFromFileName(group.media.name);
      const src = URL.createObjectURL(group.media);
      const format = tags.format || extensionOf(group.media.name).toUpperCase();
      const track: Track = {
        id: uid('local'),
        kind,
        title: tags.title || guessed.title,
        artist: tags.artist || guessed.artist || '',
        album: tags.album,
        src,
        cover,
        duration: tags.duration ?? 0,
        sampleRate: tags.sampleRate,
        bitDepth: tags.bitDepth,
        bitrate: tags.bitrate ?? (tags.duration ? Math.round((group.media.size * 8) / tags.duration) : undefined),
        format,
        fileName: group.media.name,
        fileSize: group.media.size,
        file: group.media,
        source: 'local',
        lyrics,
        lyricsFormat: mainLyricFile ? (extensionOf(mainLyricFile.name) === 'spl' ? 'spl' : 'lrc') : undefined,
        embeddedLyrics: tags.lyrics,
        translation,
        subtitles: subtitles.length ? subtitles : undefined,
        danmakuText,
        addedAt: Date.now(),
      };
      tracks.push(track);
    } catch (error) {
      warnings.push(`${group.media.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  onProgress?.(groups.length, groups.length, '');
  return { tracks, warnings };
}

export function revokeTrackUrls(track: Track): void {
  if (track.src.startsWith('blob:')) URL.revokeObjectURL(track.src);
  if (track.cover?.startsWith('blob:')) URL.revokeObjectURL(track.cover);
}

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const items = Array.from(dataTransfer.items);
  const entries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null);
  if (!entries.length) return Array.from(dataTransfer.files);

  const readEntry = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      files.push(file);
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // Directory readers return entries in batches; keep reading until empty.
      for (;;) {
        const children = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        if (!children.length) break;
        for (const child of children) await readEntry(child);
      }
    }
  };

  for (const entry of entries) await readEntry(entry);
  return files.length ? files : Array.from(dataTransfer.files);
}
