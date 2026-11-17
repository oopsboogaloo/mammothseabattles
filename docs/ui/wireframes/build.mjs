// Generates the M0 wireframes (self-contained HTML, greyscale) for Mammoth Sea Battles.
// Usage: node docs/ui/wireframes/build.mjs   (then: node docs/ui/wireframes/shoot.mjs)
// Each output file is standalone (inline CSS + SVG, no external assets). This script only exists
// so the shared pieces (cards, ship board, tabletop) stay consistent across layouts.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));

/* ---------- icons (inline SVG, currentColor) ---------- */
const svg = (d, extra = '') => `<svg class="ic" viewBox="0 0 20 20" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  sail: svg('<path d="M6 2v16" stroke="currentColor" stroke-width="1.6"/><path d="M7 3c6 1 9 5 9 10H7z" fill="currentColor" fill-opacity=".4" stroke="currentColor" stroke-width="1.3"/>'),
  wheel: svg('<circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 1v18M1 10h18M3.6 3.6l12.8 12.8M16.4 3.6 3.6 16.4" stroke="currentColor" stroke-width="1.3"/>'),
  port: svg('<path d="M15 5a7 7 0 1 0 1 9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2l3.5 3-4 2z" fill="currentColor"/>'),
  stbd: svg('<path d="M5 5a7 7 0 1 1-1 9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 2 4.5 5l4 2z" fill="currentColor"/>'),
  cannon: svg('<rect x="3" y="6" width="13" height="5" rx="1.5" transform="rotate(-15 10 9)" fill="currentColor"/><circle cx="8" cy="14" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
  repair: svg('<path d="M4 16 13 7" stroke="currentColor" stroke-width="2.4"/><circle cx="14" cy="6" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
  heal: svg('<path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="3.4"/>'),
  none: svg('<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 15 15 5" stroke="currentColor" stroke-width="1.6"/>'),
  cardic: svg('<rect x="5" y="2" width="10" height="16" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M5 7.5h10M5 12.5h10" stroke="currentColor" stroke-width="1.2"/>'),
  gem: svg('<path d="M10 2 17 9 10 18 3 9z" fill="currentColor" fill-opacity=".85"/>'),
  chevR: svg('<path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  chevL: svg('<path d="M13 4l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  chevU: svg('<path d="M4 13l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  chevD: svg('<path d="M4 7l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  menu: svg('<path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="2.2"/>'),
  help: svg('<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 7.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="14.5" r="1.1" fill="currentColor"/>'),
  plus: svg('<path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.2"/>'),
  minus: svg('<path d="M4 10h12" stroke="currentColor" stroke-width="2.2"/>'),
  rot: svg('<path d="M15 6a6.5 6.5 0 1 0 1.5 6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 2l3 4-4.5 1z" fill="currentColor"/>'),
  target: svg('<circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2" fill="currentColor"/>'),
  eye: svg('<path d="M1.5 10S5 4 10 4s8.5 6 8.5 6-3.5 6-8.5 6S1.5 10 1.5 10z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/>'),
  play: svg('<path d="M6 3.5v13L16.5 10z" fill="currentColor"/>'),
  pause: svg('<path d="M5 4h3.5v12H5zM11.5 4H15v12h-3.5z" fill="currentColor"/>'),
  stepF: svg('<path d="M4 4v12l8-6zM13 4h3v12h-3z" fill="currentColor"/>'),
  stepB: svg('<path d="M16 4v12l-8-6zM4 4h3v12H4z" fill="currentColor"/>'),
  skip: svg('<path d="M2 4v12l7-6zM9 4v12l7-6zM16 4h2v12h-2z" fill="currentColor"/>'),
  restart: svg('<path d="M18 4v12l-7-6zM11 4v12l-7-6zM2 4h2v12H2z" fill="currentColor"/>'),
  check: svg('<path d="M3.5 10.5l4 4 9-9" fill="none" stroke="currentColor" stroke-width="2.6"/>'),
  wait: svg('<path d="M5 2h10M5 18h10M6 2c0 5 8 5 8 8s-8 3-8 8M14 2c0 5-8 5-8 8s8 3 8 8" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  log: svg('<path d="M4 4h12M4 8h12M4 12h12M4 16h8" stroke="currentColor" stroke-width="1.8"/>'),
  die: svg('<rect x="3" y="3" width="14" height="14" rx="3" fill="#fff" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="7" r="1.3" fill="currentColor"/><circle cx="13" cy="13" r="1.3" fill="currentColor"/><circle cx="10" cy="10" r="1.3" fill="currentColor"/>'),
};
const arrow = (deg) => `<svg class="ic warrow" viewBox="0 0 20 20" style="transform:rotate(${deg}deg)" aria-hidden="true"><path d="M10 18V5" stroke="currentColor" stroke-width="2.6"/><path d="M4.5 8 10 1.5 15.5 8z" fill="currentColor"/></svg>`;

const steerIcon = (t) => (t.includes('PORT') ? I.port : I.stbd);
const actIcon = (a) => ({ FIRE: I.cannon, REPAIR: I.repair, HEAL: I.heal }[a] || I.none);

/* ---------- cards ---------- */
// [initiative, sail band, steer band, action band]
const HAND = [
  [840, 'FULL SAIL', 'HARD PORT', 'HEAL'],
  [400, 'HALF SAIL', 'EASE PORT', 'FIRE'],
  [620, 'FULL SAIL', 'EASE STBD', 'REPAIR'],
  [310, 'HALF SAIL', 'HARD STBD', 'FIRE'],
  [720, 'FULL SAIL', 'EASE PORT', 'FIRE'],
  [150, 'HALF SAIL', 'EASE STBD', 'REPAIR'],
  [530, 'HALF SAIL', 'HARD PORT', 'FIRE'],
  [860, 'FULL SAIL', 'HARD PORT', 'REPAIR'],
  [420, 'HALF SAIL', 'EASE PORT', 'HEAL'],
];
// indices of the hand that have been placed on the ship board (shown as dashed gaps that remember where they went)
const PLACED = { 0: 'I · Sail', 1: 'I · Steer', 3: 'I · Action' };
const SELECTED = 4; // the card the player has tapped (lifted); valid slots glow

function card(c, cls = '', style = '') {
  const [ini, s, t, a] = c;
  return `<div class="card ${cls}" style="${style}"><div class="ini">${ini}</div>
<div class="b bs">${I.sail}<span>${s}</span></div>
<div class="b bt">${steerIcon(t)}<span>${t}</span></div>
<div class="b ba">${actIcon(a)}<span>${a}</span></div></div>`;
}

function hand({ mode = 'fan', selected = SELECTED, label = true } = {}) {
  const cards = HAND.map((c, i) => {
    if (PLACED[i]) return `<div class="card gone" style="--i:${i}"><span>placed<br>→ ${PLACED[i]}</span><small>tap to take back</small></div>`;
    return card(c, i === selected ? 'sel' : '', `--i:${i}`);
  }).join('');
  return `<div class="hand ${mode}">${label ? `<div class="handlbl">Hand 6 + 3 placed (max 9) · tap a card, then a glowing slot · or drag</div>` : ''}${cards}</div>`;
}

/* ---------- ship board ---------- */
// slot content keyed "part-row" ; row in s|t|a
const SLOTS = {
  '0-s': [840, 'FULL SAIL'], '0-t': [400, 'EASE PORT'], '0-a': [310, 'FIRE'],
};
const BLOCKED = new Set(['2-t']);
const ROWS = [['s', 'Sail', I.sail], ['t', 'Steer', I.wheel], ['a', 'Action', I.cannon]];
const PARTS = ['I', 'II', 'III'];
const DRIFT = ['Drift: Gale', 'Drift: Gale, Strong', 'Drift: Gale, Strong, Firm'];

function slot(p, r, opts) {
  const k = `${p}-${r}`;
  const { targets = true, active, pick, picked, slots = SLOTS } = opts;
  if (picked && picked.includes(k)) return `<div class="slot blocked new" data-k="${k}"><b>✕</b><span>new marker</span></div>`;
  if (BLOCKED.has(k)) return `<div class="slot blocked" data-k="${k}"><b>✕</b><span>damaged</span></div>`;
  const filled = slots[k];
  const act = active === k ? ' active' : '';
  const pk = pick && !BLOCKED.has(k) ? ' pick' : '';
  if (filled) {
    const [ini, txt] = filled;
    const icon = r === 's' ? I.sail : r === 't' ? steerIcon(txt) : actIcon(txt);
    return `<div class="slot f ${r}${act}${pk}" data-k="${k}"><i class="sini">${ini}</i>${icon}<b>${txt}</b></div>`;
  }
  const tgt = targets ? ' tgt' : '';
  return `<div class="slot e${tgt}${act}${pk}" data-k="${k}"><span>${targets ? 'tap to place' : 'empty'}</span></div>`;
}

function shipBoard({ full = false, ...opts } = {}) {
  let h = `<div class="sb ${full ? 'full' : 'compact'}"><div class="sbt">Ship board</div>`;
  h += `<div class="corner"></div>` + PARTS.map((p) => `<div class="ph">Part ${p}</div>`).join('');
  const rowsHtml = (r, lbl, ic) => `<div class="rl">${ic}<span>${lbl}</span></div>` + PARTS.map((_, p) => slot(p, r, opts)).join('');
  h += rowsHtml(...ROWS[0]) + rowsHtml(...ROWS[1]);
  if (full) h += `<div class="rl strip"></div>` + PARTS.map(() => `<div class="strip">currents</div>`).join('');
  h += rowsHtml(...ROWS[2]);
  if (full) h += `<div class="rl strip"></div>` + PARTS.map((_, p) => `<div class="strip">${DRIFT[p]}</div>`).join('');
  return h + `</div>`;
}

/* ---------- weather ---------- */
function weather({ mode = 'badge' } = {}) {
  const cur = `<div class="hex big"><b>STRONG</b>${arrow(60)}<span>NE wind</span><small>+1 Full Sail</small></div>`;
  const n1 = `<div class="hex sm"><small>next</small><b>FIRM</b>${arrow(0)}<span>N</span></div>`;
  const n2 = `<div class="hex sm"><small>then</small><b>GALE</b>${arrow(-45)}<span>NW</span></div>`;
  if (mode === 'wheel') {
    // the physical tide wheel: 6 hexes, current + next two face up, the rest face down
    const pos = [['High', 'n1'], ['Mid ↓', 'n2'], ['Mid ↓', 'face down'], ['Low', 'face down'], ['Mid ↑', 'face down'], ['Mid ↑', 'cur']];
    const cells = pos.map(([tide, st], i) => {
      const inner = st === 'cur' ? `<b>STRONG</b>${arrow(60)}<span>NE</span>` : st === 'n1' ? `<small>next</small><b>FIRM</b>${arrow(0)}<span>N</span>` : st === 'n2' ? `<small>then</small><b>GALE</b>${arrow(-45)}<span>NW</span>` : `<span class="fd">?</span>`;
      return `<div class="whex w${i} ${st === 'cur' ? 'cur' : st === 'face down' ? 'down' : ''}">${inner}<em>${tide}</em></div>`;
    }).join('');
    return `<div class="wx wheel"><div class="pth">Weather board <small>· tide wheel</small></div><div class="wheelbox">${cells}<div class="wcentre">turn 4<br><small>advances in Upkeep</small></div></div></div>`;
  }
  return `<div class="wx badge"><div class="pth">Weather &amp; tide <span class="fold">${I.chevD}tap: full board</span></div>
<div class="wxrow">${cur}<div class="wxnext">${n1}${n2}</div></div>
<div class="tide"><b>Tide: Mid, rising</b> · next High (sandbanks flood)</div></div>`;
}

/* ---------- crew ---------- */
const CREW = [['Captain Mammoth', 3, false], ['Pirate', 1, false], ['Gunner', 1, true], ['Pirate', 1, false]];
function crew({ dir = 'row', title = true } = {}) {
  const c = CREW.map(([n, k, w]) => `<div class="crew ${w ? 'wounded' : ''}"><span class="cn">${n}</span><span class="ck">${I.cardic.repeat(k)}</span>${w ? '<span class="wd">wounded</span>' : ''}</div>`).join('');
  return `<div class="crewbox ${dir}">${title ? `<div class="pth">Your crew <small>4/6 · draws 5 cards</small></div>` : ''}<div class="crewlist">${c}</div></div>`;
}

/* ---------- opponents ---------- */
const OPP = [
  ['Woolly Revenge', 'AI · Good', 4, 2, true, true, 'p2'],
  ["Mammoth's Tusk", 'AI · Basic', 3, 0, false, true, 'p3'],
  ['Iron Mastodon', 'AI · Basic', 5, 4, false, false, 'p4'],
];
function opponents({ mode = 'list' } = {}) {
  if (mode === 'chips') {
    return `<div class="opps chips">${OPP.map(([n, , c, d, t, r, cls]) => `<div class="chip"><i class="sw ${cls}"></i><b>${n.split(' ')[0].replace("'s", '')}</b><span title="crew">${I.cardic}${c}</span><span title="damage" class="dm">✕${d}</span>${t ? `<span class="tr">${I.gem}treasure</span>` : ''}<span class="rd">${r ? I.check : I.wait}</span></div>`).join('')}<span class="fold">${I.chevD}tap a rival: details</span></div>`;
  }
  if (mode === 'icons') {
    return `<div class="opps icons">${OPP.map(([n, , , , t, r, cls]) => `<div class="av"><i class="sw ${cls}"></i>${t ? `<span class="tr">${I.gem}</span>` : ''}<span class="rd">${r ? I.check : I.wait}</span><span class="avn">${n.split(' ')[0]}</span></div>`).join('')}</div>`;
  }
  const full = mode === 'full';
  return `<div class="opps list ${full ? 'full' : ''}"><div class="pth">Rivals <span class="fold">${full ? '' : `${I.chevR}tap: expand`}</span></div>${OPP.map(([n, ai, c, d, t, r, cls]) => `<div class="opp"><i class="sw ${cls}"></i><div class="on"><b>${n}</b>${full ? `<small>${ai}</small>` : ''}</div><span title="crew">${I.cardic}${c}</span><span class="dm" title="damage markers">✕${d}</span><span class="tr ${t ? '' : 'no'}">${I.gem}</span><span class="rd">${r ? I.check : I.wait}</span>${full ? `<div class="mini">${Array.from({ length: 9 }, (_, i) => `<i class="${(i * 7 + d) % 9 < d ? 'x' : ''}"></i>`).join('')}</div>` : ''}</div>`).join('')}${full ? '<div class="oleg">crew · damage · treasure · ready · ship board (damage only)</div>' : ''}</div>`;
}

/* ---------- small bits ---------- */
const menuBtn = `<button class="btn icon" title="Menu: rules help, settings, quit">${I.menu}<span>Menu</span></button>`;
const status = (txt = 'Turn 4 · <b>Programming</b> · 2 of 4 ready') => `<div class="status">${txt}</div>`;
const helpBtn = `<button class="btn icon" title="Rules help">${I.help}<span>Rules</span></button>`;
const viewCtl = `<div class="viewctl">
<button class="btn sq" title="zoom in">${I.plus}</button><button class="btn sq" title="zoom out">${I.minus}</button>
<button class="btn sq" title="rotate">${I.rot}</button><button class="btn sq" title="centre on my ship">${I.target}</button>
<button class="btn sq" title="overlays: arcs, ghost, hazards">${I.eye}</button></div>`;
const actions = `<div class="actions"><button class="btn ready">${I.check}<span>Ready</span></button>
<button class="btn">Undo</button><button class="btn">Clear</button><label class="btn tog">${I.eye}<span>Ghost</span></label></div>`;
const wm = (t) => `<div class="wm">${t}</div>`;
const note = (t, cls = '') => `<div class="note ${cls}">${t}</div>`;

/* ---------- tabletop (perspective hex board placeholder) ---------- */
function tabletop({ phase = 'prog' } = {}) {
  const C = 17, R = 11, r = 1, s3 = Math.sqrt(3);
  const bw = 1.5 * r * (C - 1) + 2 * r, bh = s3 * r * (R + 0.5);
  const T = 40, B = 585, W = 940;
  const map = (x, y) => {
    const nx = x / bw, ny = y / bh;
    const sy = T + (B - T) * (0.78 * ny + 0.22 * ny * ny);
    const sc = 0.78 + 0.22 * ny;
    return [500 + (nx - 0.5) * W * sc, sy, sc];
  };
  const centre = (c, rw) => [1.5 * r * c + r, s3 * r * (rw + 0.5 * (c & 1)) + (s3 / 2) * r];
  const hexPts = (c, rw) => {
    const [cx, cy] = centre(c, rw);
    return Array.from({ length: 6 }, (_, k) => map(cx + r * Math.cos((Math.PI / 3) * k), cy + r * Math.sin((Math.PI / 3) * k)))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  };
  const P = (c, rw) => map(...centre(c, rw));
  const island = new Set(['8,3', '9,3', '9,4', '8,4', '10,4', '3,8', '4,8', '3,9', '13,7', '14,7', '14,8']);
  const reef = new Set(['7,4', '10,3', '11,5', '5,8', '12,7', '2,9']);
  const fog = new Set(['12,1', '13,1', '13,2', '14,1']);
  let hexes = '';
  for (let c = 0; c < C; c++) for (let rw = 0; rw < R; rw++) {
    const k = `${c},${rw}`;
    const cls = island.has(k) ? 'isl' : reef.has(k) ? 'reef' : fog.has(k) ? 'fog' : '';
    hexes += `<polygon class="hx ${cls}" points="${hexPts(c, rw)}"/>`;
  }
  // board outline (corners)
  const corners = [map(0, 0), map(bw, 0), map(bw, bh), map(0, bh)].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const ship = (c, rw, deg, lbl, cls = '', extra = '') => {
    const [x, y, sc] = P(c, rw);
    const L = 30 * sc, Wd = 11 * sc;
    return `<g class="ship ${cls}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><ellipse cx="0" cy="${5 * sc}" rx="${L * 0.75}" ry="${Wd * 0.7}" class="shadow"/><g transform="rotate(${deg}) scale(1,0.8)"><path d="M${-L / 2},${-Wd / 2} L${L / 4},${-Wd / 2} L${L / 2},0 L${L / 4},${Wd / 2} L${-L / 2},${Wd / 2}z" class="hull"/><line x1="${-L / 6}" y1="0" x2="${-L / 6}" y2="${-L * 0.9}" class="mast" transform="rotate(${-deg} ${-L / 6} 0)"/></g><text y="${-34 * sc}" class="slbl">${lbl}</text>${extra}</g>`;
  };
  const token = (c, rw, cls, t) => { const [x, y, sc] = P(c, rw); return `<g class="tok ${cls}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><ellipse rx="${30 * sc}" ry="${10 * sc}"/><text y="${4 * sc}">${t}</text></g>`; };
  const port = (c, rw, t) => { const [x, y, sc] = P(c, rw); return `<g class="port" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><rect x="${-16 * sc}" y="${-10 * sc}" width="${32 * sc}" height="${20 * sc}"/><text y="${4 * sc}">${t}</text></g>`; };
  const currentArrow = (a, b) => { const [x1, y1] = P(...a), [x2, y2] = P(...b); return `<line class="cur" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ah)"/>`; };
  const path = (pts, cls) => `<polyline class="${cls}" points="${pts.map((p) => P(...p).slice(0, 2).map((v) => v.toFixed(1)).join(',')).join(' ')}" marker-end="url(#ah2)"/>`;
  const pmark = (c, rw, t, cls = '') => { const [x, y, sc] = P(c, rw); return `<g class="pm ${cls}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><circle r="${11 * sc}"/><text y="${4 * sc}">${t}</text></g>`; };

  let over = '';
  over += currentArrow([5, 3], [6, 3]) + currentArrow([6, 3], [7, 2]) + currentArrow([11, 8], [11, 9]);
  over += port(0, 5, 'YOUR PORT') + port(16, 2, 'P2 port') + port(9, 10, 'P3 port') + port(5, 0, 'P4 port');
  over += token(10, 6, 'wreck', 'wreck') + token(6, 2, 'treas', 'TREASURE') + token(12, 9, 'treas', 'TREASURE');
  if (phase === 'prog') {
    // ghost preview of your draft program (Part I only is programmed so far)
    over += path([[4, 6], [5, 6], [6, 5], [7, 5]], 'ghost');
    over += ship(7, 5, -90 - 30 - 60, 'ghost after I', 'ghostship');
    over += pmark(7, 5, 'I', 'gpm');
    over += `<text class="glbl" x="${P(6, 6)[0]}" y="${P(6, 6)[1] + 26}">ghost preview: Full Sail, broad reach = 3 hexes, then Ease Port</text>`;
  } else {
    // resolution: trail of what happened so far this turn, numbered steps
    over += path([[4, 6], [5, 6], [6, 5], [7, 5]], 'trail');
    over += pmark(5, 6, '1') + pmark(7, 5, '2');
    over += path([[7, 5], [8, 4]], 'trail push');
    over += `<g class="arc">${(() => { const [x, y] = P(9, 5); return `<path d="M${x} ${y} l140 -10 l-30 85z"/>`; })()}</g>`;
    over += pmark(8, 6, 'DD', 'hit');
  }
  over += ship(phase === 'prog' ? 4 : 8, phase === 'prog' ? 6 : 6, phase === 'prog' ? -30 : -150, 'YOU (Half Sail)', 'you');
  over += ship(9, 5, 30, 'Woolly Revenge ◆', 'p2', '');
  over += ship(12, 4, 150, "Mammoth's Tusk", 'p3');
  over += ship(6, 9, -90, 'Iron Mastodon', 'p4');
  const [wx, wy] = map(bw * 0.86, bh * 0.1);
  over += `<g class="windrose" transform="translate(${wx},${wy})"><circle r="26"/><path d="M0 18 V-14" /><path d="M-7 -8 0 -20 7 -8z" class="ah" transform="rotate(60)"/><text y="44">wind NE · Strong</text></g>`;

  return `<svg class="tabletop" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid meet" role="img" aria-label="3D tabletop placeholder">
<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#555"/></marker>
<marker id="ah2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 10 5 0 10z" fill="#222"/></marker>
<pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.2" fill="#777"/></pattern>
<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#aaa" stroke-width="2"/></pattern></defs>
<polygon class="boardedge" points="${corners}"/>
${hexes}${over}
<text class="ttl" x="500" y="612">3D TABLETOP placeholder: flat printed hex board, gentle perspective (~35°) · ships are 3D miniatures · pan / zoom / limited rotate</text>
</svg>`;
}

/* ---------- shared CSS ---------- */
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--u:min(1vh,0.75vw);--tap:max(44px,calc(var(--u)*5.6));--fs:max(11px,calc(var(--u)*1.45));--fss:max(11px,calc(var(--u)*1.2));
--ink:#222;--line:#555;--paper:#fafafa;--table:#c9c9c9;--panel:#f4f4f4;--bs:#efefef;--bt:#d9d9d9;--ba:#bcbcbc}
html,body{width:100%;height:100%}
body{font:var(--fs)/1.2 Inter,"DejaVu Sans",sans-serif;color:var(--ink);background:var(--table)}
.ic{width:1.25em;height:1.25em;flex:none;vertical-align:-.25em}
b{font-weight:650}
small{font-size:var(--fss);opacity:.75}
button{font:inherit;color:inherit}
.btn{min-height:var(--tap);min-width:var(--tap);padding:0 calc(var(--u)*1.2);border:2px solid var(--line);border-radius:calc(var(--u)*.8);background:#fff;display:inline-flex;align-items:center;justify-content:center;gap:.4em;cursor:pointer;box-shadow:0 2px 0 #888}
.btn.icon{flex-direction:row}
.btn.sq{padding:0}
.btn.ready{background:#333;color:#fff;font-weight:700;font-size:calc(var(--fs)*1.15)}
.btn.tog{border-style:dashed}
.pth{font-weight:700;font-size:var(--fss);text-transform:uppercase;letter-spacing:.04em;display:flex;gap:.5em;align-items:center;justify-content:space-between;white-space:nowrap}
.pth small{text-transform:none;letter-spacing:0;font-weight:400}
.fold{font-weight:400;text-transform:none;letter-spacing:0;font-size:var(--fss);border:1px dashed #777;border-radius:999px;padding:0 .5em;display:inline-flex;align-items:center;gap:.2em;background:#fff;white-space:nowrap}
.panel{background:var(--panel);border:2px solid var(--line);border-radius:calc(var(--u)*1);box-shadow:0 3px 8px rgba(0,0,0,.25)}
.wm{position:absolute;pointer-events:none;top:calc(var(--u)*1);left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:.25em .8em;border-radius:999px;font-size:var(--fss);white-space:nowrap;z-index:50;opacity:.85}
.note{pointer-events:none;position:absolute;font-size:var(--fss);font-style:italic;background:#fff;border:1.5px dotted #333;padding:.2em .5em;border-radius:4px;z-index:60;max-width:calc(var(--u)*30)}
.status{background:#fff;border:2px solid var(--line);border-radius:999px;padding:0 1em;min-height:var(--tap);display:flex;align-items:center;white-space:nowrap}

/* tabletop */
.tablewrap{position:relative;overflow:hidden;background:repeating-linear-gradient(100deg,#c4c4c4 0 18px,#cbcbcb 18px 40px);min-height:0;min-width:0}
.tabletop{position:absolute;inset:0;width:100%;height:100%}
.boardedge{fill:#f3f3f3;stroke:#444;stroke-width:4;filter:drop-shadow(0 6px 4px rgba(0,0,0,.35))}
.hx{fill:#f3f3f3;stroke:#a8a8a8;stroke-width:.8}
.hx.isl{fill:#b5b5b5}.hx.reef{fill:url(#dots)}.hx.fog{fill:url(#hatch)}
.cur{stroke:#555;stroke-width:3}
.port rect{fill:#fff;stroke:#333;stroke-width:2}.port text,.tok text,.pm text{font:700 10px Inter,sans-serif;text-anchor:middle;fill:#222}
.tok ellipse{fill:#ddd;stroke:#333;stroke-width:1.5}.tok.treas ellipse{fill:#fff;stroke-width:2.5}
.ship .hull{fill:#888;stroke:#111;stroke-width:1.5}.ship.you .hull{fill:#222}.ship .mast{stroke:#111;stroke-width:2}
.ship .shadow{fill:rgba(0,0,0,.25)}
.ship .slbl{font:700 12px Inter,sans-serif;text-anchor:middle;fill:#111;paint-order:stroke;stroke:#fff;stroke-width:3px}
.ghostship .hull{fill:none;stroke:#222;stroke-dasharray:3 2}.ghostship .shadow{display:none}.ghostship .slbl{font-weight:400;font-style:italic}
.ghost{fill:none;stroke:#222;stroke-width:3;stroke-dasharray:6 5}
.trail{fill:none;stroke:#222;stroke-width:3.5}.trail.push{stroke-dasharray:2 4}
.pm circle{fill:#fff;stroke:#222;stroke-width:2}.pm.hit circle{fill:#222}.pm.hit text{fill:#fff}
.glbl{font:italic 12px Inter,sans-serif;text-anchor:middle;fill:#222;paint-order:stroke;stroke:#fff;stroke-width:3px}
.arc path{fill:rgba(0,0,0,.12);stroke:#333;stroke-dasharray:4 3}
.windrose circle{fill:#fff;stroke:#333;stroke-width:2}.windrose path{stroke:#222;stroke-width:3;fill:#222}.windrose text{font:600 11px Inter,sans-serif;text-anchor:middle}
.windrose > path:first-of-type{transform:rotate(60deg)}
.ttl{font:600 13px Inter,sans-serif;text-anchor:middle;fill:#333}

/* cards */
.card{--cw:calc(var(--ch)*.71);width:var(--cw);height:var(--ch);background:#fff;border:2px solid #222;border-radius:calc(var(--ch)*.05);display:flex;flex-direction:column;overflow:hidden;position:relative;box-shadow:0 2px 4px rgba(0,0,0,.35)}
.card .ini{position:absolute;top:2px;left:4px;font-weight:800;font-size:var(--fss);background:rgba(255,255,255,.8);border-radius:3px;padding:0 2px}
.card .b{flex:1;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:0 0 0 4px;font-size:var(--fss);font-weight:700;line-height:1.05;border-top:1px solid #999}
.card .b .ic{width:1.6em;height:1.6em}
.card .bs{background:var(--bs);border-top:0;padding-top:1.1em}.card .bt{background:var(--bt)}.card .ba{background:var(--ba)}
.card.sel{outline:4px solid #000;outline-offset:2px;transform:translateY(-28%) !important;z-index:30}
.card.gone{background:#b1b1b1;border:2px dashed #777;box-shadow:none;align-items:center;justify-content:center;text-align:center;font-size:var(--fss);color:#444;gap:.3em}
.card.gone small{font-size:var(--fss)}
.hand{position:relative;min-width:0}
.hand .handlbl{position:absolute;top:0;left:0;font-size:var(--fss);font-style:italic;white-space:nowrap;overflow:hidden;max-width:100%}
.hand.fan .card{position:absolute;bottom:calc(var(--u)*.6);left:calc(var(--u)*1 + (100% - var(--cw) - var(--u)*2) * var(--i) / 8);transform:rotate(calc((var(--i) - 4) * 1.2deg));transform-origin:50% 120%}
.hand.grid{display:grid;grid-template-columns:repeat(5,minmax(0,calc(var(--ch)*.72)));grid-template-rows:repeat(2,minmax(0,1fr));gap:calc(var(--u)*.8);align-content:end;justify-content:start;padding-top:calc(var(--u)*2.2)}
.hand.grid .card{width:100%;height:100%}
.hand.grid .card.sel{transform:translateY(-8%) !important}

/* ship board */
.sb{display:grid;grid-template-columns:calc(var(--u)*5.5) repeat(3,var(--sw));background:#e4e4e4;border:3px double #444;border-radius:calc(var(--u)*.6);padding:calc(var(--u)*.5);gap:calc(var(--u)*.5);position:relative;align-content:start}
.sb .sbt{grid-column:1/-1;font-weight:700;font-size:var(--fss);text-transform:uppercase;letter-spacing:.05em;display:none}
.sb .ph{text-align:center;font-weight:700;font-size:var(--fss);font-family:"DejaVu Serif",serif}
.sb .rl{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:var(--fss);font-weight:600}
.sb .rl .ic{width:1.6em;height:1.6em}
.slot{border-radius:calc(var(--u)*.6);border:2px solid #222;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;font-size:var(--fss);line-height:1.05;text-align:center;min-height:var(--tap)}
.slot.f.s{background:var(--bs)}.slot.f.t{background:var(--bt)}.slot.f.a{background:var(--ba)}
.slot.f .ic{width:1.7em;height:1.7em}
.slot .sini{position:absolute;top:1px;right:3px;font-style:normal;font-weight:800;font-size:var(--fss)}
.slot.e{background:#f6f6f6;border:2px dashed #888;color:#666}
.slot.e.tgt{border:3px dashed #000;background:#fff;color:#000;font-weight:600;box-shadow:0 0 0 3px rgba(0,0,0,.15)}
.slot.blocked{background:repeating-linear-gradient(45deg,#ccc 0 6px,#e8e8e8 6px 12px)}
.slot.blocked b{font-size:calc(var(--fs)*1.8);line-height:1}
.slot.blocked.new{outline:4px solid #000;outline-offset:1px}
.slot.active{outline:5px solid #000;outline-offset:2px;z-index:2}
.slot.pick{box-shadow:0 0 0 3px #fff,0 0 0 6px #000}
.sb .strip{font-size:var(--fss);text-align:center;background:#fff;border:1.5px solid #444;border-radius:999px;display:flex;align-items:center;justify-content:center;line-height:1.05;padding:1px 4px;border-radius:8px}
.sb .rl.strip{background:none;border:0;font-style:italic}
.sb.compact{grid-template-rows:auto repeat(3,1fr)}
.sb.full{grid-template-rows:auto 1fr 1fr auto 1fr auto}
.sb.full .slot.f{font-size:var(--fs)}

/* weather */
.hex{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:#555;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.05}
.hex.big{width:calc(var(--u)*13);height:calc(var(--u)*11.2)}
.hex.sm{width:calc(var(--u)*8.6);height:calc(var(--u)*7.4);background:#888;font-size:var(--fss)}
.hex small{opacity:.9}
.hex .warrow{width:1.6em;height:1.6em}
.wx.badge{display:flex;flex-direction:column;gap:calc(var(--u)*.5);padding:calc(var(--u)*.8)}
.wxrow{display:flex;gap:calc(var(--u)*.6);align-items:center}
.wxnext{display:flex;flex-direction:column;gap:calc(var(--u)*.3)}
.tide{font-size:var(--fss);white-space:nowrap}
.wheelbox{position:relative;width:calc(var(--u)*26);height:calc(var(--u)*25);margin:0 auto}
.whex{position:absolute;width:calc(var(--u)*9);height:calc(var(--u)*7.8);clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:#999;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:var(--fss);line-height:1.05;text-align:center}
.whex em{font-size:var(--fss);font-style:normal;opacity:.85}
.whex.cur{background:#333;outline:3px solid #000}
.whex.down{background:#d6d6d6;color:#555}
.whex .warrow{width:1.3em;height:1.3em}
.w0{left:calc(var(--u)*8.5);top:0}.w1{left:calc(var(--u)*17);top:calc(var(--u)*4.4)}.w2{left:calc(var(--u)*17);top:calc(var(--u)*12.8)}
.w3{left:calc(var(--u)*8.5);top:calc(var(--u)*17.2)}.w4{left:0;top:calc(var(--u)*12.8)}.w5{left:0;top:calc(var(--u)*4.4)}
.wcentre{position:absolute;left:calc(var(--u)*9);top:calc(var(--u)*9.5);width:calc(var(--u)*8);text-align:center;font-size:var(--fss)}
.fd{font-size:calc(var(--fs)*1.4);font-weight:700}

/* crew */
.crewbox .crewlist{display:flex;gap:calc(var(--u)*.6)}
.crewbox.col .crewlist{flex-wrap:wrap}
.crew{width:calc(var(--u)*8.2);height:calc(var(--u)*8.2);min-width:var(--tap);min-height:var(--tap);border-radius:50%;border:2px solid #222;background:radial-gradient(circle at 50% 35%,#e6e6e6 0 45%,#cfcfcf 46%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:max(11px,calc(var(--u)*1.1));line-height:1;padding:3px;position:relative;flex:none}
.crew .cn{font-weight:700}
.crew .ck .ic{width:1.1em;height:1.3em;margin:0 -1px}
.crew.wounded{background:repeating-linear-gradient(135deg,#bbb 0 4px,#ddd 4px 8px);border-style:dashed}
.crew .wd{font-style:italic}

/* opponents */
.sw{display:inline-block;width:1.1em;height:1.1em;border:2px solid #222;border-radius:50%;flex:none}
.sw.p2{background:#555}.sw.p3{background:repeating-linear-gradient(90deg,#222 0 3px,#fff 3px 6px)}.sw.p4{background:#fff}
.opps.list{display:flex;flex-direction:column;gap:calc(var(--u)*.4);padding:calc(var(--u)*.8)}
.opp{display:grid;grid-template-columns:auto 1fr auto auto auto auto;gap:.5em;align-items:center;min-height:max(36px,calc(var(--u)*4.4));background:#fff;border:1px solid #888;border-radius:6px;padding:0 .5em;white-space:nowrap}
.opp .on{display:flex;flex-direction:column;overflow:hidden}
.opp .tr.no{opacity:.15}
.opps.full .opp{grid-template-columns:auto 1fr auto auto auto auto;grid-template-rows:auto auto;padding:.3em .5em}
.opps.full .mini{grid-column:2/-1;display:grid;grid-template-columns:repeat(3,1.2em);gap:2px}
.opps.full .mini i{height:.9em;border:1px solid #555;background:#f4f4f4}.opps.full .mini i.x{background:#555}
.oleg{font-size:var(--fss);font-style:italic}
.opps.chips{display:flex;gap:calc(var(--u)*.6);align-items:center;flex-wrap:nowrap}
@media (max-aspect-ratio:3/2){.opps.chips .fold{display:none}}
.chip{display:flex;gap:.45em;align-items:center;background:#fff;border:2px solid #555;border-radius:999px;padding:0 .7em;min-height:var(--tap);white-space:nowrap}
.chip .tr{display:inline-flex;align-items:center;gap:.15em;border:1.5px solid #222;border-radius:4px;padding:0 .3em;font-weight:700}
.opps.icons{display:flex;flex-direction:column;gap:calc(var(--u)*.8);align-items:center}
.av{position:relative;width:var(--tap);height:var(--tap);border:2px solid #333;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}
.av .sw{width:60%;height:60%}
.av .tr{position:absolute;top:-6px;right:-8px;background:#fff;border-radius:50%}
.av .rd{position:absolute;bottom:-6px;right:-8px;background:#fff;border-radius:50%}
.av .avn{position:absolute;bottom:-1.3em;font-size:11px;white-space:nowrap}
.viewctl{display:flex;flex-direction:column;gap:calc(var(--u)*.5)}
.actions{display:flex;flex-direction:column;gap:calc(var(--u)*.6);justify-content:flex-end}
.actions .btn{width:100%}
.actions .ready{flex:1;max-height:calc(var(--u)*11);flex-direction:column}
.actions .ready .ic{width:1.8em;height:1.8em}
`;

const page = (title, cls, body, extraCss = '') => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${CSS}${extraCss}</style></head>
<body class="${cls}">${body}</body></html>`;

/* ============ Layout A: bottom dock ============ */
const cssA = `
.A{display:grid;grid-template-rows:1fr calc(var(--u)*30);width:100vw;height:100vh}
.A .tl{position:absolute;top:calc(var(--u)*1);left:calc(var(--u)*1);display:flex;gap:calc(var(--u)*.8);z-index:5}
.A .oppbox{position:absolute;top:calc(var(--u)*8.5);left:calc(var(--u)*1);width:calc(var(--u)*30);z-index:5}
.A .crewov{position:absolute;bottom:calc(var(--u)*1);left:calc(var(--u)*1);padding:calc(var(--u)*.6);z-index:5}
.A .wxbox{position:absolute;top:calc(var(--u)*1);right:calc(var(--u)*1);z-index:5}
.A .vc{position:absolute;right:calc(var(--u)*1);bottom:calc(var(--u)*1);z-index:5}
.A .dock{display:grid;grid-template-columns:auto 1fr calc(var(--u)*12);gap:calc(var(--u)*1.2);padding:calc(var(--u)*.8) calc(var(--u)*1.2);background:#9f9f9f;border-top:4px solid #555;box-shadow:0 -4px 10px rgba(0,0,0,.25);min-height:0;--ch:calc(var(--u)*24)}
.A .sb{--sw:calc(var(--u)*12.5);height:100%}
.A .hand{--ch:calc(var(--u)*23)}
`;
const bodyA = `<div class="A">
<div class="tablewrap">${tabletop()}
<div class="tl">${menuBtn}${status()}</div>
<div class="oppbox panel">${opponents()}</div>
<div class="crewov panel">${crew()}</div>
<div class="wxbox panel">${weather()}</div>
<div class="vc">${viewCtl}</div>
${wm('Layout A · Bottom dock · PROGRAMMING')}
</div>
<div class="dock">${shipBoard()}${hand()}${actions}</div>
</div>`;

/* ============ Layout A: resolution variant ============ */
const cssAR = cssA + `
.A.res{grid-template-rows:1fr calc(var(--u)*25)}
.A.res .dock{grid-template-columns:auto 1fr calc(var(--u)*14)}
.A.res .sb{--sw:calc(var(--u)*11)}
.play{display:flex;flex-direction:column;gap:calc(var(--u)*.6);min-width:0}
.track{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--u)*.6)}
.tpart{background:#fff;border:2px solid #555;border-radius:6px;padding:2px 4px}
.tpart.now{border-color:#000;border-width:3px}
.tpart .tp{font-weight:700;font-size:var(--fss);font-family:"DejaVu Serif",serif}
.tpart .phs{display:flex;gap:2px}
.tpart .phs i{flex:1;font-style:normal;font-size:max(11px,calc(var(--u)*1.05));text-align:center;border:1px solid #888;border-radius:3px;padding:1px 0;white-space:nowrap;overflow:hidden;background:#f4f4f4}
.tpart .phs i.done{background:#bbb}.tpart .phs i.cur{background:#222;color:#fff;font-weight:700}
.caption{background:#fff;border:2px solid #222;border-radius:8px;padding:calc(var(--u)*.6) calc(var(--u)*1);flex:1;min-height:0;overflow:hidden;font-size:var(--fs);line-height:1.3}
.caption .cp{font-weight:700}
.ctl{display:flex;gap:calc(var(--u)*.6);align-items:center}
.ctl .spd{display:flex;border:2px solid #555;border-radius:8px;overflow:hidden}
.ctl .spd span{min-width:var(--tap);min-height:var(--tap);display:flex;align-items:center;justify-content:center;background:#fff;border-right:1px solid #999}
.ctl .spd span.on{background:#222;color:#fff}
.handstack{display:flex;flex-direction:column;gap:calc(var(--u)*.6);justify-content:flex-end}
.handstack .stack{flex:1;border:2px solid #333;border-radius:8px;background:repeating-linear-gradient(0deg,#fff 0 6px,#ddd 6px 8px);display:flex;align-items:center;justify-content:center;text-align:center;font-size:var(--fss);padding:4px}
.prompt{position:absolute;left:calc(var(--u)*1);bottom:calc(var(--u)*1);width:calc(var(--u)*44);z-index:20;background:#fff;border:3px solid #000;border-radius:10px;padding:calc(var(--u)*1);box-shadow:0 6px 18px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:calc(var(--u)*.7)}
.prompt h3{font-size:calc(var(--fs)*1.15)}
.prompt .roll{display:flex;gap:.6em;align-items:center}
.prompt .roll .d12{width:calc(var(--u)*6);height:calc(var(--u)*6);min-width:40px;min-height:40px;border:3px solid #000;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:calc(var(--fs)*1.4);transform:rotate(-8deg)}
.prompt .timer{height:8px;background:#ddd;border-radius:4px;overflow:hidden}.prompt .timer i{display:block;height:100%;width:70%;background:#333}
.prompt .row{display:flex;gap:calc(var(--u)*.6)}
.prompt .row .btn{flex:1}
.prompt:after{content:"";position:absolute;bottom:-16px;left:calc(var(--u)*14);border:14px solid transparent;border-top-color:#000;border-bottom:0}
.A.res .crewov{bottom:auto;left:auto;right:calc(var(--u)*1);top:calc(var(--u)*24)}
.A.res .oppbox{width:calc(var(--u)*30)}
`;
const bodyAR = `<div class="A res">
<div class="tablewrap">${tabletop({ phase: 'res' })}
<div class="tl">${menuBtn}${status('Turn 4 · <b>Resolution</b> · Part II · Action')}</div>
<div class="oppbox panel">${opponents()}</div>
<div class="crewov panel">${crew()}</div>
<div class="wxbox panel">${weather()}</div>
<div class="vc">${viewCtl}</div>
<div class="prompt"><h3>Your decision · place damage</h3>
<div class="roll"><div class="d12">8</div><div><b>Woolly Revenge</b> fired: 1 DD.<br>d12 = 8 → <b>Ship damage 2</b>.</div></div>
<div>Tap <b>2 slots</b> on your ship board below (1 placed, 1 to go). A full blocked row sinks you: the board warns you.</div>
<div class="timer"><i></i></div><small>0:42 left · if time runs out: least valuable slot</small>
<div class="row"><button class="btn">Undo</button><button class="btn ready">Confirm</button></div></div>
${wm('Layout A · Bottom dock · RESOLUTION (paused for a decision)')}
</div>
<div class="dock">${shipBoard({ targets: false, active: '1-a', pick: true, picked: ['2-s'], slots: { ...SLOTS, '1-s': [720, 'FULL SAIL'], '1-t': [620, 'EASE STBD'], '1-a': [150, 'REPAIR'], '2-s': [530, 'HALF SAIL'], '2-a': [420, 'HEAL'] } })}
<div class="play">
<div class="track">${PARTS.map((p, pi) => `<div class="tpart ${pi === 1 ? 'now' : ''}"><div class="tp">Part ${p}</div><div class="phs">${['Sail', 'Steer', 'Curr', 'Act', 'Drift', 'End'].map((n, ni) => `<i class="${pi < 1 || (pi === 1 && ni < 3) ? 'done' : pi === 1 && ni === 3 ? 'cur' : ''}">${n}</i>`).join('')}</div></div>`).join('')}</div>
<div class="caption"><span class="cp">Part II · d. Action · initiative 720 first:</span> <b>Woolly Revenge</b> fires both broadsides. You are in her starboard arc at range 3 → <b>1 DD</b> to you.<br><small>Before: Part II Sail: broad reach in a Strong wind, Full Sail = 4 hexes; you rammed her (1 DD to her) and pushed her 1 hex.</small></div>
<div class="ctl"><button class="btn sq" title="restart turn">${I.restart}</button><button class="btn sq" title="step back">${I.stepB}</button><button class="btn sq" title="pause">${I.pause}</button><button class="btn sq" title="step">${I.stepF}</button><button class="btn sq" title="skip to end">${I.skip}</button><div class="spd"><span>1×</span><span class="on">2×</span><span>4×</span></div><button class="btn">${I.log}<span>Log</span></button></div>
</div>
<div class="handstack"><div class="stack">Hand (6)<br>folded during<br>resolution</div><button class="btn">${I.chevU}Peek</button></div>
</div></div>`;

/* ============ Layout B: player mat on the right ============ */
const cssB = `
.B{display:grid;grid-template-columns:1fr calc(var(--u)*47);width:100vw;height:100vh}
.B .left{display:grid;grid-template-rows:auto 1fr calc(var(--u)*26);min-width:0;min-height:0}
.B .top{display:flex;gap:calc(var(--u)*.8);padding:calc(var(--u)*.8);background:#a9a9a9;border-bottom:3px solid #555;align-items:center;min-width:0;overflow:hidden}
.B .wxbox{position:absolute;top:calc(var(--u)*1);right:calc(var(--u)*1);z-index:5}
.B .vc{position:absolute;right:calc(var(--u)*1);bottom:calc(var(--u)*1);z-index:5}
.B .handrow{background:#9f9f9f;border-top:4px solid #555;padding:calc(var(--u)*.8) calc(var(--u)*1.2);display:grid;min-width:0}
.B .hand{--ch:calc(var(--u)*22)}
.B .mat{background:#8f8f8f;border-left:4px solid #444;padding:calc(var(--u)*1);display:grid;grid-template-rows:auto 1fr auto auto;gap:calc(var(--u)*1);min-height:0}
.B .math{display:flex;justify-content:space-between;align-items:center;gap:.5em;background:#fff;border:2px solid #444;border-radius:8px;padding:0 .6em;min-height:var(--tap)}
.B .sb{--sw:1fr;grid-template-columns:calc(var(--u)*5.5) repeat(3,1fr);min-height:0}
.B .sb .slot.f{font-size:var(--fs)}
.B .matcrew{background:#fff;border:2px solid #444;border-radius:8px;padding:calc(var(--u)*.6)}
.B .matcrew .crew{width:calc(var(--u)*9.2);height:calc(var(--u)*9.2)}
.B .mact{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:calc(var(--u)*.6)}
.B .mact .ready{min-height:calc(var(--u)*7.5)}
`;
const bodyB = `<div class="B">
<div class="left">
<div class="top">${menuBtn}${opponents({ mode: 'chips' })}</div>
<div class="tablewrap">${tabletop()}
<div class="wxbox panel">${weather()}</div>
<div class="vc">${viewCtl}</div>
${wm('Layout B · Player mat on the right · PROGRAMMING')}
</div>
<div class="handrow">${hand()}</div>
</div>
<div class="mat">
<div class="math"><span>Turn 4 · <b>Programming</b> · 2/4 ready</span><span>Black Mammoth · Half Sail</span></div>
${shipBoard({ full: true })}
<div class="matcrew">${crew()}</div>
<div class="mact"><button class="btn ready">${I.check}Ready</button><button class="btn">Undo</button><button class="btn">Clear</button><label class="btn tog">${I.eye}</label></div>
</div></div>`;

/* ============ Layout C: slide-up player-mat drawer ============ */
const cssC = `
.C{position:relative;width:100vw;height:100vh}
.C .tablewrap{position:absolute;inset:0}
.C .tl{position:absolute;top:calc(var(--u)*1);left:calc(var(--u)*1);display:flex;gap:calc(var(--u)*.8);z-index:5}
.C .oppbar{position:absolute;top:calc(var(--u)*8.2);left:calc(var(--u)*1);z-index:5;max-width:calc(100% - var(--u)*36)}
.C .wxbox{position:absolute;top:calc(var(--u)*1);right:calc(var(--u)*1);z-index:5}
.C .vc{position:absolute;right:calc(var(--u)*1);top:calc(var(--u)*24);z-index:5}
.C .tabletop{height:58%}
.C .drawer{position:absolute;left:0;right:0;bottom:0;height:calc(var(--u)*44);background:linear-gradient(#a3a3a3,#8c8c8c);border-top:4px solid #444;box-shadow:0 -8px 18px rgba(0,0,0,.35);border-radius:14px 14px 0 0;display:grid;grid-template-columns:auto auto 1fr calc(var(--u)*12);gap:calc(var(--u)*1.2);padding:calc(var(--u)*1.2);z-index:10}
.C .handle{position:absolute;top:calc(var(--u)*-5.6 - 4px);left:50%;transform:translateX(-50%);min-height:var(--tap);height:calc(var(--u)*5.6);display:flex;align-items:center;gap:.6em;padding:0 1.4em;background:#8f8f8f;border:4px solid #444;border-bottom:0;border-radius:12px 12px 0 0;font-weight:700;white-space:nowrap}
.C .crewcol .pth{flex-wrap:wrap;white-space:normal}
.C .crewcol{background:#fff;border:2px solid #444;border-radius:8px;padding:calc(var(--u)*.6);width:calc(var(--u)*19.5)}
.C .crewcol .crewlist{flex-wrap:wrap}
.C .sb{--sw:calc(var(--u)*12);height:100%}
.C .hand{--ch:calc(var(--u)*17.6);min-height:0}
.C .foldhint{position:absolute;right:calc(var(--u)*14);top:calc(var(--u)*-5.2);z-index:11}
`;
const bodyC = `<div class="C">
<div class="tablewrap">${tabletop()}</div>
<div class="tl">${menuBtn}${status()}</div>
<div class="oppbar">${opponents({ mode: 'chips' })}</div>
<div class="wxbox panel">${weather()}</div>
<div class="vc">${viewCtl}</div>
${wm('Layout C · Player-mat drawer (open) · PROGRAMMING')}
<div class="drawer">
<button class="handle">${I.chevD}Player mat · tap or swipe down to fold</button>
<div class="crewcol">${crew({ title: true })}</div>
${shipBoard({ full: true })}
${hand({ mode: 'grid' })}
${actions}
</div>
${note('Folded: only the handle + Ready stay (≈6% of screen); camera re-frames the board into the space above the open drawer.', '').replace('class="note "', 'class="note" style="right:calc(var(--u)*14);bottom:calc(var(--u)*50.5)"')}
</div>`;

/* ============ Layout D: two rails, everything open (collapses on 4:3) ============ */
const cssD = `
.D{display:grid;grid-template-columns:calc(var(--u)*33) 1fr calc(var(--u)*45);width:100vw;height:100vh}
.D .lrail{background:#a9a9a9;border-right:4px solid #444;padding:calc(var(--u)*1);display:flex;flex-direction:column;gap:calc(var(--u)*1);min-height:0}
.D .lrail .tl{display:flex;gap:calc(var(--u)*.6)}
.D .lrail .panel{padding:calc(var(--u)*.6)}
.D .closed{display:none}
.D .open{display:flex;flex-direction:column;gap:calc(var(--u)*1);flex:1;min-height:0}
.D .centre{display:grid;grid-template-rows:1fr calc(var(--u)*25);min-width:0;min-height:0}
.D .handrow{background:#9f9f9f;border-top:4px solid #555;padding:calc(var(--u)*.8) calc(var(--u)*1.2);display:grid;min-width:0}
.D .hand{--ch:calc(var(--u)*21)}
.D .vc{position:absolute;right:calc(var(--u)*1);bottom:calc(var(--u)*1);z-index:5}
.D .tl2{position:absolute;top:calc(var(--u)*1);left:calc(var(--u)*1);z-index:5}
.D .rrail{background:#8f8f8f;border-left:4px solid #444;padding:calc(var(--u)*1);display:grid;grid-template-rows:auto 1fr auto auto;gap:calc(var(--u)*1);min-height:0}
.D .sb{--sw:1fr;grid-template-columns:calc(var(--u)*5.5) repeat(3,1fr);min-height:0}
.D .rrail .matcrew{background:#fff;border:2px solid #444;border-radius:8px;padding:calc(var(--u)*.6)}
.D .rrail .crew{width:calc(var(--u)*8.6);height:calc(var(--u)*8.6)}
.D .math{display:flex;justify-content:space-between;align-items:center;background:#fff;border:2px solid #444;border-radius:8px;padding:0 .6em;min-height:var(--tap)}
.D .mact{display:grid;grid-template-columns:2fr 1fr 1fr;gap:calc(var(--u)*.6)}
.D .mact .ready{min-height:calc(var(--u)*7)}
@media (max-aspect-ratio: 3/2){
 .D{grid-template-columns:calc(var(--u)*10) 1fr calc(var(--u)*45)}
 .D .open{display:none}.D .closed{display:flex}
 .D .lrail{align-items:center;padding:calc(var(--u)*1) calc(var(--u)*.6)}
}
.D .closed{flex-direction:column;align-items:center;gap:calc(var(--u)*1.4)}
.D .minihex{width:calc(var(--u)*8.4);height:calc(var(--u)*7.3);min-width:44px;font-size:max(11px,calc(var(--u)*1.1));clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:#444;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.D .minihex .warrow{width:1.2em;height:1.2em}
.D .nextdots{font-size:max(11px,calc(var(--u)*1.1));text-align:center}
.D .exp{writing-mode:vertical-rl;transform:rotate(180deg);border:1px dashed #333;background:#fff;border-radius:999px;padding:.6em .2em;font-size:var(--fss);display:flex;align-items:center;gap:.3em}
`;
const bodyD = `<div class="D">
<div class="lrail">
<div class="open">
<div class="tl">${menuBtn}${helpBtn}</div>
${status()}
<div class="panel">${weather({ mode: 'wheel' })}<div class="tide"><b>Strong NE</b> now · +1 Full Sail moves<br>Firm N next · Gale NW after</div></div>
<div class="panel" style="flex:1;min-height:0">${opponents({ mode: 'full' })}</div>
</div>
<div class="closed">${`<button class="btn sq" title="menu">${I.menu}</button>`}
<div class="minihex"><b>STRONG</b>${arrow(60)}NE</div><div class="nextdots">next:<br>Firm N<br>Gale NW</div>
${opponents({ mode: 'icons' })}
<span class="exp">${I.chevR}expand rail</span></div>
</div>
<div class="centre"><div class="tablewrap">${tabletop()}<div class="vc">${viewCtl}</div>${wm('Layout D · Two rails, everything open · PROGRAMMING')}</div>
<div class="handrow">${hand()}</div></div>
<div class="rrail">
<div class="math"><b>YOUR SHIP · Black Mammoth</b><span>sail: Half</span></div>
${shipBoard({ full: true })}
<div class="matcrew">${crew()}</div>
<div class="mact"><button class="btn ready">${I.check}Ready</button><button class="btn">Undo</button><button class="btn">Clear</button></div>
</div></div>`;

const files = {
  'layout-a-bottom-dock.html': page('Wireframe A: bottom dock (programming)', '', bodyA, cssA),
  'layout-a-bottom-dock-resolution.html': page('Wireframe A: bottom dock (resolution)', '', bodyAR, cssAR),
  'layout-b-player-mat-right.html': page('Wireframe B: player mat on the right (programming)', '', bodyB, cssB),
  'layout-c-drawer.html': page('Wireframe C: player-mat drawer (programming)', '', bodyC, cssC),
  'layout-d-two-rails.html': page('Wireframe D: two rails (programming)', '', bodyD, cssD),
};
for (const [f, html] of Object.entries(files)) writeFileSync(join(OUT, f), html);
console.log('wrote', Object.keys(files).join(', '));
