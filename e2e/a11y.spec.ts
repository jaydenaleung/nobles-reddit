import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { chooseIdentity, freshEmail, openQuestionThread, setTheme, signIn } from './helpers';

/**
 * axe on every route, in Paper and Night (and Board for the hall screen),
 * at both screen sizes. Zero serious or critical violations allowed.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function ready(page: Page) {
  await page.locator('#main, .bd').first().waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"], .state[role="status"]'),
    null,
    {
      timeout: 20_000,
    },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = bad.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(summary, `${label}: serious or critical accessibility violations`).toEqual([]);
}

async function checkBothThemes(page: Page, route: string) {
  await page.goto(route);
  for (const theme of ['paper', 'night'] as const) {
    await setTheme(page, theme);
    await ready(page);
    await expectNoSeriousViolations(page, `${route} [${theme}]`);
  }
}

test('public pages: sign-in, about, not found', async ({ page }) => {
  for (const route of ['/sign-in', '/about', '/no/such/page']) await checkBothThemes(page, route);
});

test('the hall screen, in the Board theme', async ({ page }) => {
  await page.goto('/board');
  await ready(page);
  await expectNoSeriousViolations(page, '/board [board]');
});

test('onboarding', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Any email address').fill(freshEmail('a11y'));
  await page.getByRole('button', { name: 'Sign in as this address' }).click();
  await page.waitForURL('**/onboarding');
  for (const theme of ['paper', 'night'] as const) {
    await setTheme(page, theme);
    await ready(page);
    await expectNoSeriousViolations(page, `/onboarding [${theme}]`);
  }
});

test('member, moderator and admin pages', async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, 'sample.admin@nobles.edu', {
    firstName: 'Sample',
    lastInitial: 'A',
    classYear: 'faculty',
  });
  const thread = await openQuestionThread(page);
  const routes = [
    '/',
    '/s/current-events',
    '/s/ask-the-office',
    thread,
    '/new',
    '/me',
    '/spaces',
    '/search?q=lacrosse',
    '/search?q=zzzznothing',
    '/mod',
    '/admin',
    '/admin/audit',
  ];
  for (const route of routes) await checkBothThemes(page, route);
});

test('dialogs and forms in use', async ({ page }) => {
  await signIn(page, 'sample.admin@nobles.edu', {
    firstName: 'Sample',
    lastInitial: 'A',
    classYear: 'faculty',
  });
  await openQuestionThread(page);
  await ready(page);

  await page.locator('.th-card').first().getByRole('button', { name: 'Report' }).click();
  await expectNoSeriousViolations(page, 'report dialog');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await page.locator('.th-card').first().getByRole('button', { name: 'Who wrote this?' }).click();
  await expectNoSeriousViolations(page, 'reveal dialog');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  // The composer with an identity chosen and an error showing.
  await page.goto('/new');
  await chooseIdentity(page, 'Post as', 'Anonymous');
  await page.getByRole('tab', { name: 'Poll' }).click();
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expectNoSeriousViolations(page, 'composer with a poll and an error');

  // Each administration tab.
  await page.goto('/admin');
  for (const tab of ['Spaces', 'Question of the day', 'Who wrote it', 'AI budget', 'Settings']) {
    await page.getByRole('tab', { name: tab }).click();
    await ready(page);
    await expectNoSeriousViolations(page, `admin tab: ${tab}`);
  }
  await page.goto('/mod');
  for (const tab of ['Reports', 'Question of the day']) {
    await page.getByRole('tab', { name: tab }).click();
    await ready(page);
    await expectNoSeriousViolations(page, `moderation tab: ${tab}`);
  }
});

test('everything can be reached with the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard navigation is checked at the desktop size.');
  await signIn(page, 'sample.admin@nobles.edu', {
    firstName: 'Sample',
    lastInitial: 'A',
    classYear: 'faculty',
  });
  await page.goto('/');
  await ready(page);
  // The first Tab stop is the skip link, and it becomes visible.
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  // A focused control shows a 2px outline.
  const vote = page.getByRole('button', { name: 'Upvote' }).first();
  await vote.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const outline = await vote.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(outline).toBe('2px');
  // Votes say whether they are pressed.
  await expect(vote).toHaveAttribute('aria-pressed', /true|false/);
});
