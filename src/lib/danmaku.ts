import type { DanmakuComment, DanmakuMode } from './types';

const XML_ENTITY = /&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi;

function decodeXml(text: string): string {
  return text.replace(XML_ENTITY, (entity, code: string) => {
    switch (code.toLowerCase()) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      case 'nbsp': return ' ';
      default: {
        const numeric = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
      }
    }
  });
}

export function colorToHex(color: number | string | undefined): string {
  if (typeof color === 'string') {
    if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
    const parsed = Number(color);
    if (!Number.isFinite(parsed)) return '#ffffff';
    color = parsed;
  }
  if (typeof color !== 'number' || !Number.isFinite(color)) return '#ffffff';
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

function modeFromNumber(mode: number): DanmakuMode {
  if (mode === 4) return 'bottom';
  if (mode === 5) return 'top';
  return 'scroll';
}

/**
 * Parses Bilibili-style XML (`<d p="time,mode,size,color,...">text</d>`) and
 * JSON arrays ({time,text,mode,color,size}). Returns comments sorted by time.
 */
export function parseDanmaku(raw: string): DanmakuComment[] {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  const comments: DanmakuComment[] = [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { comments?: unknown }).comments)
          ? (parsed as { comments: unknown[] }).comments
          : [];
      list.forEach((item, index) => {
        if (typeof item !== 'object' || item === null) return;
        const record = item as Record<string, unknown>;
        const time = Number(record.time ?? record.t ?? record.start ?? 0);
        const text = String(record.text ?? record.content ?? record.m ?? '').trim();
        if (!Number.isFinite(time) || !text) return;
        const mode = typeof record.mode === 'string'
          ? (record.mode === 'top' || record.mode === 'bottom' ? record.mode : 'scroll')
          : modeFromNumber(Number(record.mode ?? 1));
        comments.push({
          id: `j${index}`,
          time,
          text: decodeXml(text),
          mode,
          color: colorToHex(record.color as number | string | undefined),
          size: Math.max(14, Math.min(32, Number(record.size ?? 25) * 0.8)),
        });
      });
      return comments.sort((a, b) => a.time - b.time);
    } catch {
      // Fall through to XML parsing for malformed JSON.
    }
  }

  const tag = /<d\b[^>]*\bp="([^"]*)"[^>]*>([\s\S]*?)<\/d>/gi;
  let match = tag.exec(trimmed);
  let index = 0;
  while (match) {
    const values = match[1].split(',');
    const time = Number(values[0]);
    const text = decodeXml(match[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
    if (Number.isFinite(time) && text) {
      comments.push({
        id: `x${index}`,
        time,
        text,
        mode: modeFromNumber(Number(values[1] ?? 1)),
        color: colorToHex(values[3]),
        size: Math.max(14, Math.min(32, Number(values[2] ?? 25) * 0.8)),
      });
    }
    index += 1;
    match = tag.exec(trimmed);
  }
  return comments.sort((a, b) => a.time - b.time);
}

/** Index of the first comment at or after `time`. */
export function lowerBound(comments: DanmakuComment[], time: number): number {
  let low = 0;
  let high = comments.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (comments[mid].time < time) low = mid + 1;
    else high = mid;
  }
  return low;
}
