import { schoolDate, type UsageDay } from '@commons/shared';
import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue, db } from '../admin';
import { env } from '../env';
import { ClaudeProvider } from './claudeProvider';
import { LocalProvider } from './localProvider';
import { MockProvider } from './mockProvider';
import { AiUnavailable, type AiProvider, type AiResult, type AiUsage } from './provider';

/**
 * The Claude API key. It lives in Secret Manager and is handed only to the
 * functions that list it in `secrets`. It is never in the client bundle, the
 * repository or the logs.
 */
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

let cached: AiProvider | null = null;
/** Tests can put their own provider in. */
export function setProviderForTests(provider: AiProvider | null): void {
  cached = provider;
}

export function getProvider(): AiProvider {
  if (cached) return cached;
  const claude = () =>
    new ClaudeProvider(ANTHROPIC_API_KEY.value(), { fast: env.modelFast, smart: env.modelSmart });
  switch (env.aiProvider) {
    case 'mock':
      cached = new MockProvider();
      break;
    case 'local':
      // Summaries from the hand-built model; everything else from Claude.
      cached = new LocalProvider(env.localAiUrl, env.isEmulator ? new MockProvider() : claude());
      break;
    default:
      cached = claude();
  }
  return cached;
}

function usageRef(date = schoolDate()) {
  return db.doc(`usage/${date}`);
}

export async function tokensUsedToday(): Promise<{ used: number; calls: number }> {
  const snap = await usageRef().get();
  const data = (snap.data() ?? {}) as Partial<UsageDay>;
  return {
    used: (data.anthropicInputTokens ?? 0) + (data.anthropicOutputTokens ?? 0),
    calls: data.calls ?? 0,
  };
}

async function recordUsage(usage: AiUsage): Promise<void> {
  await usageRef().set(
    {
      anthropicInputTokens: FieldValue.increment(usage.inputTokens),
      anthropicOutputTokens: FieldValue.increment(usage.outputTokens),
      calls: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Runs one AI call behind the daily budget circuit breaker and writes what it
 * cost to the usage ledger.
 *
 * Whatever goes wrong (budget spent, API down, malformed output, a refusal, a
 * missing key) the caller gets an AiUnavailable and carries on without AI.
 */
export async function runAi<T>(task: (provider: AiProvider) => Promise<AiResult<T>>): Promise<AiResult<T>> {
  const { used } = await tokensUsedToday();
  if (used >= env.aiDailyTokenBudget) throw new AiUnavailable('budget');
  try {
    const result = await task(getProvider());
    await recordUsage(result.usage);
    return result;
  } catch (error) {
    if (error instanceof AiUnavailable) {
      logger.warn('AI feature unavailable', { reason: error.reason });
      throw error;
    }
    logger.error('AI call failed unexpectedly', { name: error instanceof Error ? error.name : 'unknown' });
    throw new AiUnavailable('down', 'unexpected');
  }
}

export { AiUnavailable };
