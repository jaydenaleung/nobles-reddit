// Quick screenshot helper for visual checks during development.
//   node scripts/shot.mjs <url> <out.png> [width] [height] [--full] [--theme=night] [--sel=<css>] [--y=<offset>] [--h=<height>]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const [url, out, width = '1280', height = '900'] = args.filter((a) => !a.startsWith('--'));
const theme = flags.find((f) => f.startsWith('--theme='))?.split('=')[1];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(width), height: Number(height) },
  colorScheme: theme === 'night' ? 'dark' : 'light',
});
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
page.on('pageerror', (err) => errors.push(String(err)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const sel = flags.find((f) => f.startsWith('--sel='))?.slice(6);
const yOff = Number(flags.find((f) => f.startsWith('--y='))?.slice(4) ?? 0);
const clipH = Number(flags.find((f) => f.startsWith('--h='))?.slice(4) ?? 0);
if (sel) {
  const box = await page.locator(sel).first().boundingBox();
  await page.screenshot({
    path: out,
    fullPage: true,
    clip: { x: box.x, y: box.y + yOff, width: box.width, height: clipH || box.height - yOff },
  });
} else {
  await page.screenshot({ path: out, fullPage: flags.includes('--full') });
}
if (errors.length) console.log('Console errors:\n' + errors.join('\n'));
console.log(`Saved ${out}`);
await browser.close();
