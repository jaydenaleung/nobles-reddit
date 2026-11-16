// Loads configuration for scripts. Values are never printed.
//   loadEnv('emulator') reads .env.emulator (fake values, committed)
//   loadEnv('local')    reads .env.local    (real values, git-ignored)
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv(which) {
  const file = path.join(repoRoot, which === 'emulator' ? '.env.emulator' : '.env.local');
  if (!existsSync(file)) return {};
  return dotenv.parse(readFileSync(file));
}

/** Variables the Cloud Functions read at runtime. No secrets in this list. */
export const FUNCTION_ENV_KEYS = [
  'ALLOWED_EMAIL_DOMAINS',
  'BOOTSTRAP_ADMIN_EMAILS',
  'WELLBEING_CONTACT_EMAIL',
  'CLAUDE_MODEL_FAST',
  'CLAUDE_MODEL_SMART',
  'AI_PROVIDER',
  'AI_DAILY_TOKEN_BUDGET',
  'LOCAL_AI_URL',
  'ENFORCE_APP_CHECK',
  'FUNCTIONS_REGION',
  'PUBLIC_URL',
  'RETENTION_MONTHS',
  'CLASS_YEAR_MIN',
  'CLASS_YEAR_MAX',
];

/** Required before a production deploy. Reported by name only. */
export const REQUIRED_FOR_DEPLOY = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_WEB_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_APP_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'ANTHROPIC_API_KEY',
  'ALLOWED_EMAIL_DOMAINS',
  'BOOTSTRAP_ADMIN_EMAILS',
  'WELLBEING_CONTACT_EMAIL',
];

export function missingForDeploy(env) {
  return REQUIRED_FOR_DEPLOY.filter((key) => !env[key] || !String(env[key]).trim());
}
