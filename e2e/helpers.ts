import { expect, type Page } from '@playwright/test';

let counter = 0;
/** A made-up school address that no earlier test has used. */
export function freshEmail(label: string): string {
  counter += 1;
  return `e2e.${label}.${Date.now().toString(36)}${counter}@nobles.edu`;
}

export interface Who {
  firstName: string;
  lastInitial: string;
  /** A class year for students, or 'faculty'. */
  classYear: number | 'faculty';
}

/**
 * Signs in through the Auth emulator's Google provider (the "Local
 * development" box on the sign-in page, which only exists in emulator builds)
 * and completes onboarding if this person is new.
 */
export async function signIn(page: Page, email: string, who: Who): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Any email address').fill(email);
  await page.getByRole('button', { name: 'Sign in as this address' }).click();
  await page.waitForURL((url) => url.pathname === '/onboarding' || url.pathname === '/');
  if (new URL(page.url()).pathname === '/onboarding') {
    await page.getByLabel('First name').fill(who.firstName);
    await page.getByLabel('Last initial').fill(who.lastInitial);
    if (who.classYear === 'faculty') {
      await page.getByLabel('Faculty or staff').check();
    } else {
      await page.getByLabel('A student').check();
      await page.getByLabel('Class year').selectOption(String(who.classYear));
    }
    await page.getByLabel(/I understand/).check();
    await page.getByRole('button', { name: 'Join the conversation' }).click();
    await page.waitForURL((url) => url.pathname === '/');
  }
  await expect(page.getByRole('navigation', { name: 'Sort' })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.goto('/me');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/sign-in');
}

/** Picks "your name" or "Anonymous" in an identity toggle. Nothing is ever preselected, so tests must choose. */
export async function chooseIdentity(page: Page, group: 'Post as' | 'Reply as', text: string): Promise<void> {
  await page
    .getByRole('radiogroup', { name: group })
    .first()
    .locator('label')
    .filter({ hasText: text })
    .click();
}

export interface NewThread {
  space?: string;
  title: string;
  body?: string;
  as: 'name' | 'anonymous';
  firstName: string;
}

/** Starts a text thread and returns its id once it is published. */
export async function startThread(page: Page, thread: NewThread): Promise<string> {
  await page.goto('/new');
  await page.getByLabel('Space', { exact: true }).selectOption({ label: thread.space ?? 'Clubs' });
  await page
    .getByRole('radiogroup', { name: 'Post as' })
    .locator('label')
    .filter({ hasText: thread.as === 'anonymous' ? 'Anonymous' : thread.firstName })
    .click();
  await page.getByLabel('Title', { exact: true }).fill(thread.title);
  if (thread.body) await page.getByLabel('Your thoughts', { exact: true }).fill(thread.body);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await page.waitForURL(/\/t\/[A-Za-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: thread.title })).toBeVisible();
  return page.url().split('/t/')[1]!;
}

/** Adds a top-level comment on the thread that is open. */
export async function addComment(
  page: Page,
  body: string,
  as: 'name' | 'anonymous',
  firstName: string,
): Promise<void> {
  const composer = page.getByRole('region', { name: 'Add a comment' });
  await composer
    .getByRole('radiogroup', { name: 'Reply as' })
    .locator('label')
    .filter({ hasText: as === 'anonymous' ? 'Anonymous' : firstName })
    .click();
  await composer.getByLabel('Add a comment').fill(body);
  await composer.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.locator('.th-comments').getByText(body)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.nb-comment--pending')).toHaveCount(0, { timeout: 30_000 });
}

export async function setTheme(page: Page, theme: 'paper' | 'night'): Promise<void> {
  await page.evaluate((value) => {
    window.localStorage.setItem('commons.theme', value);
    document.documentElement.setAttribute('data-theme', value);
  }, theme);
}

/** Opens the seeded question-of-the-day thread and returns its path. */
export async function openQuestionThread(page: Page): Promise<string> {
  await page.goto('/s/current-events');
  // Scoped to the feed: the sidebar's hall-screen box shows the same question and links to /board.
  await page
    .getByRole('region', { name: 'Threads' })
    .getByRole('link', { name: /Should the school day start at 8:30/ })
    .click();
  await page.waitForURL(/\/t\//);
  return new URL(page.url()).pathname;
}
