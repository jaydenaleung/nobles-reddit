import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// The repo root. The preview server must start from here whichever config file is used.
const repoRoot = path.dirname(fileURLToPath(import.meta.url));

// End-to-end tests. Run with `npm run test:e2e`, which builds the app in
// emulator mode, starts the Firebase emulators and seeds the sample data.
// The app is served by `vite preview` with the same security headers as
// Firebase Hosting, so these tests run under the real Content-Security-Policy.
export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  testIgnore: /screens\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -w apps/web',
    cwd: repoRoot,
    url: 'http://127.0.0.1:5000/values',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
  ],
});
