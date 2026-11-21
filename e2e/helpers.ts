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
    await page.getByLabel(/I read the community values/).check();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForURL((url) => url.pathname === '/');
  }
  await expect(page.getByRole('navigation', { name: 'Sort' })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.goto('/me');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/sign-in');
}

export interface NewThread {
  space?: string;
  title: string;
  body?: string;
}

/** Starts a text thread, under your name, and returns its id once it is published. */
export async function startThread(page: Page, thread: NewThread): Promise<string> {
  await page.goto('/new');
  await page.getByLabel('Space', { exact: true }).selectOption({ label: thread.space ?? 'Clubs' });
  await page.getByLabel('Title', { exact: true }).fill(thread.title);
  if (thread.body) await page.getByLabel('Text', { exact: true }).fill(thread.body);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await page.waitForURL(/\/t\/[A-Za-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: thread.title })).toBeVisible();
  return page.url().split('/t/')[1]!;
}

/** Adds a top-level comment, under your name, on the thread that is open. */
export async function addComment(page: Page, body: string): Promise<void> {
  const composer = page.getByRole('region', { name: 'Add a comment' });
  await composer.getByLabel('Add a comment').fill(body);
  await composer.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.locator('.th-comments').getByText(body)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.nb-comment--pending')).toHaveCount(0, { timeout: 30_000 });
}

/**
 * Turns a thread into one written before anonymous posting was turned off, by
 * writing to the Firestore emulator directly (the "owner" token bypasses the
 * rules). New posts can't be anonymous, but older ones still read "Anonymous".
 */
export async function makeLegacyAnonymous(page: Page, postId: string): Promise<void> {
  const url =
    'http://127.0.0.1:8080/v1/projects/demo-nobles-commons/databases/(default)/documents/' +
    `posts/${postId}?updateMask.fieldPaths=authorDisplay`;
  const response = await page.request.patch(url, {
    headers: { Authorization: 'Bearer owner' },
    data: {
      fields: {
        authorDisplay: {
          mapValue: {
            fields: { mode: { stringValue: 'anonymous' }, anonLabel: { stringValue: 'Anonymous A' } },
          },
        },
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
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
  // Scoped to the feed, in case the question is linked from anywhere else on the page.
  await page
    .getByRole('region', { name: 'Threads' })
    .getByRole('link', { name: /Should the school day start at 8:30/ })
    .click();
  await page.waitForURL(/\/t\//);
  return new URL(page.url()).pathname;
}
