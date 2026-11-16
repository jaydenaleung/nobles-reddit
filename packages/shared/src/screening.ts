import { SCREEN_HOLD_THRESHOLD, WELLBEING_LABELS, type ScreenLabel } from './constants';

export interface ScreenFinding {
  label: ScreenLabel;
  confidence: number;
}
export type ScreenDecision =
  | { outcome: 'publish' }
  | { outcome: 'hold'; labels: ScreenLabel[]; score: number }
  | { outcome: 'wellbeing'; labels: ScreenLabel[]; score: number };

/**
 * The screening policy, in one place.
 *
 *  - Self-harm or harm-to-others signals are never deleted and never published:
 *    they go to the top of the moderation queue marked "wellbeing".
 *  - Any other label at or above the threshold holds the content for a person to review.
 *  - Everything else publishes.
 *
 * The classifier is a helper. Reports and moderators remain.
 */
export function decideScreening(
  findings: ScreenFinding[],
  threshold = SCREEN_HOLD_THRESHOLD,
): ScreenDecision {
  const strong = findings.filter((f) => f.confidence >= threshold);
  if (strong.length === 0) return { outcome: 'publish' };
  const labels = [...new Set(strong.map((f) => f.label))];
  const score = Math.max(...strong.map((f) => f.confidence));
  if (labels.some((label) => WELLBEING_LABELS.includes(label))) {
    return { outcome: 'wellbeing', labels, score };
  }
  return { outcome: 'hold', labels, score };
}

/**
 * A very small phrase check used only when the model is unavailable, so that
 * the clearest safety signals still reach a person. It is deliberately narrow.
 */
const SAFETY_PHRASES: { label: ScreenLabel; re: RegExp }[] = [
  {
    label: 'self_harm',
    re: /\b(kill(ing)? myself|end(ing)? my (own )?life|suicid(e|al)|hurt(ing)? myself|self[- ]harm|want to die|don'?t want to (be alive|live))\b/i,
  },
  {
    label: 'harm_to_others',
    re: /\b(shoot up|bring a (gun|knife|weapon) to|going to (kill|shoot|stab|hurt) (him|her|them|you|everyone|someone))\b/i,
  },
];

export function fallbackScreen(text: string): ScreenFinding[] {
  return SAFETY_PHRASES.filter(({ re }) => re.test(text)).map(({ label }) => ({ label, confidence: 0.9 }));
}
