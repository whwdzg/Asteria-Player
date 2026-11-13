interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

function notify(): void {
  for (const listener of listeners) listener(Boolean(deferredPrompt));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function subscribeInstallPrompt(listener: (available: boolean) => void): () => void {
  listeners.add(listener);
  listener(Boolean(deferredPrompt));
  return () => listeners.delete(listener);
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const prompt = deferredPrompt;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  if (choice.outcome === 'accepted') {
    deferredPrompt = null;
    notify();
  }
  return choice.outcome;
}
