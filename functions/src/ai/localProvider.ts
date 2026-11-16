import * as logger from 'firebase-functions/logger';
import {
  AiUnavailable,
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
 * The hand-built model. Used when AI_PROVIDER=local.
 *
 * Summaries go to the small FastAPI app in ml/serve (POST /summarize), which
 * takes and returns exactly the shapes in provider.ts. Screening and question
 * suggestions are not part of the learning project, so they pass through to
 * the fallback provider (Claude in production).
 *
 * The URL comes from configuration (LOCAL_AI_URL), never from user input.
 */
export class LocalProvider implements AiProvider {
  readonly name = 'local';

  constructor(
    private readonly baseUrl: string,
    private readonly fallback: AiProvider,
  ) {}

  async summarize(thread: ThreadForSummary): Promise<AiResult<SummaryOutput>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/summarize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(thread),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      logger.warn('Local summariser is not reachable');
      throw new AiUnavailable('down', 'local model unreachable');
    }
    if (!response.ok) throw new AiUnavailable('down', `local model status ${response.status}`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new AiUnavailable('malformed', 'local model did not return JSON');
    }
    // The same validation as for Claude: a home-made model is trusted no more than any other.
    return { output: validateSummary(body), usage: { inputTokens: 0, outputTokens: 0 }, model: 'local' };
  }

  suggestQuestion(context: QuestionContext): Promise<AiResult<QuestionOutput>> {
    return this.fallback.suggestQuestion(context);
  }

  classify(text: string): Promise<AiResult<ClassifyOutput>> {
    return this.fallback.classify(text);
  }
}
