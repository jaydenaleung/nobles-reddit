# Lighthouse results

Run on 2026-11-16 against the emulator build served by `vite preview` (Lighthouse 12, headless Chromium).
Member pages were measured signed in. Performance on a laptop against local emulators is a rough guide only;
measure again on the live site.

| Page | Mode | Performance | Accessibility | Best practices |
| --- | --- | --- | --- | --- |
| Front page | phone | 96 | 100 | 93 |
| Front page | desktop | 100 | 100 | 100 |
| Thread | phone | 98 | 100 | 93 |
| Thread | desktop | 100 | 100 | 100 |
| Hall screen | phone | 100 | 100 | 100 |
| Hall screen | desktop | 100 | 100 | 100 |

The run fails if accessibility is below 95 on any page.
