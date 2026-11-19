/**
 * Mammoth Sea Battles: clickable mock-up of layout A (web-spec §4.2) with the designer's art.
 * Plain TypeScript + DOM for the UI, Three.js for the tabletop. Not the M2 client: it's for testing the interface
 * with players before building it properly.
 */
import './style.css';
import { hexKey, DIRECTION_NAMES, type Hex } from '@msb/hex';
import { broadsideArcs, slotKey, type Part, type SlotRow } from '@msb/msb-rules';
import {
  ACTION_LABEL, CARD_BY_ID, CREW, EQUIPMENT, SAIL_LABEL, STEER_LABEL, TIDES, WEATHER_BY_ID, WOUNDED_ART,
  cardArt, equipmentArt, weatherArt,
} from './data/content';
import {
  PHASES, PHASE_LABEL, aiProgram, cardsToDraw, currentWeather, newGame, partEnds, partName, resolveTurn, simulate, upkeep,
  wouldSink, type Game, type ResolutionStep, type Ship,
} from './game';
import { Table, type MapInfo } from './table';

// ---------------- helpers ----------------
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const ROWS: SlotRow[] = ['sail', 'steer', 'action'];
const PARTS: Part[] = [1, 2, 3];
/** Where each band sits on the card art (fractions of height), for showing only the band that counts in a slot. */
const BANDS: Record<SlotRow, [number, number]> = { sail: [0.037, 0.341], steer: [0.341, 0.656], action: [0.656, 0.964] };
const bandStyle = (row: SlotRow, id: string) => {
  const [b0, b1] = BANDS[row];
  const band = b1 - b0;
  return `background-image:url(${cardArt(id)});--bs:${(100 / band).toFixed(1)}%;--bp:${((b0 / (1 - band)) * 100).toFixed(1)}%`;
};
const ROW_ICON: Record<SlotRow, string> = { sail: '⛵', steer: '☸', action: '💥' };
const ROW_NAME: Record<SlotRow, string> = { sail: 'Sail', steer: 'Steer', action: 'Action' };
const TIDE_STEP_LABEL = (ring: number) => TIDES[ring % 6]!;

// ---------------- settings & state ----------------
const settings = {
  map: 'two-isles',
  fleets: new URLSearchParams(location.search).has('fleets'),
  pointsOfSail: true,
  ghost: true,
  overlays: true,
  spread: false,
  lowDetail: /iPad|Android/.test(navigator.userAgent) || new URLSearchParams(location.search).has('lod'),
};

let game: Game;
let map: MapInfo;
let activeShip = '';
let selectedCard: string | null = null;
let inspected: string | null = null;
let undoStack: Map<string, Map<string, string>>[] = [];
let readyTimers: number[] = [];
type Mode = 'programming' | 'resolution';
let mode: Mode = 'programming';

const table = new Table($('#table'), $('#labels'));
document.documentElement.style.setProperty('--parchment', 'url(art/boards/parchment.webp)');

const myShips = () => game.ships.filter((s) => s.playerId === 'you');
const ship = () => game.ships.find((s) => s.id === activeShip)!;
const shipById = (id: string) => game.ships.find((s) => s.id === id)!;
const playerName = (s: Ship) => game.players.find((p) => p.id === s.playerId)!.name;

async function start() {
  map = await table.loadMap(settings.map);
  if (!tableShipLoaded) {
    await table.loadShip(settings.lowDetail);
    tableShipLoaded = true;
  }
  game = newGame({ onBoard: map.hexes, fleets: settings.fleets, pointsOfSail: settings.pointsOfSail });
  activeShip = myShips()[0]!.id;
  selectedCard = null;
  inspected = null;
  undoStack = [];
  setMode('programming');
  startRivalsThinking();
  renderAll();
}
let tableShipLoaded = false;

function startRivalsThinking() {
  readyTimers.forEach(clearTimeout);
  readyTimers = [];
  const rivals = game.ships.filter((s) => s.playerId !== 'you');
  rivals.forEach((s, i) => {
    aiProgram(game, s);
    // Rivals "think" for a few seconds, then show as ready (one stays thinking until you're ready).
    if (i < rivals.length - 1)
      readyTimers.push(window.setTimeout(() => ((s.ready = true), renderStatus(), renderRivals()), 2500 + i * 3500));
  });
}

// ---------------- rendering ----------------
function renderAll() {
  renderStatus();
  renderRivals();
  renderWeather();
  renderCrew();
  renderSwitcher();
  renderShipBoard();
  renderHand();
  renderTable();
  renderInspect();
  $('#ghost').classList.toggle('on', settings.ghost);
  $('#spread').classList.toggle('on', settings.spread);
}

function renderStatus() {
  const ready = game.players.filter((p) => p.shipIds.every((id) => shipById(id).ready)).length;
  $('#status').innerHTML =
    mode === 'programming'
      ? `Turn ${game.turn} · <b>Programming</b> · ${ready} of ${game.players.length} ready`
      : `Turn ${game.turn} · <b>Resolution</b>`;
}

function renderRivals() {
  const el = $('#rivals');
  const rivals = game.ships.filter((s) => s.playerId !== 'you');
  el.innerHTML = `<h3>Rivals <small>tap to find</small></h3>`;
  for (const s of rivals) {
    const healthy = s.crew.filter((c) => !c.wounded).length;
    const b = h(`<button class="rival" style="--c:${s.colour}">
      <span class="sw"></span>
      <span class="nm"><b>${esc(s.name)}</b><span>${esc(playerName(s))}</span></span>
      <span class="st" title="crew healthy/total">👥 ${healthy}/${s.crew.length}</span>
      <span class="st" title="ship damage">✕ ${s.damage.size}</span>
      <span class="${s.ready ? 'ok' : 'wait'}" title="${s.ready ? 'ready' : 'programming'}">${s.ready ? '✓' : '⌛'}</span>
    </button>`);
    if (s.treasure) b.querySelector('.nm span')!.insertAdjacentHTML('beforeend', ` · 💎 ${s.treasure}`);
    b.onclick = () => {
      inspected = s.id;
      table.focus(s.hex);
      renderInspect();
      renderTable();
    };
    el.appendChild(b);
  }
}

function renderWeather() {
  const [cur, next, then] = game.weather.map((id) => WEATHER_BY_ID.get(id)!);
  const el = $('#weather');
  el.innerHTML = `<h3>Weather &amp; tide <small>tap: weather board</small></h3>
    <div class="wx">
      <img src="${weatherArt(cur!.id)}" alt="${esc(cur!.name)}">
      <div class="next">next<img src="${weatherArt(next!.id)}" alt="${esc(next!.name)}">then<img src="${weatherArt(then!.id)}" alt="${esc(then!.name)}"></div>
    </div>
    <div class="wx-tide">Tide: <b>${TIDE_STEP_LABEL(game.ring)}</b> · next ${TIDE_STEP_LABEL(game.ring + 1)}<br><small>${esc(cur!.text)}</small></div>`;
  el.onclick = showWeatherBoard;
}

function renderCrew() {
  const s = ship();
  const el = $('#crew');
  el.innerHTML = `<h3>${myShips().length > 1 ? esc(s.name) + ' crew' : 'Your crew'} <small>${s.crew.length}/6 · draws ${cardsToDraw(s)} cards</small></h3><div class="crew-row"></div>`;
  const row = el.querySelector('.crew-row')!;
  s.crew.forEach((c, i) => {
    const def = CREW[c.def]!;
    const t = h(`<button class="token ${def.finished ? '' : 'placeholder'} ${c.wounded ? 'wounded' : ''}" style="background-image:url(${def.art})" aria-label="${esc(def.name)}">${def.finished ? '' : `<span class="nm">${esc(def.name)}</span>`}</button>`);
    t.onclick = () => (pendingCrewPick ? pendingCrewPick(i) : showCrew(c.def, c.wounded));
    if (pendingCrewPick) t.classList.add('pick');
    row.appendChild(t);
  });
  for (const e of s.equipment) {
    const b = h(`<button class="equip" style="background-image:url(${equipmentArt(e)})" aria-label="${esc(EQUIPMENT[e]!.name)}"></button>`);
    b.onclick = () => showImage(equipmentArt(e), `${EQUIPMENT[e]!.name}: ${EQUIPMENT[e]!.text} (equipment card)`);
    row.appendChild(b);
  }
}

function renderSwitcher() {
  const el = $('#switcher');
  const mine = myShips();
  el.hidden = mine.length < 2;
  $('#app').classList.toggle('fleets', mine.length > 1);
  el.innerHTML = '';
  for (const s of mine) {
    const b = h(`<button class="${s.id === activeShip ? 'on' : ''}" style="--c:${s.colour}"><span class="sw"></span>${esc(s.name)} · ${s.program.size}/9</button>`);
    b.onclick = () => {
      activeShip = s.id;
      selectedCard = null;
      renderAll();
      table.focus(s.hex);
    };
    el.appendChild(b);
  }
}

function slotEl(s: Ship, row: SlotRow, part: Part, opts: { readOnly?: boolean; now?: boolean } = {}) {
  const key = slotKey({ row, part });
  const id = s.program.get(key);
  const dmg = s.damage.has(key);
  const b = h(`<button class="slot ${row}" data-slot="${key}" aria-label="Part ${partName(part)} ${ROW_NAME[row]}"></button>`);
  if (dmg) {
    b.classList.add('damaged');
    b.title = 'Damaged: unusable until repaired';
  } else if (id) {
    b.classList.add('filled');
    b.setAttribute('style', bandStyle(row, id));
    b.innerHTML = `<span class="init">${CARD_BY_ID.get(id)!.initiative}</span>`;
    const c = CARD_BY_ID.get(id)!;
    b.title = row === 'sail' ? SAIL_LABEL[c.sail] : row === 'steer' ? STEER_LABEL[c.steer] : ACTION_LABEL[c.action];
  } else if (!opts.readOnly) {
    b.textContent = selectedCard ? 'tap to place' : '';
  }
  if (opts.now) b.classList.add('now');
  if (!opts.readOnly && !dmg && selectedCard) b.classList.add('target');
  if (!opts.readOnly) b.onclick = () => onSlot(key);
  return b;
}

function renderShipBoard() {
  const s = ship();
  const el = $('#shipboard');
  el.innerHTML = '';
  el.appendChild(h(`<div></div>`));
  for (const p of PARTS) el.appendChild(h(`<div class="sb-h">Part ${partName(p)}</div>`));
  const w = currentWeather(game);
  const drift = (p: Part) => (p === 1 ? ['gale'] : p === 2 ? ['gale', 'strong'] : ['gale', 'strong', 'firm']).includes(w.strength);
  const arrow = ['↑', '↗', '↘', '↓', '↙', '↖'][w.direction]!;
  ROWS.forEach((row) => {
    el.appendChild(h(`<div class="sb-row"><span class="ic">${ROW_ICON[row]}</span>${ROW_NAME[row]}</div>`));
    for (const p of PARTS) el.appendChild(slotEl(s, row, p));
    if (row === 'steer') {
      el.appendChild(h(`<div class="sb-strip-label">then</div>`));
      el.appendChild(h(`<div class="sb-strip"><span>Currents</span><span>Currents</span><span>Currents</span></div>`));
    }
    if (row === 'action') {
      el.appendChild(h(`<div class="sb-strip-label">then</div>`));
      const strengths = ['Gale', 'Gale + Strong', 'Gale + Strong + Firm'];
      el.appendChild(
        h(`<div class="sb-strip">${PARTS.map((p) => `<span class="${drift(p) ? 'on' : ''}" title="Wind drift in Part ${partName(p)}: ${strengths[p - 1]}">${drift(p) ? `Drift ${arrow}` : 'No drift'}</span>`).join('')}</div>`),
      );
    }
  });
}

function renderHand() {
  const s = ship();
  const el = $('#hand');
  const tray = $('#tray');
  el.classList.toggle('spread', settings.spread);
  const placed = new Map([...s.program].map(([k, id]) => [id, k]));
  // Hand order is kept; placed cards leave a gap ("placed → I · Sail") you can tap to take the card back.
  const all = [...s.hand];
  const make = (id: string) => {
    const where = placed.get(id);
    if (where) {
      const row = where.replace(/\d/, '') as SlotRow;
      const part = Number(where.slice(-1)) as Part;
      const g = h(`<button class="card gap"><span>placed →<br>${partName(part)} · ${ROW_NAME[row]}<br><small>tap to take back</small></span></button>`);
      g.onclick = () => takeBack(where);
      return g;
    }
    const c = h(`<button class="card ${selectedCard === id ? 'sel' : ''}" style="background-image:url(${cardArt(id)})" data-card="${id}" aria-label="Card ${CARD_BY_ID.get(id)!.initiative}"></button>`);
    attachCardPointer(c, id);
    return c;
  };
  el.innerHTML = `<div class="hand-info">Hand ${s.hand.length - placed.size} · placed ${placed.size} (max 9) · tap a card, then a glowing slot, or drag it</div>`;
  tray.innerHTML = '';
  tray.hidden = !(settings.spread && mode === 'programming');
  const W = el.clientWidth, H = el.clientHeight;
  const cardH = Math.min(H * 0.9, (W / Math.max(all.length, 1)) * 3);
  const cw = cardH * (1064 / 1500);
  el.style.setProperty('--cw', `${cw}px`);
  document.documentElement.style.setProperty('--cw', `${cw}px`);
  if (settings.spread) {
    for (const id of all) tray.appendChild(make(id));
    el.insertAdjacentHTML('beforeend', `<div class="hand-info" style="top:2em">Hand shown spread out above (Spread is on)</div>`);
    return;
  }
  const n = all.length;
  const step = n > 1 ? Math.min(cw * 0.98, (W - cw) / (n - 1)) : 0;
  const total = cw + step * (n - 1);
  const x0 = (W - total) / 2;
  all.forEach((id, i) => {
    const c = make(id);
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    c.style.left = `${x0 + i * step}px`;
    c.style.transform = `rotate(${t * Math.min(12, n * 1.5)}deg) translateY(${t * t * 16}px)`;
    // Earlier cards sit on top, so each card's initiative number (top-right on the art) stays visible.
    c.style.zIndex = String(n - i);
    el.appendChild(c);
  });
}

function renderTable() {
  table.setShips(game.ships.map((s) => ({ id: s.id, name: s.name, colour: s.colour, hex: s.hex, heading: s.heading, sail: s.sail, selected: s.id === activeShip || s.id === inspected })));
  if (mode !== 'programming') return;
  const s = ship();
  if (settings.ghost && s.program.size) {
    const steps = simulate(game, s);
    const ends = partEnds(steps);
    const path: Hex[] = [s.hex];
    for (const st of steps) for (const p of st.path) path.push(p);
    table.setGhost(s.colour, path, ends.map((e, i) => ({ ...e, label: partName((i + 1) as Part) })));
    // Broadside arcs for each Part where this ship fires.
    if (settings.overlays) {
      const arcs: Hex[] = [];
      PARTS.forEach((p, i) => {
        const id = s.program.get(slotKey({ row: 'action', part: p }));
        if (id && CARD_BY_ID.get(id)!.action === 'fire') {
          const a = broadsideArcs(ends[i]!.hex, ends[i]!.heading, game.config);
          arcs.push(...a.port, ...a.starboard);
        }
      });
      table.setOverlay(arcs);
    } else table.setOverlay([]);
  } else {
    table.setGhost(s.colour, [], []);
    table.setOverlay([]);
  }
  if (inspected && settings.overlays && inspected !== activeShip) {
    const t = shipById(inspected);
    const a = broadsideArcs(t.hex, t.heading, game.config);
    table.setOverlay([...a.port, ...a.starboard], '#3a6fd8', 0.22);
  }
}

function renderInspect() {
  const el = $('#inspect');
  if (!inspected) {
    el.hidden = true;
    return;
  }
  const s = shipById(inspected);
  el.hidden = false;
  const sail = s.sail === 'none' ? 'No Sail' : s.sail === 'half' ? 'Half Sail' : 'Full Sail';
  el.innerHTML = `<button class="btn x" aria-label="Close">✕</button>
    <h3 style="color:${s.colour}">${esc(s.name)}</h3>
    <dl class="kv"><dt>Player</dt><dd>${esc(playerName(s))}${s.playerId === 'you' ? ' (you)' : ''}</dd>
    <dt>Heading</dt><dd>${DIRECTION_NAMES[s.heading]} · ${sail}</dd>
    <dt>Crew</dt><dd>${s.crew.map((c) => esc(CREW[c.def]!.name) + (c.wounded ? ' (wounded)' : '')).join(', ')}</dd>
    <dt>Treasure</dt><dd>${s.treasure ? '💎 '.repeat(s.treasure) : 'none'}</dd>
    <dt>Damage</dt><dd><div class="mini-board">${ROWS.map((r) => PARTS.map((p) => `<i class="${s.damage.has(slotKey({ row: r, part: p })) ? 'dmg' : ''}" style="--b:var(--${r === 'action' ? 'act' : r})"></i>`).join('')).join('')}</div></dd></dl>
    <small>${s.playerId === 'you' ? '' : 'Blue hexes: her broadside arcs, range 4.'}</small>`;
  el.querySelector<HTMLElement>('.x')!.onclick = () => {
    inspected = null;
    renderInspect();
    renderTable();
  };
}

// ---------------- programming interactions ----------------
function snapshot() {
  undoStack.push(new Map(myShips().map((s) => [s.id, new Map(s.program)])));
  if (undoStack.length > 50) undoStack.shift();
}

function onSlot(key: string) {
  const s = ship();
  if (mode !== 'programming' || s.damage.has(key)) return;
  if (selectedCard) {
    snapshot();
    // A card already placed elsewhere moves; a card in the target slot goes back to the hand.
    for (const [k, id] of s.program) if (id === selectedCard) s.program.delete(k);
    s.program.set(key, selectedCard);
    selectedCard = null;
  } else if (s.program.has(key)) {
    takeBack(key);
    return;
  } else {
    toast('Pick a card from your hand first, then tap a slot.');
    return;
  }
  afterProgramChange();
}

function takeBack(key: string) {
  snapshot();
  ship().program.delete(key);
  afterProgramChange();
}

function afterProgramChange() {
  if (myShips().some((s) => s.ready)) myShips().forEach((s) => (s.ready = false));
  renderShipBoard();
  renderHand();
  renderSwitcher();
  renderTable();
  renderStatus();
  $('#ready').classList.remove('done');
}

function selectCard(id: string | null) {
  selectedCard = selectedCard === id ? null : id;
  renderShipBoard();
  renderHand();
}

/** Tap to select; or drag onto a slot. */
function attachCardPointer(el: HTMLElement, id: string) {
  el.addEventListener('pointerdown', (e) => {
    if (mode !== 'programming') return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let ghost: HTMLElement | null = null;
    let over: HTMLElement | null = null;
    const move = (ev: PointerEvent) => {
      if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        ghost = h(`<div class="drag-card" style="background-image:url(${cardArt(id)})"></div>`);
        $('#drag-layer').appendChild(ghost);
        el.style.opacity = '.35';
        selectedCard = id;
        document.querySelectorAll('#shipboard .slot:not(.damaged)').forEach((s) => s.classList.add('target'));
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        const target = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => (n as HTMLElement).dataset?.slot) as HTMLElement | undefined;
        if (over !== (target ?? null)) {
          over?.classList.remove('hover');
          over = target ?? null;
          over?.classList.add('hover');
        }
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (ghost) {
        ghost.remove();
        el.style.opacity = '';
        if (over && !over.classList.contains('damaged')) onSlot(over.dataset.slot!);
        else {
          selectedCard = null;
          renderShipBoard();
          renderHand();
        }
      } else selectCard(id);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

$('#undo').onclick = () => {
  const snap = undoStack.pop();
  if (!snap) return toast('Nothing to undo.');
  for (const s of myShips()) s.program = snap.get(s.id) ?? new Map();
  selectedCard = null;
  afterProgramChange();
};
$('#clear').onclick = () => {
  if (!ship().program.size) return;
  snapshot();
  ship().program.clear();
  selectedCard = null;
  afterProgramChange();
};
$('#ghost').onclick = () => {
  settings.ghost = !settings.ghost;
  $('#ghost').classList.toggle('on', settings.ghost);
  $('#ghost').setAttribute('aria-pressed', String(settings.ghost));
  renderTable();
};
$('#spread').onclick = () => {
  settings.spread = !settings.spread;
  $('#spread').classList.toggle('on', settings.spread);
  $('#spread').setAttribute('aria-pressed', String(settings.spread));
  renderHand();
};
$('#ready').onclick = () => {
  if (mode !== 'programming') return;
  const empty = myShips().every((s) => s.program.size === 0);
  myShips().forEach((s) => (s.ready = true));
  $('#ready').classList.add('done');
  renderStatus();
  toast(empty ? 'Ready with an empty program: your ship just drifts this turn.' : 'Ready! Waiting for the others…');
  // The last rival finishes shortly after you.
  readyTimers.forEach(clearTimeout);
  window.setTimeout(() => {
    game.ships.forEach((s) => (s.ready = true));
    renderStatus();
    renderRivals();
    window.setTimeout(beginResolution, 700);
  }, 900);
};

// view controls
document.querySelectorAll<HTMLElement>('#viewctl .btn').forEach((b) => {
  b.onclick = () => {
    const v = b.dataset.v;
    if (v === 'in') table.zoom(0.75);
    if (v === 'out') table.zoom(1.33);
    if (v === 'home') table.resetView();
    if (v === 'me') table.focus(ship().hex);
    if (v === 'overlays') {
      settings.overlays = !settings.overlays;
      b.classList.toggle('on', settings.overlays);
      renderTable();
    }
  };
});
table.onShipClick = (id) => {
  if (id && myShips().some((s) => s.id === id) && myShips().length > 1 && mode === 'programming') {
    activeShip = id;
    renderAll();
  }
  inspected = id;
  renderInspect();
  renderTable();
};

// ---------------- resolution ----------------
let res: { steps: ResolutionStep[]; i: number; playing: boolean; speed: number; waiting: boolean } | null = null;
let pendingCrewPick: ((i: number) => void) | null = null;

function setMode(m: Mode) {
  mode = m;
  const app = $('#app');
  app.classList.toggle('programming', m === 'programming');
  app.classList.toggle('resolution', m === 'resolution');
  app.classList.remove('peek');
  $('#playback').hidden = m !== 'resolution';
  $('#tray').hidden = !(settings.spread && m === 'programming');
}

function beginResolution() {
  setMode('resolution');
  selectedCard = null;
  inspected = null;
  table.setGhost('#fff', [], []);
  table.setOverlay([]);
  renderInspect();
  renderStatus();
  res = { steps: resolveTurn(game), i: 0, playing: true, speed: 1, waiting: false };
  renderPlayback();
  void playLoop();
}

function renderPlayback() {
  if (!res) return;
  const el = $('#playback');
  const cur = res.steps[Math.min(res.i, res.steps.length - 1)]!;
  const s = ship();
  const mini = h(`<div class="mini"></div>`);
  ROWS.forEach((row) => PARTS.forEach((p) => mini.appendChild(slotEl(s, row, p, { readOnly: true, now: !res!.waiting && p === cur.part && (row === 'sail' ? cur.phase === 'move' : row === 'steer' ? cur.phase === 'steer' : cur.phase === 'action') }))));
  const track = h(`<div class="track"></div>`);
  PARTS.forEach((p) => {
    const part = h(`<div class="part"><b>${partName(p)}</b></div>`);
    PHASES.forEach((ph) => {
      const idx = (p - 1) * PHASES.length + PHASES.indexOf(ph);
      part.appendChild(h(`<i class="${idx < res!.i ? 'done' : idx === res!.i ? 'now' : ''}" title="Part ${partName(p)} · ${PHASE_LABEL[ph]}"></i>`));
    });
    track.appendChild(part);
  });
  el.innerHTML = '';
  const mid = h(`<div class="mid"></div>`);
  mid.append(track, h(`<div class="cap"><small>Part ${partName(cur.part)} · ${PHASE_LABEL[cur.phase]}</small><span id="cap-text">${esc(cur.caption)}</span></div>`));
  el.append(mini, mid);
  const ctl = h(`<div class="ctl">
      <button class="btn sq" data-c="restart" aria-label="Replay from the start">⏮</button>
      <button class="btn sq" data-c="play" aria-label="Play or pause">${res.playing ? '⏸' : '▶'}</button>
      <button class="btn sq" data-c="step" aria-label="Next step">⏭</button>
      <button class="btn" data-c="speed">${res.speed}×</button>
      <button class="btn" data-c="skip">Skip</button>
      <button class="btn" data-c="peek">${$('#app').classList.contains('peek') ? 'Hide hand' : 'Peek'}</button>
    </div>`);
  ctl.querySelectorAll<HTMLElement>('button').forEach((b) => (b.onclick = () => playbackCtl(b.dataset.c!)));
  el.appendChild(ctl);
  document.documentElement.style.setProperty('--pb-h', `${el.offsetHeight}px`);
}

function playbackCtl(c: string) {
  if (!res) return;
  if (c === 'play') {
    res.playing = !res.playing;
    if (res.playing) void playLoop();
  }
  if (c === 'step' && !res.waiting) {
    res.playing = false;
    void doStep();
  }
  if (c === 'speed') res.speed = res.speed === 1 ? 2 : res.speed === 2 ? 4 : 1;
  if (c === 'skip') {
    res.speed = 16;
    res.playing = true;
    void playLoop();
  }
  if (c === 'restart') {
    // Replay: put ships back where they started this turn.
    const startState = startOfTurn;
    for (const s of game.ships) Object.assign(s, startState.get(s.id));
    renderTable();
    res.i = 0;
    res.playing = true;
    void playLoop();
  }
  if (c === 'peek') {
    $('#app').classList.toggle('peek');
    renderHand();
  }
  renderPlayback();
}

let startOfTurn = new Map<string, Pick<Ship, 'hex' | 'heading' | 'sail'>>();
let looping = false;
async function playLoop() {
  if (looping || !res) return;
  looping = true;
  if (res.i === 0) startOfTurn = new Map(game.ships.map((s) => [s.id, { hex: s.hex, heading: s.heading, sail: s.sail }]));
  while (res && res.playing && !res.waiting && res.i < res.steps.length) await doStep();
  looping = false;
}

async function doStep() {
  if (!res || res.i >= res.steps.length) return;
  const st = res.steps[res.i]!;
  renderPlayback();
  const ms = 900 / res.speed;
  await Promise.all(
    game.ships.map((s) => {
      const sh = st.ships.get(s.id)!;
      return table.animateShip(s.id, sh.path, sh.after.heading, sh.after.sail, sh.path.length ? ms * (0.5 + 0.35 * sh.path.length) : ms * 0.6);
    }),
  );
  for (const s of game.ships) Object.assign(s, { hex: st.ships.get(s.id)!.after.hex, heading: st.ships.get(s.id)!.after.heading, sail: st.ships.get(s.id)!.after.sail });
  if (st.shots.length) {
    for (const shot of st.shots) {
      table.broadside(shot.from, shot.target);
      const t = shipById(shot.target);
      if (t.playerId === 'you') {
        await placeDamage(t, shot.ship, shot.crew);
      } else {
        // AI places damage on a random free slot, avoiding blocking a whole row if it can (that would sink her, §7.3).
        for (let k = 0; k < shot.ship; k++) {
          const free = ROWS.flatMap((r) => PARTS.map((p) => slotKey({ row: r, part: p }))).filter((key) => !t.damage.has(key));
          const safe = free.filter((key) => !wouldSink({ ...t, damage: new Set([...t.damage, key]) }));
          const pool = safe.length ? safe : free;
          if (pool.length) t.damage.add(pool[game.rng.int(0, pool.length - 1)]!);
        }
        for (let k = 0; k < shot.crew; k++) {
          const c = t.crew.find((x) => !x.wounded && x.def !== 'captain') ?? t.crew.find((x) => !x.wounded);
          if (c) c.wounded = true;
        }
      }
    }
    renderRivals();
  }
  await new Promise((r) => setTimeout(r, (st.shots.length ? 1400 : 500) / res!.speed));
  res.i++;
  if (res.i >= res.steps.length) finishTurn();
  else renderPlayback();
}

/** Decision pause: you choose where Ship damage goes (rules §7.3) and which crew are hurt (§7.4). */
async function placeDamage(s: Ship, shipDmg: number, crewDmg: number) {
  if (!res) return;
  res.waiting = true;
  for (let k = 0; k < shipDmg; k++) {
    activeShip = s.id;
    renderPlayback();
    $('#cap-text').textContent = `You're hit! Choose a slot for 1 Ship damage (${shipDmg - k} to place). Any card there is lost.`;
    await new Promise<void>((resolve) => {
      document.querySelectorAll<HTMLElement>('#playback .mini .slot:not(.damaged)').forEach((b) => {
        b.classList.add('target');
        b.onclick = () => {
          s.damage.add(b.dataset.slot!);
          s.program.delete(b.dataset.slot!);
          resolve();
        };
      });
    });
    if (wouldSink(s)) toast(`${s.name} has a whole row blocked: she sinks! (Sinking comes in M1.)`);
  }
  for (let k = 0; k < crewDmg; k++) {
    renderPlayback();
    $('#cap-text').textContent = `Crew damage: tap a crew card to wound (or kill a wounded one).`;
    await new Promise<void>((resolve) => {
      pendingCrewPick = (i) => {
        const c = s.crew[i]!;
        if (c.wounded) s.crew.splice(i, 1);
        else c.wounded = true;
        pendingCrewPick = null;
        resolve();
      };
      renderCrew();
    });
    renderCrew();
  }
  res.waiting = false;
  renderPlayback();
}

function finishTurn() {
  if (!res) return;
  const notes = upkeep(game, res.steps);
  res = null;
  $('#app').classList.remove('peek');
  showPanel(
    `Upkeep · end of turn ${game.turn - 1}`,
    `<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}<li>Refits, wreck finds and new treasure: not in the mock-up yet.</li></ul>`,
    'Start turn ' + game.turn,
    () => {
      setMode('programming');
      undoStack = [];
      $('#ready').classList.remove('done');
      startRivalsThinking();
      renderAll();
    },
  );
}

// ---------------- modals & menu ----------------
function closeModal() {
  $('#modal').hidden = true;
  $('#modal').innerHTML = '';
}
$('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal')) closeModal();
});
function showImage(src: string, caption = '') {
  const m = $('#modal');
  m.innerHTML = '';
  const box = h(`<div class="box"><img class="big" src="${src}" alt=""><div>${esc(caption)}</div><button class="btn">Close</button></div>`);
  box.querySelector('button')!.onclick = closeModal;
  m.appendChild(box);
  m.hidden = false;
}
function showPanel(title: string, html: string, button = 'Close', onClose?: () => void) {
  const m = $('#modal');
  m.innerHTML = '';
  const box = h(`<div class="box"><div class="card-panel"><h2>${esc(title)}</h2>${html}<button class="btn primary">${esc(button)}</button></div></div>`);
  box.querySelector('button')!.onclick = () => {
    closeModal();
    onClose?.();
  };
  m.appendChild(box);
  m.hidden = false;
}
function showCrew(def: string, wounded: boolean) {
  const d = CREW[def]!;
  showImage(wounded && d.finished ? WOUNDED_ART : d.art, `${d.name}${wounded ? ' (wounded)' : ''} · draws ${d.draws} card${d.draws > 1 ? 's' : ''}${d.finished ? '' : ' · placeholder: portrait art, no crew card yet'}${d.power && d.finished ? ' · ' + d.power : ''}`);
}
/** Weather board with the three face-up cards on the ring (rules §3.5). */
function showWeatherBoard() {
  const POS: [number, number][] = [[50, 15.5], [79.5, 32.5], [79.5, 66], [50, 83], [20.5, 66], [20.5, 32.5]];
  const m = $('#modal');
  m.innerHTML = '';
  const board = h(`<div class="wboard" style="background-image:url(art/boards/weather-board.webp)"></div>`);
  game.weather.forEach((id, k) => {
    const [x, y] = POS[(game.ring + k) % 6]!;
    board.appendChild(h(`<img class="${k === 0 ? 'now' : ''}" src="${weatherArt(id)}" style="left:${x}%;top:${y}%" alt="">`));
  });
  const [x, y] = POS[game.ring]!;
  board.appendChild(h(`<div class="marker" style="left:${x}%;top:${y - 13}%">now</div>`));
  const box = h(`<div class="box"></div>`);
  box.appendChild(board);
  box.appendChild(h(`<div>The weather board advances one space each turn; each space is also a tide state. Current and next two cards are face up.</div>`));
  const b = h(`<button class="btn">Close</button>`);
  b.onclick = closeModal;
  box.appendChild(b);
  m.appendChild(box);
  m.hidden = false;
}

function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 3200);
}
let toastTimer = 0;

function renderMenu() {
  const m = $('#menu');
  m.innerHTML = `<h2>Mammoth Sea Battles <button class="btn sq" id="menu-x" aria-label="Close menu">✕</button></h2>
    <h4>Rules help</h4>
    <div class="grid">
      <button class="btn" data-img="art/boards/guide-points-of-sail.webp" data-cap="Points of sail (rules §6.2)">Points of sail</button>
      <button class="btn" data-img="art/boards/guide-cannon-fire.webp" data-cap="Cannon fire: broadsides, range 4 (rules §7.1)">Cannon fire</button>
      <button class="btn" data-img="art/boards/ship-board.webp" data-cap="The ship board: Parts I–III, Move → Steer → Currents → Action → Drift (rules §3.4)">Ship board</button>
      <button class="btn" id="m-weather">Weather board</button>
    </div>
    <h4>Game</h4>
    <p><a class="btn primary" href="play.html">Play the hot-seat prototype (real rules, 2–4 players) →</a></p>
    <label class="opt"><input type="checkbox" id="o-fleets" ${settings.fleets ? 'checked' : ''}> Fleets: two ships for you (expert, rules §8.7)</label>
    <label class="opt"><input type="checkbox" id="o-pos" ${settings.pointsOfSail ? 'checked' : ''}> Points of Sail rule (§6.2)</label>
    <label class="opt"><input type="checkbox" id="o-lod" ${settings.lowDetail ? 'checked' : ''}> Lighter ship models (iPad)</label>
    <div class="grid" style="margin-top:.4em">
      <select class="btn" id="o-map" aria-label="Map">
        <option value="two-isles">Map: Two Isles</option><option value="whirlpools">Map: Whirlpools</option><option value="atoll">Map: Atoll</option>
      </select>
      <button class="btn" id="m-restart">Restart</button>
    </div>
    <h4>About this mock-up</h4>
    <p>A clickable mock-up of layout A for testing with players. <b>Real</b>: the command cards, weather cards, crew cards, equipment cards, ship board, weather board, player guides, sea maps and ship model. The sailing, drift, broadsides and damage dice use the real rules code.</p>
    <p><b>Not yet</b>: currents, terrain, tides, pushing, treasure, sinking, refits. Crew without finished cards use their portrait art. Anchor, Row and Hard About moves are guesses (they're on the cards but not in the rules yet).</p>
    <p>Mouse: drag the table to pan, scroll to zoom, right-drag to tilt. Touch: one finger pans, two fingers zoom and tilt.</p>`;
  m.querySelector<HTMLElement>('#menu-x')!.onclick = () => (m.hidden = true);
  m.querySelectorAll<HTMLElement>('[data-img]').forEach((b) => (b.onclick = () => showImage(b.dataset.img!, b.dataset.cap!)));
  m.querySelector<HTMLElement>('#m-weather')!.onclick = showWeatherBoard;
  const sel = m.querySelector<HTMLSelectElement>('#o-map')!;
  sel.value = settings.map;
  const restart = async () => {
    settings.fleets = m.querySelector<HTMLInputElement>('#o-fleets')!.checked;
    settings.pointsOfSail = m.querySelector<HTMLInputElement>('#o-pos')!.checked;
    const lod = m.querySelector<HTMLInputElement>('#o-lod')!.checked;
    if (lod !== settings.lowDetail) {
      settings.lowDetail = lod;
      tableShipLoaded = false;
      table.setShips([]);
    }
    settings.map = sel.value;
    m.hidden = true;
    await start();
  };
  m.querySelector<HTMLElement>('#m-restart')!.onclick = restart;
  m.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.onchange = restart));
  sel.onchange = restart;
}
$('#menu-btn').onclick = () => {
  renderMenu();
  $('#menu').hidden = false;
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#modal').hidden) closeModal();
    else if (!$('#menu').hidden) $('#menu').hidden = true;
    else if (selectedCard) selectCard(null);
  }
});
new ResizeObserver(() => game && renderHand()).observe($('#hand'));

// Expose for automated checks (screenshots script).
(window as unknown as { msb: unknown }).msb = { get game() { return game; }, get mode() { return mode; }, hexKey };
void start();
