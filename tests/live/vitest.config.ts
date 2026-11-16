import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// An opt-in check of the real Claude integration: `npm run test:live`.
// It needs ANTHROPIC_API_KEY in .env.local, costs a few cents, and sends only
// made-up text. It is not part of CI.
export default defineConfig({
  root,
  plugins: [
    {
      name: 'md-as-text',
      transform(code, id) {
        if (id.endsWith('.md')) return { code: `export default ${JSON.stringify(code)};`, map: null };
        return null;
      },
    },
  ],
  test: {
    include: ['tests/live/**/*.live.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    fileParallelism: false,
  },
});
