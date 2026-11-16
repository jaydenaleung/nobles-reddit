/**
 * Small things remembered on this device only: which threads you opened,
 * which you saved, your draft and your theme. Nothing here leaves the browser.
 * Storage can be blocked, so every call is guarded.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage is full or blocked: carry on without it */
  }
}

const OPENED = 'commons.opened';
const SAVED = 'commons.saved';
const DRAFT = 'commons.draft';
const THEME = 'commons.theme';

export function openedThreads(): Set<string> {
  return new Set(read<string[]>(OPENED, []));
}
export function markOpened(postId: string): void {
  const ids = read<string[]>(OPENED, []).filter((id) => id !== postId);
  ids.push(postId);
  write(OPENED, ids.slice(-500));
}

export interface SavedThread {
  id: string;
  title: string;
}
export function savedThreads(): SavedThread[] {
  return read<SavedThread[]>(SAVED, []);
}
export function toggleSaved(thread: SavedThread): boolean {
  const all = savedThreads();
  const exists = all.some((t) => t.id === thread.id);
  write(SAVED, exists ? all.filter((t) => t.id !== thread.id) : [...all, thread].slice(-200));
  return !exists;
}

export interface Draft {
  kind: 'text' | 'link' | 'poll';
  spaceId: string;
  title: string;
  body: string;
  url: string;
  options: string[];
}
export function loadDraft(): Draft | null {
  return read<Draft | null>(DRAFT, null);
}
export function saveDraft(draft: Draft): void {
  write(DRAFT, draft);
}
export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT);
  } catch {
    /* nothing to clear */
  }
}

export type ThemeChoice = 'system' | 'paper' | 'night';
export function themeChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(THEME);
    return saved === 'paper' || saved === 'night' ? saved : 'system';
  } catch {
    return 'system';
  }
}
export function applyTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME);
    else window.localStorage.setItem(THEME, choice);
  } catch {
    /* the theme still applies for this visit */
  }
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const theme = choice === 'system' ? (dark ? 'night' : 'paper') : choice;
  document.documentElement.setAttribute('data-theme', theme);
}
