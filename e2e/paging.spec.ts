import { expect, test } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { freshEmail, signIn } from './helpers';

const TOTAL = 45;

/** Writes a space with TOTAL posts straight into the emulator, newest hot score first. */
async function seedSpace(): Promise<string> {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-nobles-commons' });
  const db = getFirestore(app);
  const slug = `paging-${Date.now().toString(36)}`;
  const space = db.collection('spaces').doc();
  await space.set({
    name: `Paging ${slug.slice(7)}`,
    slug,
    description: 'Posts for the paging test.',
    order: 99,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
    isPublic: true,
    postCount: TOTAL,
    createdAt: Timestamp.now(),
  });
  const batch = db.batch();
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  for (let i = 1; i <= TOTAL; i++) {
    batch.set(db.collection('posts').doc(), {
      spaceId: space.id,
      spaceName: 'Paging',
      kind: 'text',
      title: `Paging post ${i}`,
      body: '',
      authorDisplay: { mode: 'anonymous', anonLabel: 'Anonymous A' },
      thoughtfulCount: 0,
      commentCount: 0,
      anonCommentCount: 0,
      hotScore: 100 - i,
      pinned: false,
      status: 'visible',
      screening: 'clear',
      searchTokens: [],
      createdAt: Timestamp.fromMillis(threeDaysAgo - i * 60_000),
    });
  }
  await batch.commit();
  return slug;
}

test('the feed loads the next page near the bottom, keeps it in the address and stops at the last post', async ({
  page,
}) => {
  const slug = await seedSpace();
  await signIn(page, freshEmail('paging'), { firstName: 'Paige', lastInitial: 'P', classYear: 2027 });
  await page.goto(`/s/${slug}`);

  const titles = page.getByRole('region', { name: 'Posts' }).getByRole('heading', { level: 3 });
  const toBottom = () => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(titles).toHaveCount(20);
  await expect(page).not.toHaveURL(/page=/);

  await toBottom();
  await expect(titles).toHaveCount(40);
  await expect(page).toHaveURL(/[?&]page=2\b/);

  await toBottom();
  await expect(titles).toHaveCount(TOTAL);
  await expect(page).toHaveURL(/[?&]page=3\b/);
  await expect(page.getByText('That’s every post.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Post something' })).toBeVisible();

  const expected = Array.from({ length: TOTAL }, (_, i) => `Paging post ${i + 1}`);
  expect(await titles.allTextContents()).toEqual(expected);

  // A refresh opens with the same three pages loaded, and scrolling further adds nothing.
  await page.reload();
  await expect(titles).toHaveCount(TOTAL);
  await expect(page).toHaveURL(/[?&]page=3\b/);
  await toBottom();
  await expect(page.getByText('That’s every post.')).toBeVisible();
  expect(await titles.allTextContents()).toEqual(expected);
});
