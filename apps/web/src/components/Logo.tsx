/**
 * The Neddit logo: a speech bubble with a serif N. Drawn on a 32x32 grid and
 * coloured with theme tokens, so the colour palette still controls it.
 * public/favicon.svg is the same shape in fixed colours.
 */
export function LogoMarkSvg({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="nb-logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 3h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H13l-7 5v-5.3A5 5 0 0 1 2 20V8a5 5 0 0 1 5-5z"
        fill="var(--sky)"
      />
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        fontSize="17"
        fill="var(--on-sky)"
        style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontStyle: 'italic' }}
      >
        N
      </text>
    </svg>
  );
}
