// Renders every wireframe at desktop 16:9 and iPad 4:3 and runs the layout checks.
// Usage: node docs/ui/wireframes/shoot.mjs   → PNGs in screenshots/, results in screenshots/checks.json
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // globally installed; require() resolves it, ESM import does not
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const SIZES = [{ name: 'desktop-1920x1080', width: 1920, height: 1080 }, { name: 'ipad-1024x768', width: 1024, height: 768 }];
const files = readdirSync(DIR).filter((f) => f.endsWith('.html')).sort();

const browser = await chromium.launch();
const results = [];
for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const f of files) {
    await page.goto(pathToFileURL(join(DIR, f)).href);
    await page.waitForLoadState('load');
    const r = await page.evaluate(() => {
      const de = document.documentElement, W = innerWidth, H = innerHeight;
      const noScroll = de.scrollHeight <= H && de.scrollWidth <= W && document.body.scrollHeight <= H && document.body.scrollWidth <= W;
      // any UI element (outside the SVG) that pokes out of the viewport?
      const outside = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg')) continue;
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) outside.push(`${el.tagName.toLowerCase()}.${el.className}`.slice(0, 50));
      }
      // content clipped inside panels (overflow beyond its own box) – count text containers that overflow
      const clipped = [...document.querySelectorAll('.panel,.dock,.mat,.rrail,.lrail,.drawer,.caption')].filter((el) => el.scrollHeight > el.clientHeight + 2).map((el) => el.className);
      // touch targets
      const small = [...document.querySelectorAll('.btn,.slot,.crew,.chip,.av,.status,.handle')].filter((el) => {
        const b = el.getBoundingClientRect(); return b.width && (b.width < 44 || b.height < 44);
      }).map((el) => el.className);
      // visible part of each hand card (the tappable slice not covered by the next card)
      const hcards = [...document.querySelectorAll('.hand.fan .card')];
      let minSlice = Infinity;
      hcards.forEach((c, i) => {
        const b = c.getBoundingClientRect(); const n = hcards[i + 1];
        const vis = n ? Math.min(b.width, n.getBoundingClientRect().left - b.left) : b.width;
        minSlice = Math.min(minSlice, vis);
      });
      const anyCard = document.querySelector('.hand .card'); const cardH = anyCard ? Math.round(anyCard.getBoundingClientRect().height) : 0; if (!hcards.length && anyCard) minSlice = Math.round(anyCard.getBoundingClientRect().width);
      // smallest font size used by visible UI text
      let minFont = Infinity;
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg') || el.closest('.note') || el.closest('.wm')) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const b = el.getBoundingClientRect(); if (!b.width) continue;
        minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize));
      }
      // % of the screen where the tabletop is visible (not covered by UI)
      let hit = 0, tot = 0;
      for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) {
        tot++; const e = document.elementFromPoint(x, y);
        if (e && e.closest('svg.tabletop')) hit++;
      }
      return { noScroll, scroll: [de.scrollWidth, de.scrollHeight], outside: outside.slice(0, 8), outsideCount: outside.length, clipped, smallTargets: small.length, smallList: small.slice(0, 6), minCardSlice: Math.round(minSlice), cardH, minFont, boardPct: Math.round((100 * hit) / tot) };
    });
    const png = `${f.replace('.html', '')}--${size.name}.png`;
    await page.screenshot({ path: join(DIR, 'screenshots', png) });
    results.push({ file: f, size: size.name, png, ...r });
    console.log(f.padEnd(40), size.name.padEnd(18), JSON.stringify(r));
  }
  await ctx.close();
}
await browser.close();
writeFileSync(join(DIR, 'screenshots', 'checks.json'), JSON.stringify(results, null, 2));
