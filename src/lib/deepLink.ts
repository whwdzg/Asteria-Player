import type { UrlKind } from './urlImport';

export interface DeepLinkRequest {
  url: string;
  kind: UrlKind;
}

const URL_KEYS = ['url', 'src', 'media', 'play'];

function paramsFor(href: string): { search: URLSearchParams; hash: URLSearchParams; parsed: URL } {
  const base = typeof document !== 'undefined' ? document.baseURI : 'https://whwdzg.github.io/Asteria-Player/';
  const parsed = new URL(href, base);
  return {
    parsed,
    search: new URLSearchParams(parsed.search),
    hash: new URLSearchParams(parsed.hash.replace(/^#\??/, '')),
  };
}

/** Reads a whwdzg.github.io → Asteria player request from query or hash. */
export function parseDeepLink(href: string): DeepLinkRequest | null {
  const { search, hash } = paramsFor(href);
  const get = (key: string): string | null => search.get(key) ?? hash.get(key);
  const value = URL_KEYS.map(get).find((candidate) => candidate?.trim());
  if (!value) return null;
  const url = value.trim();
  if (/^(?:javascript|data|file|blob):/i.test(url)) return null;
  const kindValue = (get('kind') ?? get('type') ?? 'auto').toLowerCase();
  const kind: UrlKind = kindValue === 'audio' || kindValue === 'video' ? kindValue : 'auto';
  return { url, kind };
}

/** Removes deep-link-only parameters while preserving unrelated query/hash state. */
export function clearDeepLink(href: string): string {
  const { parsed, search, hash } = paramsFor(href);
  for (const key of [...URL_KEYS, 'kind', 'type']) {
    search.delete(key);
    hash.delete(key);
  }
  parsed.search = search.toString();
  parsed.hash = hash.toString();
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
