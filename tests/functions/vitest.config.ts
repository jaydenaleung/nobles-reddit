import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Function tests. Run with `npm run test:functions`, which builds the functions
// and starts the Auth, Firestore and Functions emulators (AI_PROVIDER=mock).
export default defineConfig({
  root,
  test: {
    include: ['tests/functions/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 90_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
