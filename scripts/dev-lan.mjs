// npm run dev:lan
// Runs the same dev setup as `npm run dev` (Firebase emulators + the web dev server), but
// reachable from other devices on your local network. Open the printed address on a phone or
// another laptop on the same wifi.
//
// The emulators have no real security, so only use this on a network you trust. Nothing here
// touches the real Firebase project, and nothing is deployed.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { repoRoot } from './env.mjs';

// Same config as firebase.json, with the emulators listening on every network interface.
const config = JSON.parse(readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
for (const emulator of Object.values(config.emulators)) {
  if (emulator && typeof emulator === 'object' && 'host' in emulator) emulator.host = '0.0.0.0';
}
writeFileSync(path.join(repoRoot, 'firebase.lan.json'), JSON.stringify(config, null, 2) + '\n');

const sync = spawnSync('node', ['scripts/sync-functions-env.mjs', '--emulator'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (sync.status !== 0) process.exit(sync.status ?? 1);

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === 'IPv4' && !net.internal)
  .map((net) => net.address);
console.log('\nOn the same wifi, open:');
for (const address of addresses) console.log(`  http://${address}:5173`);
console.log('(If it will not load, allow Node.js through the Windows firewall for private networks.)\n');

const child = spawn(
  'npx concurrently -k -n emu,web ' +
    '"firebase emulators:start --config firebase.lan.json --project demo-nobles-commons --only auth,firestore,functions" ' +
    '"npm run dev -w apps/web"',
  { cwd: repoRoot, stdio: 'inherit', shell: true, env: { ...process.env, LAN_DEV: '1' } },
);
child.on('exit', (code) => process.exit(code ?? 0));
