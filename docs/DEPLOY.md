# Deploying Nobles Commons

Nothing has been deployed yet. This is the checklist for the first time, and the routine for every time after.

## Before the first deploy

### 1. The Firebase project

In the Firebase console for the project named in `FIREBASE_PROJECT_ID`:

- **Upgrade to the Blaze (pay as you go) plan.** Cloud Functions and Secret Manager need it. See "Cost" below; at school scale it should be a few dollars a month. Set a budget alert.
- **Authentication:** turn on the Google provider. Under Settings, Authorised domains, add the address people will use.
- **Firestore:** create the database in Native mode. Pick a US region close to Massachusetts (for example `us-east1`). The region cannot be changed later.
- **Do not turn on Cloud Storage.** The app does not use it. `storage.rules` denies everything in case it is ever enabled.

### 2. A service-account key

Project settings, Service accounts, Generate new private key. Save the file **outside the repository or under a git-ignored name** (the `.gitignore` already covers `service-account*.json` and `*-firebase-adminsdk-*.json`). Put its path in `.env.local` as `GOOGLE_APPLICATION_CREDENTIALS`. Never paste the JSON anywhere.

### 3. Fill in `.env.local`

Copy `.env.example` and fill it in. The three values that are still missing today:

| Variable | What to put |
| --- | --- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the key file from step 2 |
| `BOOTSTRAP_ADMIN_EMAILS` | The school emails of the first administrators, comma-separated. They become admin the first time they sign in |
| `WELLBEING_CONTACT_EMAIL` | Who is alerted when a post raises a safety flag. Ask the counseling office |

### 4. Email for wellbeing flags

When a post raises a wellbeing flag, the functions write a message to the `mail` collection in the shape the official Firebase **Trigger Email** extension expects. Until that extension is installed, **no email is sent** (the flag still goes to the top of the moderation queue).

Install "Trigger Email from Firestore" from the Firebase Extensions catalogue, point it at the `mail` collection and give it the school's SMTP details. The message contains no student text and no author; it says that something needs a caring look and links to the moderation page.

### 5. The allowed domain

`ALLOWED_EMAIL_DOMAINS` (default `nobles.edu`) is enforced by the functions. The Firestore rules also check it, in one line of `firestore.rules` (`allowedDomain()`). If the domain ever changes, change both.

## Deploy

```bash
npm run deploy
```

In order, it: scans for secrets, builds the site and the functions, scans the built site, writes the functions' non-secret settings to `functions/.env.<project>`, pipes the Claude key into Secret Manager (it is never echoed or logged), deploys the rules, indexes, functions and hosting, and runs the smoke test against the live address.

It stops at the first failure and says which step failed.

To run the smoke test by itself:

```bash
npm run smoke
```

### The functions runtime

The functions run on **Node 22** (`"runtime": "nodejs22"` in `firebase.json`). The brief asked for Node 20, but Google decommissioned that runtime on 2026-10-30 and refuses to deploy it. Everything had already been developed and tested locally on Node 22, so nothing else changed.

### Indexes

The first deploy creates the Firestore indexes in `firestore.indexes.json`. They take a few minutes to build. Until they finish, the feed can show "did not load". The emulators do not enforce indexes, so if a query fails only on the live site with a message containing a console link, follow the link, create the index, and add it to `firestore.indexes.json`.

## After the first deploy

1. Sign in as a bootstrap admin and check `/admin`.
2. Seed the spaces and the "Read this first" thread: `npm run seed -- --allow-prod` (it asks you to type the project id). Everything it writes is marked as sample; edit or remove the sample threads before students arrive.
3. Give faculty and moderators their roles under Administration, Roles.
4. Put `/board` on the hall screen in full-screen mode. It needs no login.
5. Review the wording under Administration, Settings, "What a student sees after a wellbeing flag".

## Optional: App Check

App Check makes it harder to call the functions from anything other than the real site. To turn it on: create a reCAPTCHA Enterprise key for the site's domain, register the web app in Firebase App Check, put the key in `RECAPTCHA_ENTERPRISE_SITE_KEY`, deploy, watch the App Check metrics for a few days, then set `ENFORCE_APP_CHECK=true` and deploy again.

## A custom address

Hosting, Add custom domain (for example `commons.nobles.edu`), then set `PUBLIC_URL` to it and deploy again so the QR code points at the new address. Add the domain to Authentication's authorised domains too.

## Rolling back

- **The site:** Hosting, Release history, pick the previous release, Roll back. Instant.
- **Functions and rules:** check out the last good commit and run `npm run deploy`.
- **In an emergency:** in the Firebase console, Authentication, Sign-in method, disable Google. Nobody can sign in and the site shows its sign-in page. The hall screen keeps showing the last question.

## A second project for staging

Not required. If the school wants one: create a second Firebase project, copy `.env.local` to another file with that project's values, and point the scripts at it. The emulators cover everything the tests need.

## Cost

Rough expectations for a school of about 600 people. Check the Firebase and Anthropic pricing pages before budgeting; these change.

| Part | Expectation |
| --- | --- |
| Hosting, Auth | Free tier |
| Firestore | Within or near the free tier (tens of thousands of reads a day) |
| Cloud Functions | A few dollars a month. Each post or comment runs two or three small functions |
| Claude | Capped by `AI_DAILY_TOKEN_BUDGET` (default 400,000 tokens a day). Screening a post costs a few hundred tokens on the fast model. At the default cap the worst case is well under a dollar a day |

When the daily AI budget is spent, summaries and question suggestions say "unavailable today" and posting carries on with a simpler safety check. Nothing else stops.

## Secrets

- `.env.local` and the service-account file are git-ignored. `npm run check:secrets` (also in CI) fails if a key-shaped string is in any tracked file or in the built site.
- The Claude key lives in Secret Manager and is given only to the functions that use AI.
- If a key is ever pasted somewhere it should not be (a chat, an email, a commit), rotate it: create a new one, run `npm run deploy:secrets`, delete the old one.
