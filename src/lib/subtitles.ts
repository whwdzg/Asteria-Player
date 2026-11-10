import { baseName, stripExtension } from './format';
import type { SubtitleCue, SubtitleFormat, SubtitleSource } from './types';

export interface ParsedSubtitle {
  format: SubtitleFormat;
  cues: SubtitleCue[];
  lang?: string;
}

const SRT_TIME = /(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})/;

function seconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
}

function cleanText(text: string): string {
  return text
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

export function parseSrt(raw: string): SubtitleCue[] {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  blocks.forEach((block) => {
    const lines = block.split('\n');
    if (!lines.length) return;
    let timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) return;
    // SRT cue numbering may be missing. VTT may prefix NOTE/STYLE blocks.
    const upper = block.trim().toUpperCase();
    if (upper.startsWith('NOTE') || upper.startsWith('STYLE') || upper.startsWith('REGION')) return;
    const match = SRT_TIME.exec(lines[timeIndex]);
    if (!match) return;
    timeIndex += 1;
    const text = cleanText(lines.slice(timeIndex).join('\n'));
    if (!text) return;
    const start = seconds(match[1], match[2], match[3], match[4]);
    const end = seconds(match[5], match[6], match[7], match[8]);
    if (end <= start) return;
    cues.push({ id: cues.length, start, end, text });
  });
  return cues.sort((a, b) => a.start - b.start);
}

export function parseVtt(raw: string): SubtitleCue[] {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const first = (lines[0] ?? '').trim().toUpperCase();
    if (!lines.length || first.startsWith('WEBVTT') || first.startsWith('NOTE') || first.startsWith('STYLE') || first.startsWith('REGION')) {
      continue;
    }
    const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeLineIndex < 0) continue;
    const match = SRT_TIME.exec(lines[timeLineIndex]);
    if (!match) continue;
    const text = cleanText(lines.slice(timeLineIndex + 1).join('\n'));
    if (!text) continue;
    const start = seconds(match[1], match[2], match[3], match[4]);
    const end = seconds(match[5], match[6], match[7], match[8]);
    if (end <= start) continue;
    cues.push({ id: cues.length, start, end, text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function parseAss(raw: string): SubtitleCue[] {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  let inEvents = false;
  let fields: string[] = [];
  const cues: SubtitleCue[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\[events\]/i.test(trimmed)) {
      inEvents = true;
      continue;
    }
    if (trimmed.startsWith('[') && !/^\[events\]/i.test(trimmed)) {
      if (inEvents) inEvents = false;
      continue;
    }
    if (!inEvents) continue;
    if (/^format\s*:/i.test(trimmed)) {
      fields = trimmed.slice(trimmed.indexOf(':') + 1).split(',').map((part) => part.trim().toLowerCase());
      continue;
    }
    if (!/^dialogue\s*:/i.test(trimmed) || !fields.length) continue;
    const payload = trimmed.slice(trimmed.indexOf(':') + 1);
    const parts: string[] = [];
    let current = '';
    let textFieldIndex = fields.indexOf('text');
    if (textFieldIndex < 0) textFieldIndex = fields.length - 1;
    for (let i = 0; i < payload.length; i += 1) {
      if (payload[i] === ',' && parts.length < textFieldIndex) {
        parts.push(current);
        current = '';
      } else {
        current += payload[i];
      }
    }
    parts.push(current);
    const startRaw = parts[fields.indexOf('start')] ?? '';
    const endRaw = parts[fields.indexOf('end')] ?? '';
    const textRaw = parts[textFieldIndex] ?? '';
    const toSeconds = (value: string): number => {
      const match = /(\d+):(\d{1,2}):(\d{1,2})(?:[.:](\d{1,2}))?/.exec(value.trim());
      if (!match) return Number.NaN;
      return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number((match[4] ?? '0').padEnd(2, '0')) / 100;
    };
    const start = toSeconds(startRaw);
    const end = toSeconds(endRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const text = cleanText(
      textRaw
        .replace(/\\N/gi, '\n')
        .replace(/\\n/gi, '\n')
        .replace(/\\h/gi, ' '),
    );
    if (!text) continue;
    cues.push({ id: cues.length, start, end, text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function parseSubtitle(raw: string, format?: SubtitleFormat): ParsedSubtitle {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  let detected = format;
  if (!detected) {
    if (/^WEBVTT/i.test(trimmed)) detected = 'vtt';
    else if (/^\[Script Info\]/i.test(trimmed) || /^Dialogue\s*:/im.test(trimmed)) detected = 'ass';
    else detected = 'srt';
  }
  if (detected === 'vtt') return { format: 'vtt', cues: parseVtt(trimmed) };
  if (detected === 'ass') return { format: 'ass', cues: parseAss(trimmed) };
  return { format: 'srt', cues: parseSrt(trimmed) };
}

export function subtitleFormatFromName(name: string): SubtitleFormat | undefined {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'srt' || extension === 'vtt' || extension === 'ass' || extension === 'ssa') {
    return extension === 'ssa' ? 'ass' : extension;
  }
  return undefined;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  zh: 'zh-CN',
  zho: 'zh-CN',
  chi: 'zh-CN',
  chs: 'zh-CN',
  cn: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  sc: 'zh-CN',
  cht: 'zh-TW',
  tc: 'zh-TW',
  'zh-tw': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-hant': 'zh-TW',
  en: 'en',
  eng: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  ja: 'ja',
  jpn: 'ja',
  jp: 'ja',
  ko: 'ko',
  kor: 'ko',
  fr: 'fr',
  fre: 'fr',
  de: 'de',
  ger: 'de',
  es: 'es',
  ru: 'ru',
  pt: 'pt',
};

export const LANGUAGE_LABELS: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  pt: 'Português',
  auto: 'Auto',
  off: 'Off',
};

export function normalizeLanguage(value: string): string | undefined {
  return LANGUAGE_ALIASES[value.trim().toLowerCase()];
}

export function languageLabel(code: string): string {
  if (LANGUAGE_LABELS[code]) return LANGUAGE_LABELS[code];
  try {
    return new Intl.DisplayNames(undefined, { type: 'language' }).of(code) ?? code;
  } catch {
    return code.toUpperCase();
  }
}

/** Extracts `movie.zh-CN.srt` → { base: movie, lang: zh-CN }. */
export function subtitleLanguageFromName(fileName: string): { base: string; lang?: string } {
  const name = baseName(fileName);
  const stem = stripExtension(name);
  const parts = stem.split('.');
  if (parts.length < 2) return { base: stem };
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const candidate = parts.slice(i).join('-');
    const normalized = normalizeLanguage(candidate);
    if (normalized) {
      return { base: parts.slice(0, i).join('.'), lang: normalized };
    }
  }
  return { base: stem };
}

export function makeSubtitleSource(
  text: string,
  options: { id: string; lang?: string; label?: string; fileName?: string; format?: SubtitleFormat },
): SubtitleSource {
  return {
    id: options.id,
    lang: options.lang ?? 'und',
    label: options.label ?? (options.lang ? languageLabel(options.lang) : options.fileName ?? 'Subtitles'),
    text,
    format: options.format,
  };
}

export function activeCue(cues: SubtitleCue[], time: number): SubtitleCue | undefined {
  let low = 0;
  let high = cues.length - 1;
  let result: SubtitleCue | undefined;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= time) {
      result = cues[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (result && time <= result.end) return result;
  return undefined;
}

export function pickSubtitleLanguage(
  subtitles: SubtitleSource[] | undefined,
  preference: string,
  systemLanguages: readonly string[],
): SubtitleSource | undefined {
  if (!subtitles?.length || preference === 'off') return undefined;
  if (preference && preference !== 'auto') {
    return subtitles.find((subtitle) => subtitle.lang === preference || subtitle.lang.startsWith(`${preference}-`));
  }
  for (const systemLanguage of systemLanguages) {
    const match = subtitles.find(
      (subtitle) => subtitle.lang === systemLanguage || subtitle.lang.startsWith(`${systemLanguage}-`) || systemLanguage.startsWith(`${subtitle.lang}-`),
    );
    if (match) return match;
  }
  return subtitles[0];
}
