// Bundles the Cloud Functions into lib/index.js.
// The shared workspace package is bundled in (it is not on npm), every real
// dependency stays external so Cloud Build installs it from package.json.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8'));
const external = Object.keys(pkg.dependencies).flatMap((name) => [name, `${name}/*`]);

await build({
  entryPoints: [path.join(here, 'src/index.ts')],
  outfile: path.join(here, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external,
  alias: { '@commons/shared': path.join(here, '../packages/shared/src/index.ts') },
  loader: { '.md': 'text' },
  logLevel: 'info',
});
