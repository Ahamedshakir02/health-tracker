import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { HealthProvider } from './state/HealthProvider';

// Self-hosted so the app keeps its `font-src 'self'` CSP and makes no
// third-party request on load — a health log should not phone a CDN.
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/newsreader';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HealthProvider>
      <App />
    </HealthProvider>
  </StrictMode>,
);
