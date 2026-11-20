import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/fonts';
import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';
import { App } from './App';

// Replaced at build time (see vite.config.ts), so the dev tools are left out of production builds.
declare const __USE_EMULATORS__: boolean;

if (__USE_EMULATORS__) void import('./dev/palette').then((m) => m.startPalette());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
