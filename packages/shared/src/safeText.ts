/**
 * The safe text formatter.
 *
 * User text is never treated as HTML. It is parsed into a small tree of plain
 * nodes, and the web app turns that tree into React elements. The only
 * formatting is: paragraphs, *italic*, **bold**, and https links (autolinked).
 * Everything else, including anything that looks like a tag, stays text.
 */
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'link'; href: string; text: string };

export interface Paragraph {
  /** Lines within a paragraph are separated by a line break. */
  lines: InlineNode[][];
}

const MAX_PARAGRAPHS = 200;
const URL_RE = /https:\/\/[^\s<>"'`\\^{}|]+/g;

/** Returns a normalised https URL, or null when the text is not a safe link. */
export function safeHttpsUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Sentence punctuation that follows a URL belongs to the sentence, not the link. */
function splitTrailingPunctuation(url: string): [string, string] {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1]!;
    if (/[.,;:!?…'"”’]/.test(ch)) {
      end -= 1;
    } else if (ch === ')' && !url.slice(0, end).includes('(')) {
      end -= 1;
    } else {
      break;
    }
  }
  return [url.slice(0, end), url.slice(end)];
}

function linkify(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const [candidate, trailing] = splitTrailingPunctuation(match[0]);
    const href = safeHttpsUrl(candidate);
    if (!href) continue;
    if (start > last) nodes.push({ type: 'text', text: text.slice(last, start) });
    nodes.push({ type: 'link', href, text: candidate });
    last = start + candidate.length;
    if (trailing) {
      nodes.push({ type: 'text', text: trailing });
      last += trailing.length;
    }
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes;
}

/** Finds the closing marker for emphasis that opened at `from`. Must hug a non-space character. */
function findClose(line: string, marker: string, from: number): number {
  let at = line.indexOf(marker, from);
  while (at !== -1) {
    const before = line[at - 1];
    const after = line[at + marker.length];
    const hugsText = before !== undefined && !/\s/.test(before);
    // A single * must not be half of a ** pair.
    const partOfPair = marker === '*' && (after === '*' || before === '*');
    if (at > from && hugsText && !partOfPair) return at;
    at = line.indexOf(marker, at + 1);
  }
  return -1;
}

function parseInline(line: string, depth = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = '';
  let i = 0;
  const flush = () => {
    if (buffer) nodes.push(...linkify(buffer));
    buffer = '';
  };
  while (i < line.length) {
    // A link is consumed whole so that * inside a URL is never emphasis.
    if (line.startsWith('https://', i)) {
      const match = /^https:\/\/[^\s<>"'`\\^{}|]+/.exec(line.slice(i));
      if (match) {
        buffer += match[0];
        i += match[0].length;
        continue;
      }
    }
    if (depth < 2 && line[i] === '*') {
      const marker = line.startsWith('**', i) ? '**' : '*';
      const open = i + marker.length;
      const next = line[open];
      if (next !== undefined && !/\s/.test(next) && next !== '*') {
        const close = findClose(line, marker, open);
        if (close !== -1) {
          flush();
          nodes.push({
            type: marker === '**' ? 'bold' : 'italic',
            children: parseInline(line.slice(open, close), depth + 1),
          });
          i = close + marker.length;
          continue;
        }
      }
      buffer += marker;
      i += marker.length;
      continue;
    }
    buffer += line[i];
    i += 1;
  }
  flush();
  return nodes;
}

/** Parses user text into paragraphs of safe inline nodes. */
export function parseSafeText(input: string): Paragraph[] {
  const normalised = String(input ?? '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const blocks = normalised
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, MAX_PARAGRAPHS);
  return blocks.map((block) => ({
    lines: block.split('\n').map((line) => parseInline(line)),
  }));
}

/** The plain text of some user text with the formatting marks removed. Used for excerpts. */
export function plainText(input: string): string {
  const out: string[] = [];
  const walk = (nodes: InlineNode[]): string =>
    nodes.map((node) => (node.type === 'text' || node.type === 'link' ? node.text : walk(node.children))).join('');
  for (const paragraph of parseSafeText(input)) {
    out.push(paragraph.lines.map(walk).join(' '));
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

export function excerpt(input: string, max = 180): string {
  const text = plainText(input);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}
