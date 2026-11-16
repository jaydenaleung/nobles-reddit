# Nobles Commons

A discussion board for the Noble and Greenough School community. Students and faculty sign in with their school Google account and talk about school news, current events and anything else, in spaces for different parts of school life. A hall screen shows the question of the day.

Two ideas shape everything:

- **Kind and honest, both.** Disagree freely, about ideas and not people.
- **Anonymous by choice, and honest about what that means.** Anonymous hides your name from other students. The administration can always see who wrote every post and comment, and each time they look it is logged.

> **Not launched.** This is a complete build that runs on the Firebase emulators. It has not been deployed. `docs/PRIVACY.md` and `docs/SAFETY.md` are drafts for the school to review before any student uses it. See "What is still needed" below.

## What is in here

| Folder | What it is |
| --- | --- |
| `apps/web` | The website: Vite, React 18, TypeScript, plain CSS |
| `functions` | Cloud Functions (2nd gen). Every write goes through one of these |
| `packages/shared` | Types, input checks, limits and the hot-score formula, shared by both |
| `firestore.rules` | Who can read what. No client can write anything |
| `tests`, `e2e` | Rules tests, function tests and browser tests |
| `ml` | A skeleton for the hand-built summariser (a learning project, left unwritten on purpose) |
| `docs` | Architecture, deployment, a guide for the school, safety, privacy, AI, decisions, launch |
| `scripts` | Seeding, secret scan, deploy, smoke test, Lighthouse |

## Run it locally in 5 commands

You need Node 22.12 or newer and Java 21 or newer (for the Firebase emulators).

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm run dev
```

In a second terminal, once the emulators say they are ready:

```bash
npm run seed
```

Then open http://127.0.0.1:5173 and use the "Local development" box on the sign-in page (sample student, teacher, moderator or admin). That box only exists in emulator builds.

To run the tests, stop the dev servers first (Ctrl+C in the first terminal: the tests start their own emulators on the same ports), then:

```bash
npm test
```

Nothing here touches a real Firebase project: the emulators use the made-up project id `demo-nobles-commons` and the fake values in `.env.emulator`.

## Tests

| Command | What it runs |
| --- | --- |
| `npm run lint` | ESLint and Prettier |
| `npm run typecheck` | TypeScript, strict, in every package |
| `npm run test:unit` | Hot score, input checks, safe text formatter, rate limiter, AI prompt building and output checks |
| `npm run test:rules` | Firestore rules against the emulator |
| `npm run test:functions` | Every callable against the emulators, including the anti-deanonymisation tests |
| `npm run test:e2e` | Playwright journey and axe accessibility checks, at desktop and phone sizes |
| `npm run lighthouse` | Lighthouse on the front page, a thread and the hall screen |
| `npm run screens` | Screenshots of every route into `docs/screens` |
| `npm run check:secrets` | Fails if a key-shaped string is in a tracked file or in the built site |

The latest results are in `docs/reports/`.

## Deploy

```bash
npm run deploy
```

It refuses to start, and names what is missing, until `.env.local` is complete. Full steps are in `docs/DEPLOY.md`.

### What is still needed

1. `GOOGLE_APPLICATION_CREDENTIALS`: the path to a service-account key file for the Firebase project.
2. `BOOTSTRAP_ADMIN_EMAILS`: who becomes an administrator on first sign-in.
3. `WELLBEING_CONTACT_EMAIL`: who is alerted about safety flags, plus a way to deliver that email (see `docs/DEPLOY.md`).
4. The school's review of `docs/PRIVACY.md`, `docs/SAFETY.md` and the five decisions listed at the end of `docs/DECISIONS.md`.

## Read next

- `docs/ARCHITECTURE.md` for how it fits together, with a diagram of the anonymity flow
- `docs/ADMIN.md` if you are a moderator or administrator
- `docs/AI.md` for what the models do and how to swap in your own
- `docs/DECISIONS.md` for every choice made where the brief was silent

## Licence

MIT for the code (see `LICENSE`). The school's name, colours and logo belong to the school.
