import Anthropic from '@anthropic-ai/sdk';
import * as logger from 'firebase-functions/logger';
import { buildQuestionPrompt, buildScreeningPrompt, buildSummaryPrompt, type BuiltPrompt } from './prompts';
import {
  AiUnavailable,
  classifyJsonSchema,
  questionJsonSchema,
  summaryJsonSchema,
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

interface CallOptions {
  model: string;
  prompt: BuiltPrompt;
  schema: Record<string, unknown>;
  maxTokens: number;
  effort: 'low' | 'medium';
}

/**
 * Claude, through the official SDK, from Cloud Functions only.
 * The fast model (Haiku) writes summaries and screens new posts; the smarter
 * model (Sonnet) suggests discussion questions. Both ids come from env.
 */
export class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly models: { fast: string; smart: string },
  ) {
    if (!apiKey) throw new AiUnavailable('config', 'no API key');
    // 25 seconds, one retry: an AI feature should give up rather than keep someone waiting.
    this.client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
  }

  /** One structured-output request. Returns the parsed JSON, not yet validated. */
  private async call(options: CallOptions): Promise<AiResult<unknown>> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens,
        system: options.prompt.system,
        messages: [{ role: 'user', content: options.prompt.user }],
        // Structured output: the reply must be JSON matching the schema.
        output_config: { effort: options.effort, format: { type: 'json_schema', schema: options.schema } },
      });
    } catch (error) {
      // Log the kind of failure only. Never the prompt, which holds students' words.
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        logger.error('Claude rejected the API key or its permissions', { status: error.status });
        throw new AiUnavailable('config', 'authentication');
      }
      if (error instanceof Anthropic.NotFoundError || error instanceof Anthropic.BadRequestError) {
        logger.error('Claude rejected the request', { status: error.status, model: options.model });
        throw new AiUnavailable('config', 'bad request');
      }
      if (error instanceof Anthropic.RateLimitError) {
        logger.warn('Claude rate limit reached');
        throw new AiUnavailable('down', 'rate limited');
      }
      if (error instanceof Anthropic.APIConnectionError) {
        logger.warn('Could not reach Claude');
        throw new AiUnavailable('down', 'connection');
      }
      if (error instanceof Anthropic.APIError) {
        logger.warn('Claude API error', { status: error.status });
        throw new AiUnavailable('down', `status ${error.status}`);
      }
      throw error;
    }

    const usage = {
      inputTokens:
        response.usage.input_tokens +
        (response.usage.cache_creation_input_tokens ?? 0) +
        (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens,
    };
    // Always check why the model stopped before reading what it wrote.
    if (response.stop_reason === 'refusal') throw new AiUnavailable('refusal');
    if (response.stop_reason === 'max_tokens') throw new AiUnavailable('malformed', 'cut off');

    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');
    let output: unknown;
    try {
      output = JSON.parse(text);
    } catch {
      throw new AiUnavailable('malformed', 'not JSON');
    }
    return { output, usage, model: response.model };
  }

  async summarize(thread: ThreadForSummary): Promise<AiResult<SummaryOutput>> {
    const result = await this.call({
      model: this.models.fast,
      prompt: buildSummaryPrompt(thread),
      schema: summaryJsonSchema,
      maxTokens: 4000,
      effort: 'low',
    });
    return { ...result, output: validateSummary(result.output) };
  }

  async suggestQuestion(context: QuestionContext): Promise<AiResult<QuestionOutput>> {
    const result = await this.call({
      model: this.models.smart,
      prompt: buildQuestionPrompt(context),
      schema: questionJsonSchema,
      maxTokens: 6000,
      effort: 'medium',
    });
    return { ...result, output: validateQuestions(result.output, context.bannedTopics) };
  }

  async classify(text: string): Promise<AiResult<ClassifyOutput>> {
    const result = await this.call({
      model: this.models.fast,
      prompt: buildScreeningPrompt(text),
      schema: classifyJsonSchema,
      maxTokens: 3000,
      effort: 'low',
    });
    return { ...result, output: validateClassification(result.output) };
  }
}
