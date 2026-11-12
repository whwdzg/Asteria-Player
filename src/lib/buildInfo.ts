/** Build-time metadata injected by Vite (package version and git HEAD commit). */
export const APP_VERSION = __APP_VERSION__;
export const COMMIT_TIME = __COMMIT_TIME__;
export const COMMIT_HASH = __COMMIT_HASH__;

export function formatCommitTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
