import type { LyricLine, LyricWord, LyricsDocument } from './types';

/**
 * LRC + SPL (Salt Player Lyrics) parser.
 *
 * Supports:
 *  - standard LRC timestamps and metadata
 *  - repeated line timestamps: [00:10][00:30]text
 *  - SPL word timings: [00:10]Hello [00:11]world[00:12]
 *  - SPL delayed word timings: <00:11>world
 *  - SPL translations: same-timestamp follow-up lines or bare follow-up lines
 *  - LRC offset metadata
 *  - LX Music `awlrc` compatibility fields (ignored)
 */

const META_KEYS = new Set([
  'ti', 'ar', 'al', 'by', 'offset', 'length', 're', 've', 'tool', 'encoding', 'id',
]);

const LEADING_TIME = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,6}))?\]/;
const INLINE_TIME = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,6}))?>|\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,6}))?\]/g;

export interface ParseLyricsOptions {
  duration?: number;
  /** Metadata value used when the file does not contain [offset:]. */
  defaultOffset?: number;
}

interface ParsedLine {
  start: number;
  text: string;
  words: LyricWord[];
  explicitEnd?: number;
  translation?: string;
  translationWords?: LyricWord[];
}

function fractionToMs(fraction?: string): number {
  if (!fraction) return 0;
  const digits = fraction.replace(/\D/g, '');
  if (!digits) return 0;
  const value = Number(digits);
  if (digits.length < 3) return value * 10 ** (3 - digits.length);
  return value / 10 ** (digits.length - 3);
}

function toSeconds(minutes: string, seconds: string, fraction?: string): number {
  return Number(minutes) * 60 + Number(seconds) + fractionToMs(fraction) / 1000;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isAwlrcField(line: string): boolean {
  const trimmed = line.trim();
  if (!/^\[awlrc:/i.test(trimmed) || !trimmed.endsWith(']')) return false;
  const inner = trimmed.slice(1, -1);
  return /(?:^|,)(?:lrc|awlrc|tlrc|rlrc):[A-Za-z0-9+/]+={0,2}(?:,|$)/i.test(inner);
}

function readMetadata(line: string): { key: string; value: string } | null {
  const match = /^\[([A-Za-z][\w-]*):([\s\S]*)\]$/.exec(line.trim());
  if (!match) return null;
  const key = match[1].toLowerCase();
  if (!META_KEYS.has(key)) return null;
  return { key, value: match[2].trim() };
}

function trimWords(words: LyricWord[]): LyricWord[] {
  if (words.length === 0) return words;
  const copy = words.map((word) => ({ ...word }));
  copy[0].text = copy[0].text.replace(/^\s+/, '');
  copy[copy.length - 1].text = copy[copy.length - 1].text.replace(/\s+$/, '');
  return copy.filter((word) => word.text.length > 0 || words.length === 1);
}

/**
 * Split a line body into timed chunks. A trailing timestamp is treated as the
 * explicit line end, per the SPL specification.
 */
function parseBody(body: string, lineStart: number): { words: LyricWord[]; explicitEnd?: number; text: string } {
  const words: LyricWord[] = [];
  let lastIndex = 0;
  let wordStart = lineStart;
  let explicitEnd: number | undefined;
  INLINE_TIME.lastIndex = 0;
  let match = INLINE_TIME.exec(body);
  while (match) {
    const stamp = match[1]
      ? toSeconds(match[1], match[2], match[3])
      : toSeconds(match[4] ?? '0', match[5] ?? '0', match[6]);
    const chunk = body.slice(lastIndex, match.index);
    if (chunk.trim()) {
      // Ignore out-of-order markers the same way Salt Player does.
      if (stamp > wordStart) {
        words.push({ text: chunk, start: wordStart, end: stamp });
        wordStart = stamp;
      } else {
        const previous = words[words.length - 1];
        if (previous) previous.text += chunk;
        else words.push({ text: chunk, start: wordStart, end: wordStart });
      }
    } else if (stamp > wordStart) {
      wordStart = stamp;
    }
    lastIndex = match.index + match[0].length;
    const rest = body.slice(lastIndex);
    if (!rest.trim()) {
      explicitEnd = Math.max(stamp, lineStart);
    }
    match = INLINE_TIME.exec(body);
  }

  const tail = body.slice(lastIndex);
  if (tail.trim() || words.length === 0) {
    words.push({ text: tail, start: wordStart, end: Number.POSITIVE_INFINITY });
  } else {
    explicitEnd = Math.max(wordStart, explicitEnd ?? wordStart);
  }

  const trimmed = trimWords(words);
  const text = trimmed.map((word) => word.text).join('').trim();
  return { words: trimmed, explicitEnd, text };
}

function appendTranslation(line: ParsedLine, text: string, words?: LyricWord[]): void {
  if (!text.trim()) return;
  line.translation = line.translation ? `${line.translation}\n${text.trim()}` : text.trim();
  if (words?.length) {
    const existing = line.translationWords ?? [];
    const shifted = words.map((word) => ({ ...word }));
    line.translationWords = existing.concat(shifted);
  }
}

function finalize(
  parsed: ParsedLine[],
  meta: Record<string, string>,
  offsetSeconds: number,
  duration: number | undefined,
  endMarkers: number[],
  source: LyricsDocument['source'],
): LyricsDocument {
  const shiftedMarkers = endMarkers
    .map((marker) => Math.max(0, marker + offsetSeconds))
    .sort((a, b) => a - b);
  const translated = parsed
    .filter((line) => !duration || duration <= 0 || line.start < duration + 0.5)
    .map((line) => ({
      ...line,
      start: Math.max(0, line.start + offsetSeconds),
      explicitEnd: line.explicitEnd === undefined ? undefined : Math.max(0, line.explicitEnd + offsetSeconds),
      words: line.words.map((word) => ({
        ...word,
        start: Math.max(0, word.start + offsetSeconds),
        end: Number.isFinite(word.end) ? Math.max(0, word.end + offsetSeconds) : word.end,
      })),
      translationWords: line.translationWords?.map((word) => ({
        ...word,
        start: Math.max(0, word.start + offsetSeconds),
        end: Number.isFinite(word.end) ? Math.max(0, word.end + offsetSeconds) : word.end,
      })),
    }))
    .sort((a, b) => a.start - b.start);

  const lines: LyricLine[] = translated.map((line, index) => {
    const nextStart = translated[index + 1]?.start;
    const fallbackEnd = duration && duration > line.start ? duration : line.start + 8;
    const markerEnd = shiftedMarkers.find((marker) => marker > line.start + 0.01 && (!nextStart || marker <= nextStart));
    let end = Math.max(
      line.start + 0.05,
      line.explicitEnd ?? markerEnd ?? nextStart ?? fallbackEnd,
    );
    if (duration && duration > 0) end = Math.min(end, Math.max(line.start + 0.05, duration));
    const words = line.words.length
      ? line.words.map((word, wordIndex) => ({
          ...word,
          start: Math.min(Math.max(word.start, line.start), end),
          end: Math.min(
            Math.max(
              Number.isFinite(word.end) ? word.end : (line.words[wordIndex + 1]?.start ?? end),
              line.start,
            ),
            end,
          ),
        }))
      : [{ text: line.text, start: line.start, end }];
    return {
      id: index,
      start: line.start,
      end,
      text: line.text,
      translation: line.translation,
      words,
      translationWords: line.translationWords,
    };
  });

  let plainText = parsed.map((line) => `${line.text}${line.translation ? `\n${line.translation}` : ''}`).join('\n');
  if (!lines.length) {
    plainText = parsed.map((line) => line.text).join('\n');
  }

  return {
    lines,
    synced: lines.length > 0,
    plainText,
    meta,
    offset: offsetSeconds * 1000,
    source,
  };
}

export function parseLyrics(
  raw: string,
  options: ParseLyricsOptions = {},
  source: LyricsDocument['source'] = 'sidecar',
): LyricsDocument {
  const meta: Record<string, string> = {};
  const body = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const entries: ParsedLine[] = [];
  const plainLines: string[] = [];
  const endMarkers: number[] = [];
  let offsetMeta = options.defaultOffset ?? 0;

  for (const sourceLine of body) {
    const line = sourceLine.trimEnd();
    if (!line.trim()) continue;
    if (isAwlrcField(line)) continue;

    const metaTag = readMetadata(line);
    if (metaTag) {
      meta[metaTag.key] = decodeEntities(metaTag.value);
      if (metaTag.key === 'offset') {
        const parsedOffset = Number(metaTag.value);
        if (Number.isFinite(parsedOffset)) offsetMeta = parsedOffset;
      }
      continue;
    }

    const starts: number[] = [];
    let rest = line;
    let match = LEADING_TIME.exec(rest);
    while (match) {
      starts.push(toSeconds(match[1], match[2], match[3]));
      rest = rest.slice(match[0].length);
      match = LEADING_TIME.exec(rest);
    }

    if (starts.length === 0) {
      if (!line.trim()) continue;
      entries.push({
        start: Number.NaN,
        text: decodeEntities(line.trim()),
        words: [],
      });
      plainLines.push(decodeEntities(line.trim()));
      continue;
    }

    // A timestamp with no text is a pure end marker in SPL; it never creates
    // a lyric line and does not participate in translation pairing.
    if (!rest.trim()) {
      endMarkers.push(...starts);
      continue;
    }

    const parsedBody = parseBody(rest, starts[0]);
    for (const start of starts) {
      const words = starts.length === 1
        ? parsedBody.words
        : parsedBody.words.map((word) => ({
            ...word,
            start: word.start + (start - starts[0]),
            end: Number.isFinite(word.end) ? word.end + (start - starts[0]) : word.end,
          }));
      entries.push({
        start,
        text: parsedBody.text,
        words,
        explicitEnd: starts.length === 1
          ? parsedBody.explicitEnd
          : parsedBody.explicitEnd === undefined
            ? undefined
            : parsedBody.explicitEnd + (start - starts[0]),
      });
    }
  }

  const timed = entries.filter((entry) => Number.isFinite(entry.start));
  if (timed.length === 0) {
    return {
      lines: [],
      synced: false,
      plainText: plainLines.join('\n'),
      meta,
      offset: offsetMeta,
      source,
    };
  }

  // Pair translations and keep the original file order.
  const mains: ParsedLine[] = [];
  for (const entry of entries) {
    if (!Number.isFinite(entry.start)) {
      const last = mains[mains.length - 1];
      if (last) appendTranslation(last, entry.text);
      continue;
    }
    const last = mains[mains.length - 1];
    if (last && Math.abs(entry.start - last.start) < 0.001) {
      appendTranslation(last, entry.text, entry.words);
      continue;
    }
    mains.push(entry);
  }

  return finalize(mains, meta, offsetMeta / 1000, options.duration, endMarkers, source);
}

export function mergeTranslation(main: LyricsDocument, rawTranslation: string): LyricsDocument {
  if (!rawTranslation.trim() || !main.lines.length) return main;
  const translation = parseLyrics(rawTranslation);
  const byStart = new Map<number, string>();
  for (const line of translation.lines) {
    const key = Math.round(line.start * 100) / 100;
    byStart.set(key, line.translation || line.text);
  }
  const plain = translation.synced ? [] : translation.plainText.split('\n').map((line) => line.trim()).filter(Boolean);

  return {
    ...main,
    lines: main.lines.map((line, index) => {
      const key = Math.round(line.start * 100) / 100;
      const matched = byStart.get(key) ?? plain[index];
      return matched && !line.translation ? { ...line, translation: matched } : line;
    }),
  };
}

/** Binary search for the line active at `time`. */
export function findActiveLineIndex(lines: LyricLine[], time: number): number {
  if (!lines.length) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].start <= time + 0.001) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

export interface WordProgress {
  text: string;
  /** 0..1 within the current word. */
  progress: number;
  /** Before the word, active inside it, or fully sung. */
  state: 'pending' | 'active' | 'done';
}

export function getWordProgress(line: LyricLine, time: number, words = line.words): WordProgress[] {
  return words.map((word) => {
    if (time >= word.end) return { text: word.text, progress: 1, state: 'done' };
    if (time < word.start) return { text: word.text, progress: 0, state: 'pending' };
    const span = Math.max(0.001, word.end - word.start);
    return { text: word.text, progress: Math.min(1, (time - word.start) / span), state: 'active' };
  });
}

export function lineProgress(line: LyricLine, time: number): number {
  if (time <= line.start) return 0;
  if (time >= line.end) return 1;
  return (time - line.start) / Math.max(0.001, line.end - line.start);
}
