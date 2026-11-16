import { describe, expect, it } from 'vitest';
import { excerpt, parseSafeText, plainText, safeHttpsUrl, type InlineNode } from './safeText';

/** Every string that could ever reach the page from a parsed text. */
function allStrings(input: string): string[] {
  const out: string[] = [];
  const walk = (nodes: InlineNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text') out.push(node.text);
      else if (node.type === 'link') out.push(node.text, node.href);
      else walk(node.children);
    }
  };
  for (const p of parseSafeText(input)) p.lines.forEach(walk);
  return out;
}
function links(input: string): string[] {
  const out: string[] = [];
  const walk = (nodes: InlineNode[]) => {
    for (const node of nodes) {
      if (node.type === 'link') out.push(node.href);
      else if (node.type !== 'text') walk(node.children);
    }
  };
  for (const p of parseSafeText(input)) p.lines.forEach(walk);
  return out;
}

describe('parseSafeText', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    const parsed = parseSafeText('One\ntwo\n\nThree');
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.lines).toHaveLength(2);
  });
  it('parses bold and italic', () => {
    const [p] = parseSafeText('This is **bold** and *italic*.');
    expect(p!.lines[0]).toEqual([
      { type: 'text', text: 'This is ' },
      { type: 'bold', children: [{ type: 'text', text: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'italic', children: [{ type: 'text', text: 'italic' }] },
      { type: 'text', text: '.' },
    ]);
  });
  it('leaves unmatched or spaced asterisks alone', () => {
    expect(plainText('2 * 3 * 4 = 24')).toBe('2 * 3 * 4 = 24');
    expect(plainText('a **loose star')).toBe('a **loose star');
  });
  it('autolinks https and nothing else', () => {
    expect(links('See https://example.org/a?b=1 now')).toEqual(['https://example.org/a?b=1']);
    expect(links('http://example.org')).toEqual([]);
    expect(links('javascript:alert(1)')).toEqual([]);
    expect(links('data:text/html;base64,AAAA')).toEqual([]);
    expect(links('vbscript:msgbox(1) file:///etc/passwd')).toEqual([]);
  });
  it('keeps sentence punctuation out of the link', () => {
    expect(links('Read https://example.org/story.')).toEqual(['https://example.org/story']);
    expect(links('(see https://example.org/x)')).toEqual(['https://example.org/x']);
  });
  it('does not treat * inside a link as emphasis', () => {
    expect(links('https://example.org/a*b*c')).toEqual(['https://example.org/a*b*c']);
  });
  it('rejects links with credentials', () => {
    expect(safeHttpsUrl('https://admin:pw@example.org')).toBeNull();
  });
});

describe('XSS: nothing a user types becomes markup', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">click</a>',
    '"><svg/onload=alert(1)>',
    '<iframe src="https://evil.example"></iframe>',
    '**<b onmouseover=alert(1)>bold</b>**',
    '[click](javascript:alert(1))',
    '<style>body{display:none}</style>',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    'https://example.org/"onmouseover="alert(1)',
    "https://example.org/'><script>alert(1)</script>",
    'javascript://example.org/%0aalert(1)',
    '\u0000<script>alert(1)</script>',
  ];
  it('returns only text, bold, italic and link nodes', () => {
    const allowed = new Set(['text', 'bold', 'italic', 'link']);
    const walk = (nodes: InlineNode[]) => {
      for (const node of nodes) {
        expect(allowed.has(node.type)).toBe(true);
        if (node.type === 'bold' || node.type === 'italic') walk(node.children);
      }
    };
    for (const attack of attacks) {
      for (const p of parseSafeText(attack)) p.lines.forEach(walk);
    }
  });
  it('keeps tags as literal text, exactly as typed', () => {
    expect(allStrings('<script>alert(1)</script>').join('')).toBe('<script>alert(1)</script>');
    expect(allStrings('<img src=x onerror=alert(1)>').join('')).toBe('<img src=x onerror=alert(1)>');
  });
  it('only ever produces https hrefs without quotes or angle brackets', () => {
    for (const attack of attacks) {
      for (const href of links(attack)) {
        expect(href.startsWith('https://')).toBe(true);
        expect(href).not.toMatch(/["'<>\s]/);
      }
    }
  });
  it('never produces a javascript: or data: href', () => {
    for (const attack of attacks) {
      for (const href of links(attack)) {
        expect(href).not.toMatch(/^(javascript|data|vbscript):/i);
      }
    }
  });
  it('stops at a sensible depth and length', () => {
    const deep = '*'.repeat(5000) + 'x' + '*'.repeat(5000);
    expect(() => parseSafeText(deep)).not.toThrow();
    expect(parseSafeText('a\n\n'.repeat(1000)).length).toBeLessThanOrEqual(200);
  });
});

describe('excerpt', () => {
  it('strips formatting marks and shortens on a word boundary', () => {
    expect(excerpt('**Hello** *there*')).toBe('Hello there');
    const long = excerpt('word '.repeat(100), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith('…')).toBe(true);
  });
});
