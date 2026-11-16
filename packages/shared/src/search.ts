import { LIMITS, STOP_WORDS } from './constants';

/** Lowercased unique words, stop words and one-letter words removed. */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && word.length <= 30 && !STOP_WORDS.has(word));
  return [...new Set(words)];
}

/**
 * The search index for a post: its title, the first 200 characters of the body
 * and the space name. Author information is never indexed, so an anonymous
 * author cannot be found by searching.
 */
export function buildSearchTokens(title: string, body: string, spaceName: string): string[] {
  return tokenize(`${title} ${body.slice(0, 200)} ${spaceName}`).slice(0, 80);
}

/** Up to ten tokens from what someone typed, for an array-contains-any query. */
export function queryTokens(query: string): string[] {
  return tokenize(query).slice(0, LIMITS.searchMaxTokens);
}
