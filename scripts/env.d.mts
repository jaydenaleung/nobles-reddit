export const repoRoot: string;
export function loadEnv(which: 'emulator' | 'local'): Record<string, string>;
export const FUNCTION_ENV_KEYS: string[];
export const REQUIRED_FOR_DEPLOY: string[];
export function missingForDeploy(env: Record<string, string>): string[];
