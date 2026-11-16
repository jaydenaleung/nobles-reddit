// Pushes ANTHROPIC_API_KEY from .env.local into Firebase Secret Manager.
// The value is piped on stdin, so it never appears in a command line, a log
// or the terminal.
import { spawn } from 'node:child_process';
import { loadEnv, repoRoot } from './env.mjs';

const env = loadEnv('local');
const key = env.ANTHROPIC_API_KEY;
const projectId = env.FIREBASE_PROJECT_ID;
if (!key || !projectId) {
  console.error('ANTHROPIC_API_KEY or FIREBASE_PROJECT_ID is missing from .env.local.');
  process.exit(1);
}

const child = spawn(
  'npx',
  ['firebase', 'functions:secrets:set', 'ANTHROPIC_API_KEY', '--project', projectId, '--data-file', '-', '--force'],
  {
    cwd: repoRoot,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
    env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: env.GOOGLE_APPLICATION_CREDENTIALS ?? '' },
  },
);
child.stdin.write(key);
child.stdin.end();
child.on('exit', (code) => {
  console.log(code === 0 ? 'Secret stored in Secret Manager.' : 'Could not store the secret.');
  process.exit(code ?? 1);
});
