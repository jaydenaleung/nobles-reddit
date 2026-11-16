import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// `npm run screens`: screenshots of every route into docs/screens, for the visual check.
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /screens\.spec\.ts/,
  testIgnore: [],
  reporter: [['list']],
  projects: [{ name: 'screens', use: { viewport: { width: 1280, height: 900 } } }],
});
