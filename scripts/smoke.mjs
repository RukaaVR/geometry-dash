// End-to-end browser smoke test (requires Playwright: `npm i -D playwright`).
// Starts the local server, boots the game, walks through the menus, plays a level,
// pauses, opens the editor, places objects, saves and tests the level.
// Usage: npm run smoke
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const PORT = 8765;
const server = spawn(process.execPath, ['scripts/serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const errors = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const o = { timeout: 8000 };
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('.title-screen', { timeout: 30000 });
  await page.click('.title-start', o);
  await page.click('.menu-row .btn >> nth=0', o);
  await page.click('.level-card.active .lc-play', o);
  await page.waitForSelector('.hud.visible', o);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.pause-menu', o);
  await page.click('.pause-row .btn-back', o);
  await page.waitForSelector('.level-select', o);
  await page.click('.tab >> nth=1', o);
  await page.click('.my-actions .btn-primary', o);
  await page.waitForSelector('.editor', o);
  for (let x = 520; x < 700; x += 70) await page.mouse.click(x, 560);
  await page.keyboard.press('Control+s');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.hud.visible', o);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.editor', o);
  console.log('Smoke test passed');
} catch (e) {
  errors.push(e.message);
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) {
  console.error('Smoke test failed:\n' + errors.join('\n'));
  process.exit(1);
}
