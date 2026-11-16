// A quick check that a deployed site is alive and locked.
//
//   npm run smoke                 -> the live site from .env.local (PUBLIC_URL)
//   npm run smoke -- --emulator   -> the local preview server and emulators
//
// It checks that the sign-in page and the hall screen load, that the security
// headers are there, and that a function refuses someone who is not signed in.
import { loadEnv } from './env.mjs';

const emulator = process.argv.includes('--emulator');
const env = loadEnv(emulator ? 'emulator' : 'local');
const projectId = env.FIREBASE_PROJECT_ID;
const region = env.FUNCTIONS_REGION || 'us-east1';
const site = (emulator ? 'http://127.0.0.1:5000' : env.PUBLIC_URL || `https://${projectId}.web.app`).replace(
  /\/$/,
  '',
);
const functionsBase = emulator
  ? `http://127.0.0.1:5001/${projectId}/${region}`
  : `https://${region}-${projectId}.cloudfunctions.net`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function page(route) {
  const response = await fetch(`${site}${route}`, { redirect: 'follow' });
  const body = await response.text();
  return { response, body };
}

try {
  const signIn = await page('/sign-in');
  check(
    'sign-in page loads',
    signIn.response.status === 200 && signIn.body.includes('id="root"'),
    `status ${signIn.response.status}`,
  );

  const board = await page('/board');
  check(
    'hall screen loads',
    board.response.status === 200 && board.body.includes('id="root"'),
    `status ${board.response.status}`,
  );

  const csp = signIn.response.headers.get('content-security-policy') ?? '';
  check(
    'Content-Security-Policy is set',
    csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'"),
  );
  check('no inline scripts allowed', !csp.includes("'unsafe-inline'") && !csp.includes("'unsafe-eval'"));
  check(
    'X-Content-Type-Options is nosniff',
    signIn.response.headers.get('x-content-type-options') === 'nosniff',
  );
  check(
    'Referrer-Policy is strict-origin-when-cross-origin',
    signIn.response.headers.get('referrer-policy') === 'strict-origin-when-cross-origin',
  );
  if (!emulator) {
    check(
      'HSTS is set',
      (signIn.response.headers.get('strict-transport-security') ?? '').includes('max-age='),
    );
  }

  // A function must refuse a caller who is not signed in, with the expected error and nothing more.
  for (const name of ['createPost', 'revealAuthor']) {
    const response = await fetch(`${functionsBase}/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    });
    const body = await response.json().catch(() => ({}));
    check(
      `${name} refuses an unauthenticated caller`,
      response.status === 401 && body?.error?.status === 'UNAUTHENTICATED',
      `status ${response.status}, ${body?.error?.status ?? 'no error body'}`,
    );
  }
} catch (error) {
  check('the site is reachable', false, error instanceof Error ? error.message : String(error));
}

console.log(
  failures === 0 ? `Smoke test passed: ${site}` : `Smoke test FAILED (${failures} problems): ${site}`,
);
process.exit(failures === 0 ? 0 : 1);
