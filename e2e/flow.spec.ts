import { expect, test, type Page } from '@playwright/test';
import { addComment, chooseIdentity, freshEmail, signIn, signOut, startThread } from './helpers';

/**
 * The main journey, on the Firebase emulators, under the same
 * Content-Security-Policy as production. It runs twice: at 1280x900 and on a
 * 375x812 phone.
 */
const AUTH = 'http://127.0.0.1:9099';
const PROJECT = 'demo-nobles-commons';

/** Looks up a uid in the Auth emulator, so the tests can check it never reaches another student's page. */
async function uidFor(page: Page, email: string): Promise<string> {
  const response = await page.request.post(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,
    { headers: { Authorization: 'Bearer owner' }, data: { email: [email] } },
  );
  const body = (await response.json()) as { users?: { localId: string }[] };
  const uid = body.users?.[0]?.localId;
  if (!uid) throw new Error('The Auth emulator does not know that account.');
  return uid;
}

test.describe.serial('the main journey', () => {
  const author = {
    email: freshEmail('author'),
    firstName: 'Zephyrine',
    lastInitial: 'Q',
    classYear: 2031,
  } as const;
  const reader = {
    email: freshEmail('reader'),
    firstName: 'Bystander',
    lastInitial: 'B',
    classYear: 2028,
  } as const;
  const stamp = Date.now().toString(36);
  const namedTitle = `A named thread about lunch ${stamp}`;
  // A word that appears only in the anonymous thread, so search results hold that thread alone.
  const anonWord = `quokka${stamp}`;
  const anonTitle = `An anonymous thread about homework ${anonWord}`;
  let namedId = '';
  let anonId = '';
  let authorUid = '';

  test('sign in with the emulator Google account and onboard', async ({ page }) => {
    await signIn(page, author.email, author);
    await expect(page).toHaveURL(/\/$/);
    // The seeded sample threads are in the feed.
    await expect(page.getByRole('region', { name: 'Threads' }).getByRole('article').first()).toBeVisible();
    authorUid = await uidFor(page, author.email);
  });

  test('the composer never preselects Anonymous and always shows the administration notice', async ({
    page,
  }) => {
    await signIn(page, author.email, author);
    await page.goto('/new');
    const group = page.getByRole('radiogroup', { name: 'Post as' });
    await expect(group.getByRole('radio')).toHaveCount(2);
    for (const radio of await group.getByRole('radio').all()) await expect(radio).not.toBeChecked();
    await expect(
      page.getByText(
        'Anonymous hides your name from other students. The administration can always see who wrote every post and comment.',
      ),
    ).toBeVisible();
    // Posting without choosing is refused with a plain message.
    await page.getByLabel('Space', { exact: true }).selectOption({ label: 'Clubs' });
    await page.getByLabel('Title', { exact: true }).fill('A thread with no identity chosen');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Choose' }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/new$/);
  });

  test('post under your name', async ({ page }) => {
    await signIn(page, author.email, author);
    namedId = await startThread(page, {
      title: namedTitle,
      body: 'This is **bold**, this is *italic*, and this is a link: https://example.org/menu',
      as: 'name',
      firstName: author.firstName,
    });
    const card = page.locator('.th-card').first();
    await expect(card.getByText('Zephyrine Q.')).toBeVisible();
    await expect(card.getByText('’31')).toBeVisible();
    // The safe formatter: bold and italic become elements, the https link is a safe link.
    await expect(card.locator('strong')).toHaveText('bold');
    await expect(card.locator('em')).toHaveText('italic');
    const link = card.getByRole('link', { name: 'https://example.org/menu' });
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('post anonymously, comment and vote', async ({ page }) => {
    await signIn(page, author.email, author);
    anonId = await startThread(page, {
      space: 'Middle school',
      title: anonTitle,
      body: 'I am new this year and do not know who to ask.',
      as: 'anonymous',
      firstName: author.firstName,
    });
    const card = page.locator('.th-card').first();
    await expect(card.getByText('Anonymous A')).toBeVisible();
    await expect(card).not.toContainText('Zephyrine');

    await addComment(page, 'An anonymous follow-up from the same person.', 'anonymous', author.firstName);
    const comment = page.locator('.th-comments .nb-comment').first();
    await expect(comment.getByText('Anonymous A')).toBeVisible();
    await expect(comment).not.toContainText('Zephyrine');
    await expect(page.getByRole('heading', { name: '1 comment' })).toBeVisible();

    // Thoughtful: the count moves at once (optimistic) and is still there after a reload.
    const vote = card.getByRole('button', { name: /Thoughtful/ });
    await expect(vote).toHaveAttribute('aria-pressed', 'false');
    const saved = page.waitForResponse((response) => response.url().includes('toggleThoughtful'));
    await vote.click();
    // Optimistic: the button changes before the server has answered.
    await expect(vote).toHaveAttribute('aria-pressed', 'true');
    await expect(vote).toContainText('Thoughtful · 1');
    expect((await saved).status()).toBe(200);
    await page.reload();
    await expect(
      page
        .locator('.th-card')
        .first()
        .getByRole('button', { name: /Thoughtful/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page
        .locator('.th-card')
        .first()
        .getByRole('button', { name: /Thoughtful/ }),
    ).toContainText('Thoughtful · 1');
    // The author can find their own anonymous post under You.
    await page.goto('/me');
    await expect(page.getByRole('link', { name: anonTitle })).toBeVisible();
  });

  test('text that looks like HTML is shown as text and never runs', async ({ page }) => {
    await signIn(page, author.email, author);
    const title = `<img src=x onerror="window.__xss=1"> ${stamp}`;
    await startThread(page, {
      title,
      body: '<script>window.__xss = 2</script> <b>not bold</b>',
      as: 'name',
      firstName: author.firstName,
    });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('<img src=x onerror=');
    await expect(page.locator('.th-body')).toContainText('<script>window.__xss = 2</script>');
    expect(await page.locator('.th-body b, .th-body script, .th-title img').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test('another student sees the anonymous thread with no trace of who wrote it', async ({ page }) => {
    await signIn(page, reader.email, reader);
    const secrets = [authorUid, 'Zephyrine', author.email, 'e2e.author', '2031', '’31'];
    const check = async (label: string) => {
      const html = await page.content();
      for (const secret of secrets) {
        expect(html.includes(secret), `${label} must not contain "${secret}"`).toBe(false);
      }
    };

    await page.goto(`/t/${anonId}`);
    await expect(page.getByRole('heading', { level: 1, name: anonTitle })).toBeVisible();
    await expect(page.locator('.th-comments .nb-comment').first()).toBeVisible();
    await check('the thread');
    // No edit, delete or "who wrote this" for another student.
    await expect(page.getByRole('button', { name: 'Who wrote this?' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    await page.goto('/s/middle-school?sort=new');
    await expect(page.getByRole('link', { name: anonTitle })).toBeVisible();
    await check('the feed');

    await page.goto(`/search?q=${anonWord}`);
    await expect(page.getByRole('link', { name: anonTitle })).toBeVisible();
    await check('search results');
    // Searching for the author finds nothing: authors are never indexed.
    await page.goto('/search?q=Zephyrine');
    await expect(page.getByText('No threads match that')).toBeVisible();

    // The reader can reply, and report, without learning anything.
    await page.goto(`/t/${anonId}`);
    await addComment(page, 'A named reply from someone else.', 'name', reader.firstName);
    await page.locator('.th-card').first().getByRole('button', { name: 'Report' }).click();
    const dialog = page.getByRole('dialog', { name: 'Report this to a moderator' });
    await dialog.getByLabel('It is spam or off topic').check();
    await dialog.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByText('Thank you. A moderator will take a look.')).toBeVisible();
    await check('the thread after replying and reporting');
  });

  test('a moderator can hold the thread but cannot see the author', async ({ page }) => {
    await signIn(page, 'sample.moderator@nobles.edu', {
      firstName: 'Sample',
      lastInitial: 'M',
      classYear: 'faculty',
    });
    await page.goto('/mod');
    await expect(page.getByRole('heading', { level: 1, name: 'Moderation' })).toBeVisible();
    // The report from the last test is in the queue, with the text and no author.
    const item = page.locator('.q-item').filter({ hasText: anonTitle });
    await expect(item).toBeVisible();
    await expect(page.locator('#main')).not.toContainText('Zephyrine');
    expect((await page.content()).includes(authorUid)).toBe(false);

    await page.goto(`/t/${anonId}`);
    await expect(page.getByRole('button', { name: 'Who wrote this?' })).toHaveCount(0);
    await page.locator('.th-card').first().getByRole('button', { name: 'Moderate' }).click();
    const dialog = page.getByRole('dialog', { name: 'Moderate this thread' });
    await dialog.getByLabel('Hold for review (hide it for now)').check();
    await dialog.getByLabel('Note for the audit log').fill('Holding while we check');
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Only moderators can see this thread.')).toBeVisible();
    // The administration page is closed to moderators.
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/$/);
  });

  test('a held thread is not available to students', async ({ page }) => {
    await signIn(page, reader.email, reader);
    await page.goto(`/t/${anonId}`);
    await expect(page.getByRole('heading', { name: 'This thread is not available' })).toBeVisible();
    await page.goto('/mod');
    await expect(page).toHaveURL(/\/$/);
  });

  test('an admin reveals the author with a reason, and the audit log records it', async ({ page }) => {
    await signIn(page, 'sample.admin@nobles.edu', {
      firstName: 'Sample',
      lastInitial: 'A',
      classYear: 'faculty',
    });
    await page.goto(`/t/${anonId}`);
    await page.locator('.th-card').first().getByRole('button', { name: 'Who wrote this?' }).click();
    const dialog = page.getByRole('dialog', { name: 'Who wrote this?' });

    // A reason is required.
    await dialog.getByRole('button', { name: 'Show the author and log it' }).click();
    await expect(dialog.getByRole('alert')).toContainText('at least 10');
    await expect(dialog).not.toContainText(author.email);

    const reason = `Safety follow-up ${stamp}`;
    await dialog.getByLabel('Why do you need to know? (required)').fill(reason);
    await dialog.getByRole('button', { name: 'Show the author and log it' }).click();
    await expect(dialog.getByText(author.email)).toBeVisible();
    await expect(dialog.getByText('Zephyrine Q.')).toBeVisible();
    await expect(dialog.getByText('This view was logged.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();

    // Restore the thread, then read the audit log.
    await page.locator('.th-card').first().getByRole('button', { name: 'Moderate' }).click();
    const mod = page.getByRole('dialog', { name: 'Moderate this thread' });
    await mod.getByLabel('Restore (make it visible)').check();
    await mod.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Only moderators can see this thread.')).toHaveCount(0);

    await page.goto('/admin/audit');
    const row = page.getByRole('row').filter({ hasText: reason });
    await expect(row).toBeVisible();
    await expect(row).toContainText('revealAuthor');
    await expect(row).toContainText('sample.admin@nobles.edu');
    await expect(page.getByRole('row').filter({ hasText: 'Holding while we check' }).first()).toContainText(
      'hold',
    );
  });

  test('a post about self-harm is not published and the author gets a caring message', async ({ page }) => {
    await signIn(page, reader.email, reader);
    await page.goto('/new');
    await page.getByLabel('Space', { exact: true }).selectOption({ label: 'Clubs' });
    await chooseIdentity(page, 'Post as', 'Anonymous');
    await page.getByLabel('Title', { exact: true }).fill(`Something I need to say ${stamp}`);
    await page.getByLabel('Your thoughts', { exact: true }).fill('Some days I want to hurt myself.');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for writing this' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('You are not in trouble.')).toBeVisible();
    await expect(page.getByText('988 Suicide and Crisis Lifeline.')).toBeVisible();
    await page.goto('/s/clubs?sort=new');
    await expect(page.getByRole('link', { name: `Something I need to say ${stamp}` })).toHaveCount(0);
  });

  test('signing out works, and member pages then ask you to sign in', async ({ page }) => {
    await signIn(page, reader.email, reader);
    await signOut(page);
    await page.goto(`/t/${namedId}`);
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe('pages that need no sign-in', () => {
  test('the hall screen shows the question, the poll, approved replies and a QR code', async ({ page }) => {
    await page.goto('/board');
    const board = page.locator('.bd-root');
    await expect(board).toHaveAttribute('data-theme', 'board');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Should the school day start at 8:30',
    );
    await expect(page.getByText('Live on Gleason Hall')).toBeVisible();
    await expect(page.getByRole('img', { name: /^Poll:/ })).toBeVisible();
    await expect(page.locator('.bd .reply')).toHaveCount(2);
    await expect(page.locator('.tick')).toContainText('From the Nobleman');
    // The QR code is real path data generated at build time. It is hidden on phones, where you are already on one.
    const qr = page.locator('svg[aria-label^="QR code that opens"]');
    await expect(qr).toHaveCount(1);
    expect((await qr.locator('path').getAttribute('d'))!.length).toBeGreaterThan(500);
    // Nothing on the hall screen asks for a login or loads the sign-in code.
    await expect(page.getByRole('button', { name: /Sign in/ })).toHaveCount(0);
  });

  test('about explains anonymity in three steps', async ({ page }) => {
    await page.goto('/about');
    for (const step of ['You choose', 'Students see your choice', 'Administration can always see']) {
      await expect(page.getByRole('heading', { name: step })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Honest limits' })).toBeVisible();
  });

  test('an account from another domain is signed out with a kind message', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Any email address').fill('someone@example.com');
    await page.getByRole('button', { name: 'Sign in as this address' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'not a Nobles account' })).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('a friendly page for addresses that do not exist', async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page.getByRole('heading', { name: 'That page is not here' })).toBeVisible();
  });

  test('Night follows the device setting and the choice is remembered', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/about');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dark).toBe('rgb(0, 19, 61)');
    // Choosing Paper by hand wins over the device setting, and survives a reload.
    await page.evaluate(() => window.localStorage.setItem('commons.theme', 'paper'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(247, 244, 236)',
    );
  });

  test('the page is served with a strict Content-Security-Policy and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    page.on('pageerror', (error) => errors.push(String(error)));
    const response = await page.goto('/about');
    const csp = response!.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(response!.headers()['x-content-type-options']).toBe('nosniff');
    expect(response!.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    await page.goto('/board');
    await expect(page.getByText('Live on Gleason Hall')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
