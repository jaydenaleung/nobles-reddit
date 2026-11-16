import {
  DEFAULT_AI_DAILY_TOKEN_BUDGET,
  DEFAULT_ALLOWED_DOMAINS,
  DEFAULT_CLASS_YEAR_MAX,
  DEFAULT_CLASS_YEAR_MIN,
  DEFAULT_RETENTION_MONTHS,
} from '@commons/shared';

function list(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}
function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== undefined && value !== '' ? parsed : fallback;
}

/**
 * Runtime configuration. None of these are secrets: the Anthropic key is a
 * Secret Manager secret (see ai/index.ts) and is never read from here.
 */
export const env = {
  region: process.env.FUNCTIONS_REGION || 'us-east1',
  allowedDomains: list(process.env.ALLOWED_EMAIL_DOMAINS, DEFAULT_ALLOWED_DOMAINS),
  bootstrapAdmins: list(process.env.BOOTSTRAP_ADMIN_EMAILS, []),
  wellbeingEmail: (process.env.WELLBEING_CONTACT_EMAIL ?? '').trim(),
  modelFast: process.env.CLAUDE_MODEL_FAST || 'claude-haiku-5-5',
  modelSmart: process.env.CLAUDE_MODEL_SMART || 'claude-sonnet-5-5',
  aiProvider: (process.env.AI_PROVIDER || 'claude').toLowerCase(),
  aiDailyTokenBudget: number(process.env.AI_DAILY_TOKEN_BUDGET, DEFAULT_AI_DAILY_TOKEN_BUDGET),
  localAiUrl: process.env.LOCAL_AI_URL || 'http://127.0.0.1:8000',
  enforceAppCheck: (process.env.ENFORCE_APP_CHECK ?? 'false').toLowerCase() === 'true',
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  retentionMonths: number(process.env.RETENTION_MONTHS, DEFAULT_RETENTION_MONTHS),
  classYearMin: number(process.env.CLASS_YEAR_MIN, DEFAULT_CLASS_YEAR_MIN),
  classYearMax: number(process.env.CLASS_YEAR_MAX, DEFAULT_CLASS_YEAR_MAX),
  isEmulator: process.env.FUNCTIONS_EMULATOR === 'true',
};

export function emailDomain(email: string): string {
  return email.toLowerCase().split('@')[1] ?? '';
}
export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return env.allowedDomains.includes(emailDomain(email));
}
