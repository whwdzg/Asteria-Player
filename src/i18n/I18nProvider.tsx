import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LanguagePack } from '../lib/types';
import {
  loadImportedLanguagePacks,
  mergeLanguagePacks,
  saveImportedLanguagePacks,
  type ImportedLanguagePack,
} from '../lib/languagePacks';
import { useSettingsStore } from '../state/settings';

const FALLBACK_LANGUAGES: LanguagePack[] = [
  { code: 'zh-CN', label: '简体中文', nativeLabel: '简体中文', file: 'zh-CN.json' },
  { code: 'zh-TW', label: '繁體中文', nativeLabel: '繁體中文', file: 'zh-TW.json' },
  { code: 'en', label: 'English', nativeLabel: 'English', file: 'en.json' },
];

export interface I18nValue {
  t: (key: string, values?: Record<string, string | number>) => string;
  language: string;
  preference: string;
  languages: LanguagePack[];
  setLanguage: (code: string) => void;
  importLanguagePack: (pack: ImportedLanguagePack) => void;
  loading: boolean;
}

/**
 * Runtime i18n: built-in packs come from public/locales, imported packs come
 * from localStorage and fall back to English for missing keys.
 */
const I18nContext = createContext<I18nValue | null>(null);
const dictionaries = new Map<string, Record<string, string>>();
const dictionaryRequests = new Map<string, Promise<Record<string, string>>>();

function baseUrl(): string {
  return new URL('locales/', document.baseURI).href;
}

function updateQuery(): string {
  if (typeof window === 'undefined') return '';
  const token = new URLSearchParams(window.location.search).get('__update');
  return token ? `?__update=${encodeURIComponent(token)}` : '';
}

function localeUrl(file: string): string {
  return new URL(`${file}${updateQuery()}`, baseUrl()).href;
}

async function fetchLocaleJson<T>(file: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(localeUrl(file), {
    signal,
    credentials: 'omit',
    cache: updateQuery() ? 'no-store' : 'default',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

export function resolveSystemLanguage(languages: readonly string[], available: LanguagePack[]): string {
  if (!available.length) return 'en';
  const codes = available.map((item) => item.code);
  for (const language of languages) {
    const lower = language.toLowerCase();
    const exact = codes.find((code) => code.toLowerCase() === lower);
    if (exact) return exact;
    if (lower.startsWith('zh')) {
      const traditional = /hant|tw|hk|mo/.test(lower);
      const desired = traditional ? 'zh-TW' : 'zh-CN';
      if (codes.includes(desired)) return desired;
      const zh = codes.find((code) => code.toLowerCase().startsWith('zh'));
      if (zh) return zh;
    }
    if (lower.startsWith('en')) {
      const en = codes.find((code) => code.toLowerCase() === 'en' || code.toLowerCase().startsWith('en-'));
      if (en) return en;
    }
    const base = codes.find((code) => code.toLowerCase().split('-')[0] === lower.split('-')[0]);
    if (base) return base;
  }
  return codes.includes('en') ? 'en' : codes[0];
}

function currentSystemLanguages(): string[] {
  if (typeof navigator === 'undefined') return ['en'];
  return navigator.languages?.length ? [...navigator.languages] : [navigator.language || 'en'];
}

export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const preference = useSettingsStore((state) => state.language);
  const patchSettings = useSettingsStore((state) => state.patch);
  const [remoteLanguages, setRemoteLanguages] = useState<LanguagePack[]>(FALLBACK_LANGUAGES);
  const [importedPacks, setImportedPacks] = useState<ImportedLanguagePack[]>(loadImportedLanguagePacks);
  const languages = useMemo(() => mergeLanguagePacks(remoteLanguages, importedPacks), [remoteLanguages, importedPacks]);
  const [systemLanguages, setSystemLanguages] = useState<string[]>(currentSystemLanguages);
  const [dictionary, setDictionary] = useState<Record<string, string> | null>(null);
  const [fallback, setFallback] = useState<Record<string, string> | null>(() => dictionaries.get('en') ?? null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchLocaleJson<{ languages?: LanguagePack[] }>('manifest.json')
      .then((manifest) => {
        if (!cancelled && Array.isArray(manifest.languages) && manifest.languages.length) {
          setRemoteLanguages(manifest.languages);
        }
      })
      .catch(() => {
        // The built-in three packs keep the app usable if the manifest is missing.
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const update = (): void => setSystemLanguages(currentSystemLanguages());
    window.addEventListener('languagechange', update);
    return () => window.removeEventListener('languagechange', update);
  }, []);

  const language = useMemo(() => {
    if (preference !== 'system' && languages.some((item) => item.code === preference)) return preference;
    return resolveSystemLanguage(systemLanguages, languages);
  }, [preference, languages, systemLanguages]);
  const activePack = useMemo(
    () => languages.find((item) => item.code === language) ?? languages[0],
    [language, languages],
  );

  // Imported packs are allowed to be partial; English is the readable fallback
  // for keys the author has not translated yet. Load the active locale first:
  // the fallback request is deferred until the current dictionary is ready.
  useEffect(() => {
    if (fallback || !dictionary || language === 'en') return;
    let cancelled = false;
    const request = window.setTimeout(() => {
      fetchLocaleJson<Record<string, string>>('en.json')
        .then((payload) => {
          if (cancelled) return;
          dictionaries.set('en', payload);
          setFallback(payload);
        })
        .catch(() => {});
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(request);
    };
  }, [dictionary, fallback, language]);


  useEffect(() => {
    let cancelled = false;
    setError(null);
    const cached = dictionaries.get(language);
    if (cached) {
      setDictionary(cached);
      return () => { cancelled = true; };
    }
    const pack = activePack;
    if (pack.translations) {
      dictionaries.set(language, pack.translations);
      setDictionary(pack.translations);
      return () => { cancelled = true; };
    }
    let request = dictionaryRequests.get(pack.file);
    if (!request) {
      request = fetchLocaleJson<Record<string, string>>(pack.file);
      dictionaryRequests.set(pack.file, request);
      request.finally(() => dictionaryRequests.delete(pack.file)).catch(() => {});
    }
    request
      .then((payload) => {
        if (cancelled) return;
        dictionaries.set(language, payload);
        setDictionary(payload);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { cancelled = true; };
  }, [activePack?.file, activePack?.translations, language, reloadToken]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key: string, values?: Record<string, string | number>): string => {
    let text = dictionary?.[key] ?? fallback?.[key] ?? key;
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        text = text.split(`{${name}}`).join(String(value));
      }
    }
    return text;
  }, [dictionary, fallback]);

  const setLanguage = useCallback((code: string) => {
    patchSettings({ language: code });
  }, [patchSettings]);

  const importLanguagePack = useCallback((pack: ImportedLanguagePack): void => {
    setImportedPacks((current) => {
      const next = [...current.filter((item) => item.code !== pack.code), pack];
      saveImportedLanguagePacks(next);
      return next;
    });
    dictionaries.set(pack.code, pack.translations);
    if (language === pack.code) setDictionary(pack.translations);
    patchSettings({ language: pack.code });
  }, [language, patchSettings]);

  const value = useMemo<I18nValue>(() => ({
    t,
    language,
    preference,
    languages,
    setLanguage,
    importLanguagePack,
    loading: !dictionary,
  }), [t, language, preference, languages, setLanguage, importLanguagePack, dictionary]);

  if (error && !dictionary) {
    return (
      <div className="boot-screen">
        <div className="boot-mark" aria-hidden="true">A</div>
        <p className="boot-title">Asteria Player</p>
        <p className="boot-message">The language pack could not be loaded.</p>
        <p className="boot-detail">{error}</p>
        <button className="fluent-button primary" type="button" onClick={() => setReloadToken((token) => token + 1)}>
          Retry
        </button>
      </div>
    );
  }

  if (!dictionary) {
    return (
      <div className="boot-screen" aria-live="polite">
        <div className="boot-mark" aria-hidden="true">A</div>
        <p className="boot-title">Asteria Player</p>
        <div className="boot-progress" aria-hidden="true"><span /></div>
      </div>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
