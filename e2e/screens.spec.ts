import path from 'node:path';
import { test, type Page } from '@playwright/test';
import { openQuestionThread, setTheme, signIn } from './helpers';

const OUT = path.resolve(process.cwd(), 'docs/screens');
const SIZES = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 900 },
] as const;

/** Firestore keeps a live connection open, so "network idle" never comes. Wait for content instead. */
async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#main, .bd').first().waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"], .state[role="status"]'),
    null,
    {
      timeout: 20_000,
    },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

async function shoot(page: Page, name: string, route: string) {
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto(route);
    await settle(page);
    await page.screenshot({ path: path.join(OUT, `${name}-${size.name}.png`), fullPage: true });
  }
}

test('public pages', async ({ page }) => {
  await shoot(page, 'sign-in', '/sign-in');
  await shoot(page, 'about', '/about');
});

test('the hall screen at 1920x1080', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/board');
  await settle(page);
  await page.screenshot({ path: path.join(OUT, 'board-1920x1080.png') });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/board');
  await settle(page);
  await page.screenshot({ path: path.join(OUT, 'board-375.png'), fullPage: true });
});

test('onboarding', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Any email address').fill(`screens.new.${Date.now().toString(36)}@nobles.edu`);
  await page.getByRole('button', { name: 'Sign in as this address' }).click();
  await page.waitForURL('**/onboarding');
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await settle(page);
    await page.screenshot({ path: path.join(OUT, `onboarding-${size.name}.png`), fullPage: true });
  }
});

test('member, moderator and admin pages', async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, 'sample.admin@nobles.edu', {
    firstName: 'Sample',
    lastInitial: 'A',
    classYear: 'faculty',
  });
  const thread = await openQuestionThread(page);
  await shoot(page, 'front-page', '/');
  await shoot(page, 'space', '/s/current-events');
  await shoot(page, 'thread', thread);
  await shoot(page, 'new', '/new');
  await shoot(page, 'me', '/me');
  await shoot(page, 'spaces', '/spaces');
  await shoot(page, 'search', '/search?q=lacrosse');
  await shoot(page, 'mod', '/mod');
  await shoot(page, 'admin', '/admin');
  await shoot(page, 'admin-audit', '/admin/audit');
  await shoot(page, 'not-found', '/this/page/does/not/exist');

  // Night theme
  await setTheme(page, 'night');
  for (const [name, route] of [
    ['front-page-night', '/'],
    ['thread-night', thread],
    ['new-night', '/new'],
  ] as const) {
    await shoot(page, name, route);
  }
});
