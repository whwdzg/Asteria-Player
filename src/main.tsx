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
