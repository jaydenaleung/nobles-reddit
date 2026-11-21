/**
 * Lighthouse on the front page, a thread and the hall screen.
 *
 *   npm run lighthouse
 *
 * (That script builds the app, starts the emulators and seeds them first.)
 * A real browser is signed in through the Auth emulator, then Lighthouse is
 * pointed at the same browser so that the member pages are measured signed in.
 * Results go to docs/reports/lighthouse.md. The run fails if accessibility is
 * below 95 on any page.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { repoRoot } from './env.mjs';

const BASE = 'http://127.0.0.1:5000';
const PORT = 9333;
const MIN_ACCESSIBILITY = 95;

async function isUp(): Promise<boolean> {
  try {
    return (await fetch(`${BASE}/values`)).ok;
  } catch {
    return false;
  }
}

async function ensurePreview(): Promise<ChildProcess | null> {
  if (await isUp()) return null;
  const child = spawn('npm', ['run', 'preview', '-w', 'apps/web'], {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    if (await isUp()) return child;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('The preview server did not start.');
}

const preview = await ensurePreview();
const profile = mkdtempSync(path.join(os.tmpdir(), 'commons-lighthouse-'));
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  args: [`--remote-debugging-port=${PORT}`],
  viewport: { width: 1280, height: 900 },
});

let failed = false;
const rows: string[] = [];
try {
  // Sign in as a made-up student and finish onboarding.
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Any email address').fill(`lighthouse.${Date.now().toString(36)}@nobles.edu`);
  await page.getByRole('button', { name: 'Sign in as this address' }).click();
  await page.waitForURL('**/onboarding');
  await page.getByLabel('First name').fill('Sample');
  await page.getByLabel('Last initial').fill('L');
  await page.getByLabel('A student').check();
  await page.getByLabel('Class year').selectOption('2028');
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: 'Join the conversation' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.goto(`${BASE}/s/current-events`);
  await page
    .getByRole('region', { name: 'Threads' })
    .getByRole('link', { name: /Should the school day start at 8:30/ })
    .click();
  await page.waitForURL(/\/t\//);
  const thread = new URL(page.url()).pathname;
  await page.goto('about:blank');

  const targets = [
    { name: 'Front page', route: '/' },
    { name: 'Thread', route: thread },
    { name: 'Hall screen', route: '/board' },
  ];
  const score = (value: number | null | undefined) =>
    value == null ? 'n/a' : String(Math.round(value * 100));

  for (const target of targets) {
    for (const mode of ['phone', 'desktop'] as const) {
      const result = await lighthouse(
        `${BASE}${target.route}`,
        {
          port: PORT,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility', 'best-practices'],
          // Keep the sign-in: do not clear storage between runs.
          disableStorageReset: true,
        },
        mode === 'desktop' ? desktopConfig : undefined,
      );
      if (!result) throw new Error(`Lighthouse returned nothing for ${target.route}`);
      const categories = result.lhr.categories;
      const accessibility = categories.accessibility?.score ?? 0;
      if (Math.round(accessibility * 100) < MIN_ACCESSIBILITY) failed = true;
      // Make sure the signed-in page was measured, not a redirect to the sign-in page.
      const finalUrl = result.lhr.finalDisplayedUrl ?? '';
      if (new URL(finalUrl).pathname !== target.route) {
        throw new Error(`Expected to measure ${target.route} but ended on ${finalUrl}`);
      }
      const line = `| ${target.name} | ${mode} | ${score(categories.performance?.score)} | ${score(accessibility)} | ${score(categories['best-practices']?.score)} |`;
      rows.push(line);
      console.log(line);
    }
  }
} finally {
  await context.close();
  preview?.kill();
}

const report = [
  '# Lighthouse results',
  '',
  `Run on ${new Date().toISOString().slice(0, 10)} against the emulator build served by \`vite preview\` (Lighthouse ${'12'}, headless Chromium).`,
  'Member pages were measured signed in. Performance on a laptop against local emulators is a rough guide only;',
  'measure again on the live site.',
  '',
  '| Page | Mode | Performance | Accessibility | Best practices |',
  '| --- | --- | --- | --- | --- |',
  ...rows,
  '',
  `The run fails if accessibility is below ${MIN_ACCESSIBILITY} on any page.`,
  '',
].join('\n');
mkdirSync(path.join(repoRoot, 'docs/reports'), { recursive: true });
writeFileSync(path.join(repoRoot, 'docs/reports/lighthouse.md'), report);
console.log(failed ? 'FAILED: accessibility below 95 somewhere.' : 'Lighthouse finished.');
process.exit(failed ? 1 : 0);
