import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/I18nProvider';
import { ImportProvider } from './player/ImportProvider';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ImportProvider>
        <App />
      </ImportProvider>
    </I18nProvider>
  </StrictMode>,
);

// Register the runtime cache in production. Navigation is network-first so a
// new deployment is picked up on every visit, with the cached shell as fallback.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const workerUrl = new URL('sw.js', document.baseURI);
    const scope = new URL('./', document.baseURI).href;
    navigator.serviceWorker.register(workerUrl, { scope })
      .then((registration) => {
        void registration.update();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update();
        });
      })
      .catch((error) => {
        console.warn('Service worker registration failed', error);
      });
  });
}
