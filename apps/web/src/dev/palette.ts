// Click-to-edit color palette for local development. It only loads in emulator builds
// and only runs after visiting /dev. Changes show live; Save writes them to tokens.css.

const FLAG = 'commons.palette';
const hex = /^#[0-9a-f]{6}$/i;

type Prop = 'color' | 'background-color' | 'border-top-color';
const LABELS: Record<Prop, string> = {
  color: 'Text',
  'background-color': 'Background',
  'border-top-color': 'Border',
};

let started = false;
let picking = false;
let selected: Element | null = null;
const dirty = new Map<Element, Set<string>>();

const host = document.createElement('div');
const hover = document.createElement('div');
const body = document.createElement('div');
const status = document.createElement('p');

function make<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string) {
  const node = document.createElement(tag);
  node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

function tokenNames(): string[] {
  const names: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || !rule.selectorText.includes('data-theme')) continue;
      for (const prop of Array.from(rule.style)) {
        const value = rule.style.getPropertyValue(prop).trim();
        if (
          prop.startsWith('--') &&
          !prop.startsWith('--doodle') &&
          hex.test(value) &&
          !names.includes(prop)
        ) {
          names.push(prop);
        }
      }
    }
  }
  return names;
}

function scopeOf(el: Element): HTMLElement {
  return (el.closest('[data-theme]') as HTMLElement | null) ?? document.documentElement;
}

function value(scope: HTMLElement, name: string): string {
  return getComputedStyle(scope).getPropertyValue(name).trim();
}

function toRgb(color: string): string {
  const n = parseInt(color.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function isClear(color: string): boolean {
  return color === 'rgba(0, 0, 0, 0)' || color === 'transparent';
}

// A token is behind a color if changing it changes what the element shows.
function culprits(el: Element, prop: Prop): string[] {
  const scope = scopeOf(el);
  const names = tokenNames();
  const freeze = document.createElement('style');
  freeze.textContent = '* { transition: none !important; }';
  document.head.appendChild(freeze);
  const base = getComputedStyle(el).getPropertyValue(prop);
  const found: string[] = [];
  for (const name of names) {
    const now = value(scope, name);
    if (!hex.test(now) || toRgb(now) !== base) continue;
    const had = scope.style.getPropertyValue(name);
    scope.style.setProperty(name, '#010203');
    const changed = getComputedStyle(el).getPropertyValue(prop) !== base;
    if (had) scope.style.setProperty(name, had);
    else scope.style.removeProperty(name);
    if (changed) found.push(name);
  }
  freeze.remove();
  return found;
}

function backgroundHolder(el: Element): Element {
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    if (!isClear(getComputedStyle(node).backgroundColor)) return node;
    node = node.parentElement;
  }
  return document.body;
}

function updateStatus(message?: string) {
  let count = 0;
  dirty.forEach((names) => (count += names.size));
  status.textContent =
    message ?? (count === 0 ? 'No unsaved changes.' : `${count} unsaved change${count === 1 ? '' : 's'}.`);
}

function editRow(scope: HTMLElement, name: string, label?: string): HTMLElement {
  const row = make(
    'div',
    'display:grid;grid-template-columns:32px 1fr 84px;gap:8px;align-items:center;margin:6px 0',
  );
  const picker = make(
    'input',
    'width:32px;height:28px;padding:0;border:1px solid #bbb;border-radius:4px;background:none;cursor:pointer',
  );
  picker.type = 'color';
  const now = value(scope, name);
  picker.value = hex.test(now) ? now.toLowerCase() : '#000000';
  picker.setAttribute('aria-label', `${name} color`);
  const names = make('div', 'font:12px/16px system-ui,sans-serif;color:#222');
  names.textContent = label ? `${label}: ${name}` : name;
  const text = make(
    'input',
    'width:84px;height:28px;box-sizing:border-box;font:12px ui-monospace,monospace;padding:0 6px;border:1px solid #bbb;border-radius:4px;color:#111;background:#fff',
  );
  text.value = picker.value.toUpperCase();
  text.setAttribute('aria-label', `${name} hex value`);
  const apply = (next: string) => {
    scope.style.setProperty(name, next.toUpperCase());
    const set = dirty.get(scope) ?? new Set<string>();
    set.add(name);
    dirty.set(scope, set);
    picker.value = next.toLowerCase();
    text.value = next.toUpperCase();
    updateStatus();
  };
  picker.addEventListener('input', () => apply(picker.value));
  text.addEventListener('input', () => {
    const next = text.value.trim().startsWith('#') ? text.value.trim() : `#${text.value.trim()}`;
    if (hex.test(next)) apply(next);
  });
  row.append(picker, names, text);
  return row;
}

function render() {
  body.replaceChildren();
  if (!selected) {
    body.append(
      make(
        'p',
        'margin:8px 0;font:13px/18px system-ui,sans-serif;color:#444',
        'Press Pick, then click anything on the page.',
      ),
    );
    return;
  }
  const scope = scopeOf(selected);
  const tag = `${selected.tagName.toLowerCase()}${selected.className && typeof selected.className === 'string' ? '.' + selected.className.split(' ')[0] : ''}`;
  body.append(make('p', 'margin:8px 0 4px;font:12px ui-monospace,monospace;color:#444', tag));
  let any = false;
  const props: [Prop, Element][] = [
    ['color', selected],
    ['background-color', backgroundHolder(selected)],
  ];
  const style = getComputedStyle(selected);
  if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none')
    props.push(['border-top-color', selected]);
  for (const [prop, holder] of props) {
    for (const name of culprits(holder, prop)) {
      body.append(editRow(scope, name, LABELS[prop]));
      any = true;
    }
  }
  if (!any) {
    body.append(
      make(
        'p',
        'margin:8px 0;font:13px/18px system-ui,sans-serif;color:#444',
        'No palette color here. Try a nearby element.',
      ),
    );
  } else {
    body.append(
      make(
        'p',
        'margin:8px 0;font:12px/16px system-ui,sans-serif;color:#666',
        'Each color changes everywhere it is used.',
      ),
    );
  }
}

function renderAll() {
  const list = make('div', 'max-height:220px;overflow:auto;border-top:1px solid #ddd;margin-top:6px');
  const scope = document.documentElement;
  for (const name of tokenNames()) list.append(editRow(scope, name));
  return list;
}

function position(el: Element) {
  const rect = el.getBoundingClientRect();
  hover.style.display = 'block';
  hover.style.left = `${rect.left}px`;
  hover.style.top = `${rect.top}px`;
  hover.style.width = `${rect.width}px`;
  hover.style.height = `${rect.height}px`;
}

function inPanel(node: EventTarget | null): boolean {
  return node instanceof Node && host.contains(node);
}

async function save() {
  const payloads: { theme: string; tokens: Record<string, string> }[] = [];
  dirty.forEach((names, scope) => {
    const tokens: Record<string, string> = {};
    names.forEach((name) => {
      const v = (scope as HTMLElement).style.getPropertyValue(name).trim();
      if (hex.test(v)) tokens[name] = v;
    });
    payloads.push({ theme: scope.getAttribute('data-theme') ?? 'paper', tokens });
  });
  if (payloads.length === 0) return updateStatus('Nothing to save yet.');
  try {
    for (const payload of payloads) {
      const response = await fetch('/__palette', { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await response.text());
    }
    updateStatus('Saved to tokens.css.');
    setTimeout(() => {
      dirty.forEach((names, scope) =>
        names.forEach((name) => (scope as HTMLElement).style.removeProperty(name)),
      );
      dirty.clear();
    }, 800);
  } catch (err) {
    updateStatus(`Couldn't save: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

function reset() {
  dirty.forEach((names, scope) => names.forEach((name) => (scope as HTMLElement).style.removeProperty(name)));
  dirty.clear();
  updateStatus();
  render();
}

function start() {
  if (started) return;
  started = true;
  host.style.cssText =
    'position:fixed;right:12px;bottom:12px;width:330px;max-height:78vh;overflow:auto;z-index:2147483000;background:#fff;color:#111;border:1px solid #888;border-radius:8px;padding:10px 12px;font-family:system-ui,sans-serif;box-sizing:border-box';
  hover.style.cssText =
    'position:fixed;display:none;pointer-events:none;border:2px solid #ff6a00;z-index:2147482999;box-sizing:border-box';

  const bar = make('div', 'display:flex;align-items:center;gap:8px');
  bar.append(make('strong', 'font:600 14px system-ui,sans-serif;flex:1', 'Colors'));
  const pick = make(
    'button',
    'font:13px system-ui,sans-serif;padding:4px 10px;border:1px solid #666;border-radius:6px;background:#fff;color:#111;cursor:pointer',
    'Pick',
  );
  const fold = make(
    'button',
    'font:13px system-ui,sans-serif;padding:4px 10px;border:1px solid #666;border-radius:6px;background:#fff;color:#111;cursor:pointer',
    'Hide',
  );
  bar.append(pick, fold);

  const content = make('div', '');
  const actions = make('div', 'display:flex;gap:8px;margin-top:8px');
  const saveButton = make(
    'button',
    'font:13px system-ui,sans-serif;padding:5px 12px;border:1px solid #111;border-radius:6px;background:#111;color:#fff;cursor:pointer',
    'Save to tokens.css',
  );
  const resetButton = make(
    'button',
    'font:13px system-ui,sans-serif;padding:5px 12px;border:1px solid #666;border-radius:6px;background:#fff;color:#111;cursor:pointer',
    'Undo',
  );
  actions.append(saveButton, resetButton);
  status.style.cssText = 'margin:8px 0 0;font:12px/16px system-ui,sans-serif;color:#444';

  const all = make('details', 'margin-top:8px');
  all.append(
    make('summary', 'font:13px system-ui,sans-serif;cursor:pointer;color:#222', 'All colors in this theme'),
  );
  all.addEventListener('toggle', () => {
    if (all.open && all.children.length === 1) all.append(renderAll());
  });

  content.append(body, all, actions, status);
  host.append(bar, content);
  document.body.append(host, hover);
  updateStatus();
  render();

  const setPicking = (on: boolean) => {
    picking = on;
    pick.textContent = on ? 'Picking' : 'Pick';
    pick.style.background = on ? '#ff6a00' : '#fff';
    pick.style.color = on ? '#fff' : '#111';
    if (!on) hover.style.display = 'none';
  };
  pick.addEventListener('click', () => setPicking(!picking));
  fold.addEventListener('click', () => {
    const hidden = content.style.display === 'none';
    content.style.display = hidden ? '' : 'none';
    fold.textContent = hidden ? 'Hide' : 'Show';
  });
  saveButton.addEventListener('click', () => void save());
  resetButton.addEventListener('click', reset);

  document.addEventListener(
    'mousemove',
    (event) => {
      if (!picking || inPanel(event.target)) return;
      if (event.target instanceof Element) position(event.target);
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!picking || inPanel(event.target) || !(event.target instanceof Element)) return;
      event.preventDefault();
      event.stopPropagation();
      selected = event.target;
      position(selected);
      render();
    },
    true,
  );
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picking) setPicking(false);
  });
}

export function enablePalette() {
  try {
    window.sessionStorage.setItem(FLAG, '1');
  } catch {
    return;
  }
  start();
}

export function startPalette() {
  try {
    if (window.sessionStorage.getItem(FLAG) !== '1') return;
  } catch {
    return;
  }
  start();
}
