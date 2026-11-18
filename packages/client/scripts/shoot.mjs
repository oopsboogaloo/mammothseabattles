// Screenshots of the layout A mock-up at desktop 16:9 and iPad 4:3, plus the layout checks used for the wireframes
// (docs/ui/wireframe-evaluation.md): no scroll, nothing outside the viewport, touch targets ≥ 44 px, smallest font.
// Usage: npm run build -w @msb/client && node packages/client/scripts/shoot.mjs [chromium|webkit]
// Output: docs/ui/mockup/screenshots/*.jpg and checks.json (webkit: screenshots/webkit/, not committed)
import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '..', '..', 'docs', 'ui', 'mockup', 'screenshots', ...(process.argv[2] === 'webkit' ? ['webkit'] : []));
mkdirSync(OUT, { recursive: true });
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const SIZES = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'ipad-1024x768', width: 1024, height: 768 },
];

const server = await preview({ root: ROOT, preview: { port: 4179, strictPort: true }, logLevel: 'silent' });
const url = 'http://localhost:4179/';
const browser = await engine.launch(engine === chromium ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
const results = [];

const checks = (page) =>
  page.evaluate(() => {
    const de = document.documentElement, W = innerWidth, H = innerHeight;
    const noScroll = de.scrollHeight <= H && de.scrollWidth <= W;
    const outside = [], small = [];
    let minFont = 99, minFontEl = '';
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (el.closest('#labels') || el.closest('#hand') || el.closest('canvas')) continue;
      if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) outside.push(`${el.tagName.toLowerCase()}#${el.id}.${el.className}`.slice(0, 60));
      if (el.matches('.btn, .token, .rival, #switcher button, #dock .slot') && (b.width < 43.5 || b.height < 43.5)) small.push(`${el.className} ${Math.round(b.width)}×${Math.round(b.height)}`);
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < minFont) {
        minFont = parseFloat(cs.fontSize);
        minFontEl = `${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 20)}"`;
      }
    }
    const card = document.querySelector('#hand .card:not(.gap)')?.getBoundingClientRect();
    return { noScroll, outside: outside.slice(0, 8), smallTargets: small.slice(0, 8), minFont, minFontEl, handCard: card ? `${Math.round(card.width)}×${Math.round(card.height)}` : null };
  });

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('.ship-label').length >= 4, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const shot = async (state) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT, `${state}--${size.name}.jpg`), type: 'jpeg', quality: 78 });
    results.push({ state, size: size.name, ...(await checks(page)), errors: [...errors] });
  };
  await shot('1-start');
  // Program a few cards: tap a card, then a slot.
  const place = async (slot) => {
    await page.locator('#hand .card:not(.gap)').first().click();
    await page.locator(`#shipboard .slot[data-slot="${slot}"]`).click();
  };
  await place('sail1');
  await place('steer1');
  await place('action1');
  await page.locator('#hand .card:not(.gap)').first().click();
  await shot('2-programming-card-selected');
  await page.keyboard.press('Escape');
  await page.click('#spread');
  await shot('3-spread-hand');
  await page.click('#spread');
  await page.click('#weather');
  await shot('4-weather-board');
  await page.keyboard.press('Escape');
  await page.click('#menu-btn');
  await shot('5-menu');
  await page.keyboard.press('Escape');
  await page.locator('.rival').first().click();
  await shot('6-inspect-rival');
  await page.click('#ready');
  await page.waitForSelector('#playback:not([hidden])', { timeout: 10000 });
  await page.waitForTimeout(2600);
  await page.locator('#playback [data-c="play"]').click();
  await shot('7-resolution');
  // Play the rest of the turn; answer any damage decisions by tapping the first offered slot or crew card.
  await page.locator('#playback [data-c="skip"]').click();
  for (let k = 0; k < 120 && (await page.locator('#modal:not([hidden])').count()) === 0; k++) {
    const slot = page.locator('#playback .mini .slot.target').first();
    const crew = page.locator('#crew .token.pick').first();
    if (await slot.count()) {
      if (k < 60) await shot('7b-damage-decision');
      await slot.click();
    } else if (await crew.count()) await crew.click();
    await page.waitForTimeout(500);
  }
  await shot('9-upkeep');
  await page.locator('#modal .btn.primary').click();
  await shot('10-turn-2');
  await ctx.close();
}
// Fleets variant (desktop only)
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(url + '?fleets');
  await page.waitForFunction(() => document.querySelectorAll('.ship-label').length >= 5, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, '8-fleets--desktop-1920x1080.jpg'), type: 'jpeg', quality: 78 });
  results.push({ state: '8-fleets', size: 'desktop-1920x1080', ...(await checks(page)) });
  await ctx.close();
}
await browser.close();
server.httpServer.close();
writeFileSync(join(OUT, 'checks.json'), JSON.stringify(results, null, 2) + '\n');
for (const r of results) console.log(r.state.padEnd(30), r.size.padEnd(18), 'noScroll', r.noScroll, 'outside', r.outside.length, 'small', r.smallTargets.length, 'minFont', r.minFont, r.minFont < 11 ? r.minFontEl : '', 'card', r.handCard, r.errors?.length ? 'ERRORS ' + r.errors.join(' | ') : '');
process.exit(0);
