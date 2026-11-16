# Test results

Run on 2026-11-16 on Windows, Node 22.18, against the Firebase emulators.

| Check | Result |
| --- | --- |
| ESLint and Prettier | Pass |
| TypeScript (strict), all packages | Pass |
| Unit tests | 90 passed |
| Firestore rules tests | 39 passed |
| Function tests (emulators) | 87 passed |
| Playwright and axe, desktop and phone | 45 passed, 1 skipped on purpose (keyboard check runs at desktop size only) |
| Lighthouse accessibility | 100 on the front page, a thread and the hall screen, phone and desktop (see `lighthouse.md`) |
| Secret scan (tracked files and built site) | Pass |
| `npm audit --omit=dev --audit-level=high` | Pass. 10 moderate advisories remain (see `docs/DECISIONS.md`) |
| Live Claude check (`npm run test:live`, made-up text) | 4 passed on the final prompt (`claude-haiku-5-5` and `claude-sonnet-5-5`). The prompt-injection case was repeated: 6 of 6 runs resisted it |
| Production build (real settings) | The emulator-only sign-in panel, the fake-token sign-in code and every emulator address are absent from the bundle; secret scan passes |
| Smoke test against the local preview and emulators | Pass |
| `ml/` skeleton tests (Python) | 8 passed |

Not run: anything against the live Firebase project (nothing is deployed), the real Google sign-in popup, and the scheduled jobs (`refreshHotScores`, `archiveOldContent`, the 06:00 question schedule), which the emulator does not trigger.

The screenshots in `docs/screens` were regenerated with `npm run screens` after the last fixes.
