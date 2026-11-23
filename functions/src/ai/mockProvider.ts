import { fallbackScreen, type ScreenFinding } from '@commons/shared';
import { buildQuestionPrompt, buildScreeningPrompt, buildSummaryPrompt } from './prompts';
import {
  AiUnavailable,
  validateClassification,
  validateQuestions,
  validateSummary,
  type AiProvider,
  type AiResult,
  type ClassifyOutput,
  type QuestionContext,
  type QuestionOutput,
  type SummaryOutput,
  type ThreadForSummary,
} from './provider';

/**
 * A stand-in model for tests and the emulators. It is deterministic, costs
 * nothing and never calls the network.
 *
 * Markers in the text let tests reach every failure path:
 *   [mock:hold]       -> flagged for a moderator
 *   [mock:wellbeing]  -> a wellbeing flag
 *   [mock:down]       -> the model is unreachable
 *   [mock:malformed]  -> the model returns something that fails validation
 *   [mock:leak]       -> the model "leaks" an email address (must be rejected)
 */
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  private tokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async summarize(thread: ThreadForSummary): Promise<AiResult<SummaryOutput>> {
    const prompt = buildSummaryPrompt(thread);
    const all = `${thread.title}\n${thread.body}\n${thread.comments.map((c) => c.text).join('\n')}`;
    if (all.includes('[mock:down]')) throw new AiUnavailable('down', 'mock');
    let raw: unknown = {
      text: `${thread.comments.length} people have replied. Most think the question is worth asking and several shared their own experience, though they differ on what should change.`,
      bullets: ['Several people shared their own experience.', 'Not everyone agreed.'],
      agreements: 'Most people think the question is worth asking.',
      disagreements: 'People differ on what should change.',
    };
    if (all.includes('[mock:malformed]')) raw = { text: 42, bullets: 'nope' };
    if (all.includes('[mock:leak]'))
      raw = { ...(raw as object), text: 'The author is sample.student@nobles.edu.' };
    return {
      output: validateSummary(raw),
      usage: { inputTokens: this.tokens(prompt.system + prompt.user), outputTokens: 60 },
      model: 'mock',
    };
  }

  async suggestQuestion(context: QuestionContext): Promise<AiResult<QuestionOutput>> {
    const prompt = buildQuestionPrompt(context);
    if (context.calendarNotes.join(' ').includes('[mock:down]')) throw new AiUnavailable('down', 'mock');
    const raw = {
      questions: [
        'What is one small change that would make the school day better?',
        'What news story this week do you think people your age should talk about more?',
        'What is the best lunch table conversation you have had this year?',
      ],
    };
    return {
      output: validateQuestions(raw, context.bannedTopics),
      usage: { inputTokens: this.tokens(prompt.system + prompt.user), outputTokens: 50 },
      model: 'mock',
    };
  }

  async classify(text: string): Promise<AiResult<ClassifyOutput>> {
    const prompt = buildScreeningPrompt(text);
    if (text.includes('[mock:down]')) throw new AiUnavailable('down', 'mock');
    const labels: ScreenFinding[] = [...fallbackScreen(text)];
    if (text.includes('[mock:hold]')) labels.push({ label: 'harassment', confidence: 0.8 });
    if (text.includes('[mock:wellbeing]')) labels.push({ label: 'self_harm', confidence: 0.9 });
    return {
      output: validateClassification(text.includes('[mock:malformed]') ? { labels: 'nope' } : { labels }),
      usage: { inputTokens: this.tokens(prompt.system + prompt.user), outputTokens: 20 },
      model: 'mock',
    };
  }
}
