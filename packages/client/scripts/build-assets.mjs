// Converts the designer's master art (PNG/JPG, often 5–40 MB each) into small web images for the client.
// Usage:  node packages/client/scripts/build-assets.mjs [artDir]
//   artDir defaults to $MSB_ART_DIR, then to ~/OneDrive/Documents/creative/Boardgames/Mammoth Sea Battles.
// Output: packages/client/public/art/**  (committed, so the mock-up builds without the master art).
// The master art is only ever read, never written.
import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

sharp.cache(false);
const ART =
  process.argv[2] ??
  process.env.MSB_ART_DIR ??
  join(homedir(), 'OneDrive', 'Documents', 'creative', 'Boardgames', 'Mammoth Sea Battles');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');
if (!existsSync(ART)) throw new Error(`Art folder not found: ${ART} (pass it as an argument or set MSB_ART_DIR)`);

const jobs = [];
/** Resize to fit width w (and height h if given) and write WebP. */
const img = (src, out, w, h = null, q = 82) =>
  jobs.push(async () => {
    mkdirSync(dirname(join(OUT, out)), { recursive: true });
    await sharp(join(ART, src), { limitInputPixels: false })
      .resize({ width: w, height: h ?? undefined, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: q })
      .toFile(join(OUT, out));
  });

// ---- Command cards: file → card id (the initiative number; the second "360" card is 360b, see content.ts) ----
const MOVE = {
  '211751187': 400, '212757101': 420, '212825847': 440, '212955082': 700, '213130586': 720, '213223682': 740,
  '213450375': 100, '213522613': 120, '213556254': 140, '213822238': 460, '213845739': 480, '213909242': 500,
  '214003416': 760, '214024353': 780, '214050067': 800, '214141726': 160, '214215182': 180, '214244385': 200,
  '214347389': 520, '214421359': 540, '214445339': 560, '214533137': 820, '214552785': 840, '214624553': 860,
  '214838531': 220, '214914328': 240, '214959732': 260, '215130868': 580, '215217198': 600, '215302932': 620,
  '215331561': 880, '215357293': 900, '215417471': 920, '215454091': 280, '215528260': 300, '215556060': 320,
  '215657420': 640, '215721423': 660, '215742629': 680, '215814474': 940, '215840': 960, '215912': 980,
  '215955336': 340, '220041132': 360, '220110879': '360b',
};
import { readdirSync } from 'node:fs';
const moveFiles = readdirSync(join(ART, 'Cards/Movecards')).filter((f) => f.endsWith('.png'));
for (const [stamp, id] of Object.entries(MOVE)) {
  const f = moveFiles.find((n) => n.startsWith(`20250128_${stamp}`));
  if (!f) throw new Error(`Command card ${id} (${stamp}) not found`);
  img(`Cards/Movecards/${f}`, `cards/${id}.webp`, 400);
}
img('Cards/Movecards/20250130_184301702_iOS.png', 'cards/back.webp', 400);

// ---- Weather cards (hex) ----
const WEATHER = {
  '180557689': 'back',
  '191119420': 'light-ne', '191422177': 'light-s', '191556713': 'light-se', '191720052': 'light-nw', '191821174': 'light-sw', '192005226': 'light-n',
  '192931627': 'firm-n', '195203271': 'firm-s', '195604934': 'firm-se', '195956912': 'firm-sw', '200140470': 'firm-nw', '200633915': 'firm-ne',
  '201032427': 'strong-ne', '201120967': 'strong-nw', '201237165': 'strong-n', '201336122': 'strong-s', '201548698': 'strong-se', '201623794': 'strong-sw',
  '215604655': 'gale-sw', '215649147': 'gale-nw', '230310142': 'gale-ne', '230400340': 'gale-se', '230450078': 'gale-n', '230528091': 'gale-s',
  '230800215': 'dead-calm', '232038003': 'new-front', '232558815': 'lightning-storm', '233319834': 'hurricane',
};
// The weather cards are flat-topped hexes that fill the image; mask off the corners so they sit on the weather board.
const hexMask = (w, h) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon fill="#fff" points="${w * 0.25},1 ${w * 0.75},1 ${w - 1},${h / 2} ${w * 0.75},${h - 1} ${w * 0.25},${h - 1} 1,${h / 2}"/></svg>`);
for (const [stamp, id] of Object.entries(WEATHER))
  jobs.push(async () => {
    mkdirSync(join(OUT, 'weather'), { recursive: true });
    const { data, info } = await sharp(join(ART, `Cards/Weather cards/20250129_${stamp}_iOS.png`)).resize({ width: 420 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    await sharp(data, { raw: info })
      .composite([{ input: hexMask(info.width, info.height), blend: 'dest-in' }])
      .webp({ quality: 85, alphaQuality: 90 })
      .toFile(join(OUT, 'weather', `${id}.webp`));
  });

// ---- Crew: the finished round crew cards, and portraits used as placeholder crew ----
img('Cards/CrewCards/20250130_133033319_iOS.png', 'crew/captain-mammoth.webp', 360);
img('Cards/CrewCards/20250130_133412070_iOS.png', 'crew/pirate.webp', 360);
img('Cards/CrewCards/20250130_133905843_iOS.png', 'crew/pirate-2.webp', 360);
img('Cards/CrewCards/20250130_134048355_iOS.png', 'crew/wounded.webp', 360);
const PORTRAITS = {
  gunner: '194631818', lookout: '194651386', cook: '195047746', carpenter: '195633022', helmsman: '200658985',
  navigator: '201108881', marksman: '202058220', bosun: '200337579', quartermaster: '200628203', cartographer: '201224196',
};
for (const [id, stamp] of Object.entries(PORTRAITS)) img(`Crew/20250121_${stamp}_iOS.png`, `portraits/${id}.webp`, 360);

// ---- Equipment cards ----
const EQUIP = {
  'first-aid-kit': '191059189', 'ocean-charts': '191425417', 'wind-chimes': '191846819', weathervane: '192217287',
  fireworks: '193134744', 'big-cannonballs': '193457992', 'cannon-sights': '193520139', 'grape-shot': '194250028',
  'armour-plating': '195051040', 'repair-kit': '195245034', 'strong-rudder': '200135', 'extra-sail': '200912340',
  back: '201704138_iOS-back',
};
const equipFiles = readdirSync(join(ART, 'Cards/Equipment cards'));
for (const [id, stamp] of Object.entries(EQUIP)) {
  const f = equipFiles.find((n) => n.startsWith(`20250130_${stamp}`));
  if (f) img(`Cards/Equipment cards/${f}`, `equipment/${id}.webp`, 420);
  else console.warn(`equipment ${id} not found, skipped`);
}

// ---- Boards and player guides ----
img('Board/Shipboard/20250129_092632156_iOS.png', 'boards/ship-board.webp', 900, 1270);
img('Board/WeatherBoard/20250130_000847120_iOS.png', 'boards/weather-board.webp', 1100);
img('Board/PlayerGuideBoards/20250202_140434084_iOS.png', 'boards/guide-cannon-fire.webp', 1100);
img('Board/PlayerGuideBoards/20250202_171858760_iOS.png', 'boards/guide-points-of-sail.webp', 1000, 1250);
img('Board/Shipboard/20250129_092632156_iOS.png', 'boards/parchment.webp', 600, null, 70);

// ---- Sea maps: white background → transparent (flood fill from the edges), plus the hex grid fitted to the art ----
// Grid values were fitted to the 3545-px-wide JPG exports (odd-q offset: odd columns sit half a hex lower).
const MAPS = {
  'two-isles': { src: 'Map/MapsToPrint/20250202_172425139_iOS.png', s: 174.95, ox: 185.23, oy: 284.49 },
  'whirlpools': { src: 'Map/MapsToPrint/20250202_172357556_iOS.png', s: 174.95, ox: 185.23, oy: 284.49 },
  'atoll': { src: 'Map/MapsToPrint/20250202_172510830_iOS.png', s: 175.12, ox: 183.45, oy: 280.94 },
};
const MAP_W = 2560;
for (const [id, m] of Object.entries(MAPS))
  jobs.push(async () => {
    mkdirSync(join(OUT, 'maps'), { recursive: true });
    const { data, info } = await sharp(join(ART, m.src), { limitInputPixels: false })
      .resize({ width: MAP_W })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: W, height: H } = info;
    // Flood fill near-white from the border to transparent (keeps white foam and clouds inside the board).
    const seen = new Uint8Array(W * H);
    const isWhite = (i) => data[i * 4] > 238 && data[i * 4 + 1] > 238 && data[i * 4 + 2] > 238;
    const stack = [];
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    while (stack.length) {
      const i = stack.pop();
      if (seen[i] || !isWhite(i)) continue;
      seen[i] = 1;
      data[i * 4 + 3] = 0;
      const x = i % W;
      if (x > 0) stack.push(i - 1);
      if (x < W - 1) stack.push(i + 1);
      if (i >= W) stack.push(i - W);
      if (i < W * (H - 1)) stack.push(i + W);
    }
    // Which hexes are on the board: the hex centre and most of a ring around it are opaque.
    const k = W / 3545;
    const s = m.s * k, ox = m.ox * k, oy = m.oy * k, h = Math.sqrt(3) * s;
    const opaque = (x, y) => {
      const xi = Math.round(x), yi = Math.round(y);
      return xi >= 0 && yi >= 0 && xi < W && yi < H && data[(yi * W + xi) * 4 + 3] > 0;
    };
    const hexes = [];
    for (let col = 0; ox + 1.5 * s * col < W; col++)
      for (let row = 0; oy + h * (row + 0.5 * (col & 1)) < H; row++) {
        const cx = ox + 1.5 * s * col, cy = oy + h * (row + 0.5 * (col & 1));
        let n = opaque(cx, cy) ? 1 : 0;
        for (let a = 0; a < 6; a++) n += opaque(cx + 0.6 * s * Math.cos((a * Math.PI) / 3 + 0.5), cy + 0.6 * s * Math.sin((a * Math.PI) / 3 + 0.5)) ? 1 : 0;
        if (n >= 6) hexes.push([col, row]);
      }
    await sharp(data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 84, alphaQuality: 90 }).toFile(join(OUT, 'maps', `${id}.webp`));
    writeFileSync(
      join(OUT, 'maps', `${id}.json`),
      JSON.stringify({ width: W, height: H, size: +s.toFixed(3), originX: +ox.toFixed(3), originY: +oy.toFixed(3), layout: 'flat odd-q', hexes }) + '\n',
    );
  });

// Run a few at a time (the source PNGs are big).
const N = 4;
let next = 0;
await Promise.all(
  Array.from({ length: N }, async () => {
    while (next < jobs.length) await jobs[next++]();
  }),
);
console.log(`${jobs.length} images written to ${OUT}`);
