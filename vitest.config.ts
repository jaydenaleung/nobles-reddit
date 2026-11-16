import { defineConfig } from 'vitest/config';

// Unit tests: pure logic only, no emulators.
// Rules tests and function tests have their own configs under tests/.
export default defineConfig({
  plugins: [
    {
      // Prompt templates are plain .md files, imported as text.
      name: 'md-as-text',
      transform(code, id) {
        if (id.endsWith('.md')) return { code: `export default ${JSON.stringify(code)};`, map: null };
        return null;
      },
    },
  ],
  test: {
    include: ['packages/shared/src/**/*.test.ts', 'functions/src/**/*.test.ts', 'apps/web/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
