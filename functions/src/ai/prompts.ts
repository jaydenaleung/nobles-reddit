import dailyQuestionTemplate from './prompts/dailyQuestion.md';
import screeningTemplate from './prompts/screening.md';
import summaryTemplate from './prompts/summary.md';
import type { QuestionContext, ThreadForSummary } from './provider';

export interface BuiltPrompt {
  system: string;
  user: string;
}

/** How much of one comment goes to the summariser. Longer comments are shortened, and marked as such. */
export const SUMMARY_COMMENT_CHARS = 1200;
export const SUMMARY_BODY_CHARS = 3000;
export const SCREEN_TEXT_CHARS = 12_000;

// Control characters and invisible direction-override characters.
/* eslint-disable no-control-regex */
const UNWANTED_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
/* eslint-enable no-control-regex */

/**
 * Makes user text safe to place inside a delimited data block.
 *
 * The model is told that everything inside the block is data. This function
 * makes sure user text cannot leave the block: angle brackets are replaced
 * with look-alike characters, so no user can type a closing tag or open a new
 * one, and control characters are dropped.
 */
export function neutralise(text: string, maxChars: number): string {
  const cleaned = String(text ?? '')
    .replace(UNWANTED_CHARS, '')
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/\{\{/g, '{ {')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars)} [shortened]`;
}

function split(template: string): { system: string; user: string } {
  const [system, user] = template.replace(/\r\n/g, '\n').split('\n---USER---\n');
  if (!system || !user) throw new Error('Prompt template is missing its ---USER--- separator.');
  return { system: system.trim(), user: user.trim() };
}

function fill(template: string, data: string): BuiltPrompt {
  const { system, user } = split(template);
  // A function replacement, so that `$&` and friends in user text mean nothing.
  return { system, user: user.replace('{{DATA}}', () => data) };
}

/**
 * The summary prompt. The model receives the text of the post and comments
 * and nothing else: no names, no anonymous labels, no roles, no ids. It cannot
 * reveal who wrote something because it is never told.
 */
export function buildSummaryPrompt(thread: ThreadForSummary): BuiltPrompt {
  const lines = [
    `<title>${neutralise(thread.title, 300)}</title>`,
    `<post>${neutralise(thread.body, SUMMARY_BODY_CHARS)}</post>`,
    ...thread.comments.map((c) => {
      const reply = c.replyTo !== null ? ` reply_to="${c.replyTo}"` : '';
      return `<comment n="${c.n}"${reply}>${neutralise(c.text, SUMMARY_COMMENT_CHARS)}</comment>`;
    }),
  ];
  return fill(summaryTemplate, lines.join('\n'));
}

export function buildScreeningPrompt(text: string): BuiltPrompt {
  return fill(screeningTemplate, neutralise(text, SCREEN_TEXT_CHARS));
}

/** Titles only, never bodies. */
export function buildQuestionPrompt(context: QuestionContext): BuiltPrompt {
  const list = (items: string[], max: number) =>
    items.length === 0 ? '(none)' : items.map((item) => `- ${neutralise(item, max)}`).join('\n');
  const data = [
    `<date>${neutralise(context.date, 20)}</date>`,
    `<recent_thread_titles>\n${list(context.recentTitles.slice(0, 60), 160)}\n</recent_thread_titles>`,
    `<school_calendar_notes>\n${list(context.calendarNotes.slice(0, 30), 220)}\n</school_calendar_notes>`,
    `<banned_topics>\n${list(context.bannedTopics.slice(0, 50), 100)}\n</banned_topics>`,
  ].join('\n');
  return fill(dailyQuestionTemplate, data);
}
