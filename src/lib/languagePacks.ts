import type { LanguagePack } from './types';

/**
 * Imported language packs live in localStorage so they survive a reload
 * without requiring a server-side manifest entry. Only the validated
 * `translations` dictionary is persisted; executable data is never accepted.
 */
export const IMPORTED_LANGUAGE_PACKS_KEY = 'asteria-language-packs';

export interface ImportedLanguagePack {
  code: string;
  label: string;
  nativeLabel?: string;
  translations: Record<string, string>;
  importedAt: number;
}

const CODE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function validTranslations(value: unknown): Record<string, string> {
  const source = asRecord(value);
  const translations: Record<string, string> = {};
  for (const [key, text] of Object.entries(source)) {
    if (typeof text === 'string' && key.trim()) translations[key] = text;
  }
  return translations;
}

/**
 * Parses the documented language-pack JSON. Accepts either a bare dictionary
 * under `translations` or the same object nested in a `{ version, pack }`
 * wrapper for future evolution.
 */
export function parseLanguagePackJson(source: string, fallbackCode = ''): ImportedLanguagePack {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const root = asRecord(parsed);
  const candidate = root.pack && typeof root.pack === 'object' ? root.pack : parsed;
  const pack = asRecord(candidate);
  const code = (typeof pack.code === 'string' ? pack.code.trim() : fallbackCode.trim().replace(/\.json$/i, ''));
  const translations = validTranslations(pack.translations);
  // Also accept a bare dictionary like the files in public/locales; the
  // filename supplies the code when the document has no metadata wrapper.
  if (!Object.keys(translations).length) {
    const flat = validTranslations(root);
    delete flat.code;
    delete flat.label;
    delete flat.nativeLabel;
    delete flat.version;
    Object.assign(translations, flat);
  }
  const label = (typeof pack.label === 'string' ? pack.label.trim() : '') || code.toUpperCase();
  const nativeLabel = typeof pack.nativeLabel === 'string' ? pack.nativeLabel.trim() : undefined;
  if (!CODE_PATTERN.test(code)) {
    throw new Error('`code` must look like "ja", "ko" or "pt-BR".');
  }
  if (!label) throw new Error('`label` or a filename-based code is required.');
  if (!Object.keys(translations).length) {
    throw new Error('`translations` must contain at least one string entry.');
  }
  return {
    code,
    label,
    nativeLabel,
    translations,
    importedAt: Date.now(),
  };
}

export function toLanguagePack(pack: ImportedLanguagePack): LanguagePack {
  return {
    code: pack.code,
    label: pack.label,
    nativeLabel: pack.nativeLabel,
    file: `imported:${pack.code}.json`,
    translations: pack.translations,
    source: 'imported',
  };
}

export function loadImportedLanguagePacks(): ImportedLanguagePack[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(IMPORTED_LANGUAGE_PACKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): ImportedLanguagePack | null => {
        try {
          const pack = asRecord(item);
          const code = typeof pack.code === 'string' ? pack.code : '';
          const label = typeof pack.label === 'string' ? pack.label : '';
          const translations = validTranslations(pack.translations);
          if (!CODE_PATTERN.test(code) || !label || !Object.keys(translations).length) return null;
          return {
            code,
            label,
            nativeLabel: typeof pack.nativeLabel === 'string' ? pack.nativeLabel : undefined,
            translations,
            importedAt: typeof pack.importedAt === 'number' ? pack.importedAt : Date.now(),
          } satisfies ImportedLanguagePack;
        } catch {
          return null;
        }
      })
      .filter((pack): pack is ImportedLanguagePack => pack !== null);
  } catch {
    return [];
  }
}

export function saveImportedLanguagePacks(packs: ImportedLanguagePack[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(IMPORTED_LANGUAGE_PACKS_KEY, JSON.stringify(packs));
  } catch {
    // Quota or a privacy mode can reject storage; the current session still works.
  }
}

export function mergeLanguagePacks(base: LanguagePack[], imported: ImportedLanguagePack[]): LanguagePack[] {
  const byCode = new Map(base.map((language) => [language.code, language]));
  for (const pack of imported) byCode.set(pack.code, toLanguagePack(pack));
  return [...byCode.values()];
}
