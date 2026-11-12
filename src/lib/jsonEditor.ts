export type JsonTokenType = 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'plain';

export interface JsonToken {
  type: JsonTokenType;
  text: string;
}

export interface JsonSyntaxIssue {
  message: string;
  line: number;
  column: number;
}

const TOKEN_PATTERN = /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g;

/** Best-effort JSON tokenisation for the editor overlay. Invalid text stays plain. */
export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ type: 'plain', text: text.slice(last, index) });
    const raw = match[0];
    if (match[1] && match[2]) {
      tokens.push({ type: 'key', text: match[1] });
      tokens.push({ type: 'punctuation', text: match[2] });
    } else if (raw === 'true' || raw === 'false' || raw === 'null') {
      tokens.push({ type: 'literal', text: raw });
    } else if (/^-?\d/.test(raw)) {
      tokens.push({ type: 'number', text: raw });
    } else if (raw.startsWith('"')) {
      tokens.push({ type: 'string', text: raw });
    } else {
      tokens.push({ type: 'punctuation', text: raw });
    }
    last = index + raw.length;
  }
  if (last < text.length) tokens.push({ type: 'plain', text: text.slice(last) });
  return tokens;
}

function positionAt(text: string, position: number): { line: number; column: number } {
  const safe = Math.max(0, Math.min(position, text.length));
  const before = text.slice(0, safe);
  const lastLine = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    column: safe - lastLine,
  };
}

/**
 * Lightweight live syntax validation. It does not apply schema defaults; that
 * still happens through `parseSettingsJson` when the user presses Apply.
 */
export function checkJsonSyntax(text: string): JsonSyntaxIssue | null {
  try {
    JSON.parse(text);
    return null;
  } catch (reason) {
    const raw = reason instanceof Error ? reason.message : String(reason);
    const lineColumn = raw.match(/\(line\s+(\d+)\s+column\s+(\d+)\)/i);
    const positionMatch = raw.match(/(?:at\s+)?position\s+(\d+)/i);
    const fallback = positionAt(text, positionMatch ? Number(positionMatch[1]) : text.length);
    const line = lineColumn ? Number(lineColumn[1]) : fallback.line;
    const column = lineColumn ? Number(lineColumn[2]) : fallback.column;
    const message = raw
      .replace(/,\s*"[\s\S]*"\s+is not valid JSON[\s\S]*$/i, '')
      .replace(/\s*\(line\s+\d+\s+column\s+\d+\)\s*$/i, '')
      .replace(/\s+(?:in JSON\s+)?at position\s+\d+\s*$/i, '')
      .trim() || 'Invalid JSON';
    return { message, line, column };
  }
}
