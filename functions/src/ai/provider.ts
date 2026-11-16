import { LIMITS, SCREEN_LABELS, type ScreenFinding } from '@commons/shared';
import { z } from 'zod';

/* ---------- What goes in. Note what is NOT here: no author, no uid, no name. ---------- */

export interface ThreadForSummary {
  title: string;
  body: string;
  /** `n` is the comment's position in the thread; `replyTo` is the position it answers, if any. */
  comments: { n: number; replyTo: number | null; text: string }[];
}
export interface QuestionContext {
  date: string;
  recentTitles: string[];
  calendarNotes: string[];
  bannedTopics: string[];
}

/* ---------- What comes out ---------- */

export interface SummaryOutput {
  text: string;
  bullets: string[];
  agreements: string;
  disagreements: string;
}
export interface QuestionOutput {
  questions: string[];
}
export interface ClassifyOutput {
  labels: ScreenFinding[];
}
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}
export interface AiResult<T> {
  output: T;
  usage: AiUsage;
  model: string;
}

/**
 * The one interface every model sits behind. ClaudeProvider is the real one,
 * MockProvider is for tests and the emulators, LocalProvider calls the
 * hand-built model in ml/serve. To swap the model, implement this.
 */
export interface AiProvider {
  readonly name: string;
  summarize(thread: ThreadForSummary): Promise<AiResult<SummaryOutput>>;
  suggestQuestion(context: QuestionContext): Promise<AiResult<QuestionOutput>>;
  classify(text: string): Promise<AiResult<ClassifyOutput>>;
}

export type AiUnavailableReason = 'budget' | 'down' | 'malformed' | 'refusal' | 'config';

/** Thrown whenever an AI feature cannot answer. Callers degrade; nothing else breaks. */
export class AiUnavailable extends Error {
  constructor(
    readonly reason: AiUnavailableReason,
    detail = '',
  ) {
    super(`AI unavailable: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'AiUnavailable';
  }
}

/* ---------- JSON schemas sent to the model (structured output) ---------- */

export const summaryJsonSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    agreements: { type: 'string' },
    disagreements: { type: 'string' },
  },
  required: ['text', 'bullets', 'agreements', 'disagreements'],
  additionalProperties: false,
} as const;

export const questionJsonSchema = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
  additionalProperties: false,
} as const;

export const classifyJsonSchema = {
  type: 'object',
  properties: {
    labels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', enum: [...SCREEN_LABELS] },
          confidence: { type: 'number' },
        },
        required: ['label', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['labels'],
  additionalProperties: false,
} as const;

/* ---------- Validation of what the model returned. Never trust it. ---------- */

function clampWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words
    .slice(0, maxWords)
    .join(' ')
    .replace(/[,;:]$/, '')}…`;
}
/** Model output is shown as plain text. Markup and control characters are removed anyway. */
function plain(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Things that must never appear in computer-written text shown to students. */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
/** Firebase uids are 28 characters of letters and digits. */
const UID_RE = /\b[A-Za-z0-9]{28}\b/;
export function looksLikeIdentifier(text: string): boolean {
  return EMAIL_RE.test(text) || UID_RE.test(text);
}

const rawSummarySchema = z.object({
  text: z.string(),
  bullets: z.array(z.string()),
  agreements: z.string(),
  disagreements: z.string(),
});

/** Returns a cleaned summary, or throws AiUnavailable('malformed'). */
export function validateSummary(raw: unknown): SummaryOutput {
  const parsed = rawSummarySchema.safeParse(raw);
  if (!parsed.success) throw new AiUnavailable('malformed', 'summary shape');
  const out: SummaryOutput = {
    text: clampWords(plain(parsed.data.text), LIMITS.summaryMaxWords),
    bullets: parsed.data.bullets
      .map((b) => clampWords(plain(b), 24))
      .filter(Boolean)
      .slice(0, LIMITS.summaryMaxBullets),
    agreements: clampWords(plain(parsed.data.agreements), 40),
    disagreements: clampWords(plain(parsed.data.disagreements), 40),
  };
  if (!out.text) throw new AiUnavailable('malformed', 'empty summary');
  const all = [out.text, ...out.bullets, out.agreements, out.disagreements].join(' ');
  if (looksLikeIdentifier(all)) throw new AiUnavailable('malformed', 'identifier in summary');
  return out;
}

const rawQuestionSchema = z.object({ questions: z.array(z.string()) });

export function validateQuestions(raw: unknown, bannedTopics: string[]): QuestionOutput {
  const parsed = rawQuestionSchema.safeParse(raw);
  if (!parsed.success) throw new AiUnavailable('malformed', 'question shape');
  const banned = bannedTopics.map((t) => t.toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  const questions = parsed.data.questions
    .map(plain)
    .filter((q) => q.length >= LIMITS.titleMin && q.length <= LIMITS.titleMax && q.endsWith('?'))
    .filter((q) => !looksLikeIdentifier(q))
    .filter((q) => !banned.some((topic) => q.toLowerCase().includes(topic)))
    .filter((q) => (seen.has(q.toLowerCase()) ? false : (seen.add(q.toLowerCase()), true)))
    .slice(0, 3);
  if (questions.length === 0) throw new AiUnavailable('malformed', 'no usable question');
  return { questions };
}

const rawClassifySchema = z.object({
  labels: z.array(z.object({ label: z.enum(SCREEN_LABELS), confidence: z.number() })),
});

export function validateClassification(raw: unknown): ClassifyOutput {
  const parsed = rawClassifySchema.safeParse(raw);
  if (!parsed.success) throw new AiUnavailable('malformed', 'classification shape');
  return {
    labels: parsed.data.labels.map((l) => ({
      label: l.label,
      confidence: Math.min(1, Math.max(0, Number.isFinite(l.confidence) ? l.confidence : 0)),
    })),
  };
}
