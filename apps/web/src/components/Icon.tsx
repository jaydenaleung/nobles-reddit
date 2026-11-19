// One inline sprite; <Icon name="up" /> points at a symbol in it. Icons sit next to words, so screen readers skip them.
export type IconName =
  | 'mask'
  | 'left'
  | 'up'
  | 'comment'
  | 'pin'
  | 'shield'
  | 'ext'
  | 'flag'
  | 'check'
  | 'plus'
  | 'search'
  | 'home'
  | 'grid'
  | 'tv'
  | 'user';

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="nb-icon" aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-mask" viewBox="0 0 24 24">
          <path d="M3 8.5c3-1.8 6-1.8 9 0 3-1.8 6-1.8 9 0v2.5c0 3.2-2.2 5.5-4.8 5.5-1.7 0-2.8-1.1-3.6-2.5h-1.2c-.8 1.4-1.9 2.5-3.6 2.5C5.200 16.500 3 14.200 3 11z" />
          <circle cx="8" cy="11.200" r="1.200" />
          <circle cx="16" cy="11.200" r="1.200" />
        </symbol>
        <symbol id="i-left" viewBox="0 0 24 24">
          <path d="M19 12H6M11 6.500l-6 5.500 6 5.500" />
        </symbol>
        <symbol id="i-up" viewBox="0 0 24 24">
          <path d="M12 19V6M6 11.500l6-6 6 6" />
        </symbol>
        <symbol id="i-comment" viewBox="0 0 24 24">
          <path d="M4 5h16v11H9.500L4 20z" />
        </symbol>
        <symbol id="i-pin" viewBox="0 0 24 24">
          <path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" />
        </symbol>
        <symbol id="i-shield" viewBox="0 0 24 24">
          <path d="M12 3l7 3v5.500c0 4.500-3 7.500-7 9.500-4-2-7-5-7-9.500V6z" />
          <path d="M9 12l2.200 2.200L15.500 10" />
        </symbol>
        <symbol id="i-ext" viewBox="0 0 24 24">
          <path d="M14 4h6v6M20 4l-9 9M10 6H5v13h13v-5" />
        </symbol>
        <symbol id="i-flag" viewBox="0 0 24 24">
          <path d="M6 21V4h11l-2 4 2 4H6" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="M5 12.500l4.500 4.500L19 7.500" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4.500-4.500" />
        </symbol>
        <symbol id="i-home" viewBox="0 0 24 24">
          <path d="M4 11l8-6.500 8 6.500v9H4z" />
        </symbol>
        <symbol id="i-grid" viewBox="0 0 24 24">
          <rect x="4" y="4" width="7" height="7" rx="1.500" />
          <rect x="13" y="4" width="7" height="7" rx="1.500" />
          <rect x="4" y="13" width="7" height="7" rx="1.500" />
          <rect x="13" y="13" width="7" height="7" rx="1.500" />
        </symbol>
        <symbol id="i-tv" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="12" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </symbol>
        <symbol id="i-user" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.500" />
          <path d="M5 20c.8-3.500 3.500-5.500 7-5.500s6.200 2 7 5.500" />
        </symbol>
      </defs>
    </svg>
  );
}
