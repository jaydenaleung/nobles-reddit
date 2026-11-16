// Deploys Nobles Commons to the Firebase project in .env.local.
//
//   npm run deploy
//
// It refuses to start if anything it needs is missing, and it names what is
// missing without printing any values. Steps: secret scan, build, write the
// functions' runtime settings, push the Claude key to Secret Manager (piped,
// never echoed), deploy rules + indexes + functions + hosting, smoke test.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnv, missingForDeploy, repoRoot } from './env.mjs';

const env = loadEnv('local');
const missing = missingForDeploy(env);
if (missing.length > 0) {
  console.error('Cannot deploy yet. These are missing from .env.local:');
  for (const name of missing) console.error(`  - ${name}`);
  console.error('See docs/DEPLOY.md for what each one is. Nothing was deployed.');
  process.exit(1);
}
const credentials = path.resolve(repoRoot, env.GOOGLE_APPLICATION_CREDENTIALS);
if (!existsSync(credentials)) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS points at a file that does not exist. Nothing was deployed.');
  process.exit(1);
}

const projectId = env.FIREBASE_PROJECT_ID;
const childEnv = { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: credentials };

function run(label, command, args) {
  console.log(`\n== ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: childEnv,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`"${label}" failed. Stopping. Nothing after this step was run.`);
    process.exit(result.status ?? 1);
  }
}

run('Secret scan', 'bash', ['scripts/check-secrets.sh']);
run('Build the web app (production settings)', 'npm', ['run', 'build', '-w', 'apps/web']);
run('Build the functions', 'npm', ['run', 'build', '-w', 'functions']);
run('Secret scan of the built site', 'bash', ['scripts/check-secrets.sh']);
run('Write the functions runtime settings', 'node', ['scripts/sync-functions-env.mjs']);
run('Store the Claude key in Secret Manager', 'node', ['scripts/push-secret.mjs']);
run('Deploy rules, indexes, functions and hosting', 'npx', [
  'firebase',
  'deploy',
  '--project',
  projectId,
  '--only',
  'firestore:rules,firestore:indexes,functions,hosting',
  '--non-interactive',
]);
run('Smoke test the live site', 'node', ['scripts/smoke.mjs']);

console.log(`\nDeployed: ${env.PUBLIC_URL || `https://${projectId}.web.app`}`);
