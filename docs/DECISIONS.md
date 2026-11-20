# Decisions made on your behalf

The brief said: when something is not specified, pick the default given or the most conservative option, write it down and keep going. This is that list. Anything here can be changed; each entry says where.

## Things you should know first

1. **Nothing was deployed and nothing was pushed.** All work is on the branch `feat/nobles-commons-build`. Three values are missing from `.env.local` (`GOOGLE_APPLICATION_CREDENTIALS`, `BOOTSTRAP_ADMIN_EMAILS`, `WELLBEING_CONTACT_EMAIL`), and the brief says to stop before deploying when credentials are missing. `npm run deploy` refuses and names them.
2. **The Claude key was pasted into a chat.** It is stored only in the git-ignored `.env.local`. Consider rotating it before launch.
3. **`BUILD_PROMPT.md` and `Proposal.pdf` were left out of git** on purpose. Add them if you want them in the repository.

## Tooling and versions

| Decision | Why | Where |
| --- | --- | --- |
| Every dependency is pinned to an exact version published on or before 2026-11-01 (two weeks before the build) | The brief | `package.json` files |
| Development needs **Node 22.12 or newer** | Vitest 5 requires it, and the functions now run on Node 22 too | `README.md`, CI |
| The functions run on **Node 22**, not the Node 20 the brief asked for | Google decommissioned the Node 20 runtime on 2026-10-30 and the first real deploy was refused. Everything was already tested locally on Node 22 | `firebase.json`, `functions/package.json` |
| `firebase-admin` 13 and the `firebase` web SDK 12, not the newest majors | They were chosen while the functions targeted Node 20. Now that they run on Node 22, upgrading to `firebase-admin` 14 is possible and would clear most of the remaining moderate audit advisories; not done yet | `functions/package.json` |
| `legacy-peer-deps=true` in `.npmrc` | npm 10 crashes resolving Vitest 5's optional peers in a workspace. Every peer we need is listed explicitly | `.npmrc` |
| TypeScript 5.9, not 7 | Tooling support | root `package.json` |
| zod 3, not 4 | Stable and supported by the Anthropic SDK | `packages/shared` |
| The functions are bundled with esbuild, with the shared package bundled in | The shared package is not on npm, so Cloud Build could not install it | `functions/build.mjs` |
| The Python server's packages are pinned the same way | The brief | `ml/serve/requirements.txt` |

## Sign-in and roles

| Decision | Why | Where |
| --- | --- | --- |
| The domain is enforced in the functions (from `ALLOWED_EMAIL_DOMAINS`) and again in the rules, where `nobles.edu` is written in one line | Rules cannot read environment variables. Two layers, one of them configurable | `firestore.rules`, `functions/src/guard.ts` |
| Off-domain accounts are not blocked from existing in Firebase Auth; they get no role and can read and do nothing | Blocking at sign-in needs Google Identity Platform (a paid upgrade). The website signs them straight out with a kind message | `apps/web/src/auth/AuthContext.tsx` |
| Functions read the role from the profile in Firestore; rules read it from the sign-in token | A role change takes effect at once in functions; the token catches up on the next page load | `functions/src/guard.ts` |
| An administrator cannot change their own role | Avoids locking everyone out | `functions/src/users.ts` |
| Everyone's name shows as "First L.", faculty included, with a Faculty badge | The brief specifies first name and last initial. "Ms. Haddad"-style names would need a second field. **The school may prefer honorifics for faculty** | `packages/shared/src/authorDisplay.ts` |
| Ticking "faculty or staff" at onboarding does not give the Faculty badge; an administrator does | Students must not be able to make themselves faculty | `functions/src/users.ts` |

## Posting and anonymity

| Decision | Why | Where |
| --- | --- | --- |
| **New posts and comments are held until the automatic check has read them** (a few seconds) | The most conservative reading of "self-harm signals publish nothing new". The cost is a short wait after posting | `functions/src/content.ts`, `triggers.ts` |
| **If the check is unavailable, posts are published** after a small phrase check for self-harm and violence | The brief: when the budget is exceeded "nothing else breaks", and the classifier is "never the only line". **The school may prefer to hold everything for a moderator instead** | `functions/src/triggers.ts` |
| The author of a thread is "Anonymous A" in it; each other anonymous author gets the next letter, kept for that thread only | Lets a conversation be followed without linking threads together | `functions/src/content.ts` |
| A person's anonymous comments within one thread are therefore linked to each other | Follows from the brief's "stable per thread". Said plainly in `docs/SAFETY.md` | |
| Top-level comments are depth 0 and replies go to depth 4 | "Max depth 4" was ambiguous; this allows four levels of reply | `packages/shared/src/constants.ts` |
| Editing re-runs the automatic check, and the post is hidden for those seconds | Otherwise an edit would be a way round the check | `functions/src/content.ts` |
| Poll options and links cannot be edited after posting | Changing a poll after people voted would be unfair | |
| You can upvote your own post | Not specified; simplest | |
| "Save" keeps a thread on this device only. "Share" copies the link | They are in the reference design but not in the data model; nothing new is collected | `apps/web/src/lib/storage.ts` |
| Deleting an account keeps a small record (name, school email) next to the authorship record | Without it, "the administration can always see who wrote it" would stop being true for remaining posts. The page says so first | `functions/src/users.ts` |
| Moderators can read reports, which include the reporter's internal id but not their name | The brief's data model. Moderators cannot read profiles, so the id tells them nothing. **Worth a second look** | `firestore.rules` |

## Additions to the brief's data model and functions

- Fields: `spaceName`, `anonCommentCount`, `screening`, `searchTokens`, `sample` on posts; `postCount` on spaces; `uid`/`postId`/`kind` on vote documents (so "which of these have I marked?" is one query).
- Functions the brief did not list but its pages need: `getMyContentStatus`, `listMyContent`, `exportMyData`, `deleteMyAccount`, `updateConfig`, `getAiUsage`, `proposeDailyQuestionNow`, `proposeHumanQuestion`, and `exportTrainingData` (a stub that refuses).
- A moderation action `removeFromBoard`, the opposite of `approveForBoard`.
- Collections `mail` (outgoing wellbeing email) and `archive` (old removed content), both closed to every client.
- Rate limits also cover summaries (10 an hour) and read-style calls.

## Feed, search and counts

| Decision | Why |
| --- | --- |
| Counts are changed in the same transaction as the vote **and** recounted by a trigger | Instant on screen, and self-repairing |
| "Top this week" loads up to 200 of the week's threads and ranks them in the browser | Firestore cannot filter on date and order by score in one indexed query. Fine at school scale |
| Search is the `searchTokens` approach from the brief: whole words only, no typo tolerance, up to 10 words | It is a v1. If usage grows, replace it with Algolia or Typesense, indexing the same three fields and never the author |
| Titles of removed or held threads are not searchable | The search query asks for visible threads only |

## AI

| Decision | Why |
| --- | --- |
| A summary is made when someone asks ("Summarize"), not automatically | Saves budget; the box still appears for everyone once it exists |
| Comments are shortened to 1,200 characters for the summary, with a marker | Keeps one long thread from using the day's budget |
| Structured output (a JSON schema) plus our own validation | The model's reply is never trusted |
| Server-side refusal fallbacks are not enabled | Model ids are configurable, and a declined suggestion is harmless: a moderator writes the question |
| Question ids are `{date}-{n}` because there are three candidates a day | The brief's single-id-per-day did not fit three |
| Moderators, not only administrators, approve the question | The brief says "a moderator approves one" |
| The Nobleman adapter is a stub that returns sample headlines; no domain is treated as "the Nobleman" yet | The brief: do not scrape, real feed later |
| The wellbeing email is written to a `mail` collection for the Firebase "Trigger Email" extension | No mail provider was specified. **Until the extension is installed, no email is sent** |

## Design

| Decision | Why |
| --- | --- |
| Thread titles and footer links are Nobles Blue, not navy | That is what the reference CSS produces for links without a class, and the reference page was the approved look |
| Inter 700 is loaded as well as 400/500/600 | The design system sets several labels in 700; without the file browsers fake the bold |
| The hall screen is the 1280x720 reference scaled to fill the TV, so text is at least 33px at 1080p; on a phone it reads as a normal page | Keeps the reference proportions exactly |
| The hall screen shows two approved replies and up to four poll options | That is what fits the reference layout |
| No logo anywhere; the favicon is a plain italic "C" | `assets/brand/` was empty, and the brief says not to draw one |
| The whole question-of-the-day title is highlighted | The reference highlights part of a title; which part cannot be chosen automatically |
| The styleguide page exists only in development builds | The brief |

## Testing

| Decision | Why |
| --- | --- |
| The browser tests run against `vite preview` with the headers from `firebase.json` | So they run under the real Content-Security-Policy |
| The "Local development" sign-in box exists only in emulator builds and is compiled out of production (checked: its text and code are not in the production bundle) | It is how the tests sign in through the Auth emulator's Google provider |
| Scheduled jobs (`refreshHotScores`, `archiveOldContent`, the 06:00 question schedule) are **not exercised by the tests** | The emulator does not run schedules. The question logic is tested through its manual trigger; the other two are not tested and should be watched after launch |
| The real Google sign-in popup has **not been tested** | It needs the live project. It is the first thing to check after deploying |

## Five things the school must decide or review before launch

1. **Privacy and families.** Review `docs/PRIVACY.md` with whoever is responsible for student data. Decide what families are told or asked, especially for the middle school, and whether student text may be sent to an outside model.
2. **The wellbeing process.** Who gets the alert, how fast someone responds out of hours, the wording students see, and how email is delivered. Decide whether posts should wait for a moderator when the automatic check is down.
3. **Who can look up authors, and when.** Name the administrators and moderators. Agree a reveal policy and who reviews the audit log.
4. **Retention and deletion.** Whether 24 months is right, what happens to the archive, and whether keeping the authorship record after an account is deleted matches school policy.
5. **Name, look and rules.** The name "Nobles Commons", use of the school's colours and (if wanted) logo, how faculty names should appear, and how the four ground rules connect to the handbook.
