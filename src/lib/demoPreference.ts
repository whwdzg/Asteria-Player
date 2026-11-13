export type DemoPreference = 'demo' | 'import';

export const DEMO_PREFERENCE_KEY = 'asteria-demo-preference';

export function getDemoPreference(): DemoPreference | null {
  try {
    const value = localStorage.getItem(DEMO_PREFERENCE_KEY);
    return value === 'demo' || value === 'import' ? value : null;
  } catch {
    return null;
  }
}

export function setDemoPreference(value: DemoPreference): void {
  try {
    localStorage.setItem(DEMO_PREFERENCE_KEY, value);
  } catch {
    // Private browsing / disabled storage: keep the in-memory session usable.
  }
}

export const APP_USED_KEY = 'asteria-has-used';

export function hasUsedApp(): boolean {
  try {
    return localStorage.getItem(APP_USED_KEY) === '1' || getDemoPreference() !== null;
  } catch {
    return false;
  }
}

export function markAppUsed(): void {
  try {
    localStorage.setItem(APP_USED_KEY, '1');
  } catch {
    // Ignore blocked storage.
  }
}
