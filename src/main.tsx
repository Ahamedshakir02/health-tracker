import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { HealthProvider } from './state/HealthProvider';

// Self-hosted so the app keeps its `font-src 'self'` CSP and makes no
// third-party request on load — a health log should not phone a CDN.
//
// Latin subsets only, and only the weights the design actually sets. Baloo
// Chettan 2 ships Devanagari and Malayalam as well; pulling the whole family
// would put a few hundred kilobytes of glyphs nobody renders in front of
// someone opening the Trainer on gym wifi.
import '@fontsource/baloo-chettan-2/latin-600.css';
import '@fontsource/baloo-chettan-2/latin-700.css';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-500.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans/latin-700.css';
import '@fontsource/noto-sans-mono/latin-400.css';
import '@fontsource/noto-sans-mono/latin-500.css';
import '@fontsource/noto-sans-mono/latin-600.css';

import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HealthProvider>
      <App />
    </HealthProvider>
  </StrictMode>,
);
