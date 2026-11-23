import { useSyncExternalStore } from 'react';

/**
 * Which look the site has. "modern" is the default;
 * "classic" is the original design (styles/modern.css, switched on by data-design on
 * <html>). The choice lives in localStorage, like the theme, and public/theme.js
 * applies it before the page paints.
 */
export type Design = 'classic' | 'modern';

const KEY = 'commons.design';
const EVENT = 'commons:design';

export function currentDesign(): Design {
  try {
    return window.localStorage.getItem(KEY) === 'classic' ? 'classic' : 'modern';
  } catch {
    return 'modern';
  }
}

export function applyDesign(design: Design): void {
  try {
    if (design === 'modern') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, design);
  } catch {
    /* the design still applies for this visit */
  }
  document.documentElement.setAttribute('data-design', design);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The design in use; components that word things differently per design re-render when it changes. */
export function useDesign(): Design {
  return useSyncExternalStore(subscribe, currentDesign, () => 'modern');
}
