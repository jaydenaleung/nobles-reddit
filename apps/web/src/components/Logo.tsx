/**
 * Neddit logo concepts. Each mark is drawn on a 32x32 grid and coloured with
 * theme tokens, so the colour palette still controls them.
 *
 *   bubble  – a speech bubble with a serif N: "a place to talk"
 *   pair    – two overlapping speech bubbles: a conversation, two sides
 *   crest   – a school shield whose point is a speech-bubble tail
 *   upvote  – a lowercase n whose arch carries an up arrow
 */
export const LOGO_MARKS = ['bubble', 'pair', 'crest', 'upvote'] as const;
export type LogoMark = (typeof LOGO_MARKS)[number];

/** The mark the site uses. Change this one word to switch logos everywhere. */
export const CURRENT_MARK: LogoMark = 'bubble';

const letter = {
  fontFamily: 'var(--font-serif)',
  fontWeight: 700,
  fontStyle: 'italic',
} as const;

export function LogoMarkSvg({ mark = CURRENT_MARK, size = 30 }: { mark?: LogoMark; size?: number }) {
  return (
    <svg
      className="nb-logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      {mark === 'bubble' && (
        <>
          <path
            d="M7 3h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H13l-7 5v-5.3A5 5 0 0 1 2 20V8a5 5 0 0 1 5-5z"
            fill="var(--sky)"
          />
          <text x="16" y="20.5" textAnchor="middle" fontSize="17" fill="var(--on-sky)" style={letter}>
            N
          </text>
        </>
      )}
      {mark === 'pair' && (
        <>
          <path
            d="M5 2h13a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H9l-5 4v-4.2A4 4 0 0 1 1 14V6a4 4 0 0 1 4-4z"
            fill="none"
            stroke="var(--sky)"
            strokeWidth="2"
          />
          <path
            d="M14 10h13a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4v4.2l-5-4.2h-8a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z"
            fill="var(--sky)"
          />
          <text x="20.5" y="23.5" textAnchor="middle" fontSize="13" fill="var(--on-sky)" style={letter}>
            N
          </text>
        </>
      )}
      {mark === 'crest' && (
        <>
          <path d="M4 3h24v13c0 7-5.5 11-12 13.5L11 31v-3.6C6.6 25 4 21.4 4 16z" fill="var(--sky)" />
          <text x="16" y="22" textAnchor="middle" fontSize="15" fill="var(--on-sky)" style={letter}>
            N
          </text>
        </>
      )}
      {mark === 'upvote' && (
        <>
          <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--sky)" />
          <path
            d="M9 26V15a7 7 0 0 1 14 0v11"
            fill="none"
            stroke="var(--on-sky)"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d="M16 25v-8.5M12.8 19.7 16 16.5l3.2 3.2"
            fill="none"
            stroke="var(--on-sky)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
