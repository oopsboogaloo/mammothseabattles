/**
 * Mammoth Sea Battles: two-to-four-player hot-seat prototype (implementation plan P8) on the real rules engine.
 * One device is passed round the table: a hand-over screen hides each player's hand from the others.
 * The UI only reads views and events and sends actions through the Session (engineering design §11).
 */
import './style.css';
import './play.css';
import { DIRECTION_NAMES, hexKey, type Direction, type Hex } from '@msb/hex';
import {
  HIDDEN,
  parseHexKey,
  SLOT_KEYS,
  type Action,
  type CommandCard,
  type GameEvent,
  type GameView,
  type RefitChoice,
  type SailLevel,
  type Slot,
  type SlotRow,
} from '@msb/msb-rules';
import { prototypeSetup } from '@msb/msb-data';
import { ACTION_LABEL, SAIL_LABEL, STEER_LABEL, TIDES, cardArt, weatherArt } from './data/content';
import { PLAYER_COLOURS } from './game';
import { drawBoard } from './board-art';
import { Session } from './session';
import { Table } from './table';

// ---------------- helpers ----------------
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ROWS: SlotRow[] = ['sail', 'steer', 'action'];
const PARTS = [1, 2, 3] as const;
const PART_NAME = ['', 'I', 'II', 'III'];
const ROW_ICON: Record<SlotRow, string> = { sail: '⛵', steer: '☸', action: '💥' };
const ROW_NAME: Record<SlotRow, string> = { sail: 'Sail', steer: 'Steer', action: 'Action' };
const BANDS: Record<SlotRow, [number, number]> = { sail: [0.037, 0.341], steer: [0.341, 0.656], action: [0.656, 0.964] };
const bandStyle = (row: SlotRow, id: string) => {
  const [b0, b1] = BANDS[row];
  const band = b1 - b0;
  return `background-image:url(${cardArt(id)});--bs:${(100 / band).toFixed(1)}%;--bp:${((b0 / (1 - band)) * 100).toFixed(1)}%`;
};
const TIDE_NAME = { high: 'High', mid: 'Mid', low: 'Low' } as const;
const STRENGTH_NAME: Record<string, string> = { deadCalm: 'Dead Calm', light: 'Light', firm: 'Firm', strong: 'Strong', gale: 'Gale', newFront: 'New Weather Front' };

// ---------------- state ----------------
let session: Session | undefined;
let cards = new Map<string, CommandCard>();
let colours: Record<string, string> = {};
let selectedCard: string | null = null;
/** The player whose screen is showing (after the hand-over), or null when the screen is hidden. */
let viewer: string | null = null;
let busy = false;
/** Ship positions as shown on the table (they lag the state while events play back). */
let shown: Record<string, { hex: Hex; heading: Direction; sail: SailLevel; afloat: boolean }> = {};
let log: string[] = [];

const table = new Table($('#table'), $('#labels'));
document.documentElement.style.setProperty('--parchment', 'url(art/boards/parchment.webp)');
let shipLoaded = false;

const S = () => session as Session;
const playerName = (p: string) => S().state.players[p]?.name ?? p;
const shipName = (id: string) => playerName(S().state.ships[id]?.player ?? id);
const teamName = (t: string) => (S().state.teams[t]?.players ?? []).map(playerName).join(' & ') || t;
const seats = () => S().setup.seats;

// ---------------- screens ----------------
function screen(html: string): HTMLElement {
  const el = $('#screen');
  el.innerHTML = '';
  const box = h(`<div class="card-panel">${html}</div>`);
  el.appendChild(box);
  el.hidden = false;
  return box;
}
const hideScreen = () => ($('#screen').hidden = true);

function startScreen() {
  viewer = null;
  const saved = Session.load();
  const box = screen(`<h1>Mammoth Sea Battles</h1>
    <p>Hot-seat prototype: 2–4 players share this device, one ship each, on the test map. <b>1 player</b> is the <b>Solo Challenge</b>: bring home as much treasure as you can in 14 turns${bestScore() === undefined ? '' : ` (your best: ${bestScore()})`}.</p>
    <div id="names"></div>
    <div class="row"><button class="btn" id="add">+ Add player</button><button class="btn" id="del">− Remove player</button></div>
    <label class="row"><input type="checkbox" id="safe"> Safe edge (optional rule: the map edge stops ships instead of sinking them)</label>
    <div class="row"><button class="btn primary big" id="go">Start new game</button>${saved ? '<button class="btn big" id="resume">Resume saved game</button>' : ''}</div>`);
  let n = 2;
  const names = box.querySelector<HTMLElement>('#names')!;
  const draw = () => {
    const old = [...names.querySelectorAll('input')].map((i) => i.value);
    names.innerHTML = '';
    for (let i = 0; i < n; i++)
      names.appendChild(h(`<div class="row"><span class="sw" style="--c:${PLAYER_COLOURS[i]}"></span><input type="text" value="${esc(old[i] ?? `Player ${i + 1}`)}" aria-label="Player ${i + 1} name"></div>`));
  };
  draw();
  box.querySelector<HTMLElement>('#add')!.onclick = () => ((n = Math.min(4, n + 1)), draw());
  box.querySelector<HTMLElement>('#del')!.onclick = () => ((n = Math.max(1, n - 1)), draw());
  box.querySelector<HTMLElement>('#go')!.onclick = () => {
    const players = [...names.querySelectorAll('input')].map((i, k) => ({ name: i.value.trim() || `Player ${k + 1}` }));
    const safe = box.querySelector<HTMLInputElement>('#safe')!.checked;
    Session.clear();
    void begin(new Session(prototypeSetup(players, (Date.now() % 1_000_000_007) >>> 0), safe));
  };
  const resume = box.querySelector<HTMLElement>('#resume');
  if (resume && saved) resume.onclick = () => void begin(saved);
}

async function begin(s: Session) {
  session = s;
  cards = new Map(s.setup.commandCards.map((c) => [c.id, c]));
  // Fetch every card picture now, so a hand never shows blank cards while they load.
  for (const src of [...cards.keys()].map(cardArt).concat("art/cards/back.webp")) new Image().src = src;
  colours = Object.fromEntries(s.setup.seats.map((seat, i) => [seat.player, PLAYER_COLOURS[i]!]));
  const ports = Object.fromEntries(s.setup.seats.map((seat) => [hexKey(seat.homePort), colours[seat.player]!]));
  const art = drawBoard(s.setup.map, ports);
  table.loadBoard(art.info, art.canvas);
  if (!shipLoaded) {
    await table.loadShip(/iPad|Android/.test(navigator.userAgent));
    shipLoaded = true;
  }
  table.setShips([]);
  syncShown();
  log = [];
  hideScreen();
  next();
}

/** Decide what to show next from the state alone, so a reloaded game picks up where it was. */
function next() {
  const s = S().state;
  renderTable();
  renderPanels(null);
  if (s.phase === 'over') return endScreen();
  if (s.phase === 'resolving' && s.pending) return decisionScreen();
  const waiting = seats().find((seat) => !s.ready.includes(seat.player));
  if (waiting) handOver(waiting.player);
}

function handOver(player: string) {
  // Solo Challenge: no one to hide the cards from.
  if (seats().length === 1) return showHand(player);
  viewer = null;
  $('#app').classList.add('programming');
  $('#dock').hidden = true;
  const turn = S().state.turn;
  const box = screen(`<h2>Turn ${turn}: pass the device to</h2>
    <h1 style="color:${colours[player]}">${esc(playerName(player))}</h1>
    <p>Everyone else, look away: your cards are secret.</p>
    <div class="row"><button class="btn primary big" id="me">I'm ${esc(playerName(player))}: show my cards</button></div>`);
  box.querySelector<HTMLElement>('#me')!.onclick = () => showHand(player);
}

function showHand(player: string) {
  viewer = player;
  selectedCard = null;
  hideScreen();
  $('#dock').hidden = false;
  $('#playback').hidden = true;
  renderProgramming();
  const ship = myShip();
  if (ship) table.focus(ship.pos);
}

function myShip() {
  if (!viewer) return undefined;
  const id = S().state.players[viewer]?.ships[0];
  return id ? S().view(viewer).ships[id] : undefined;
}

// ---------------- programming ----------------
function act(action: Action, player = viewer as string): GameEvent[] {
  return S().apply(player, action);
}

function renderProgramming() {
  if (!viewer) return;
  const v = S().view(viewer);
  renderPanels(v);
  renderShipBoard();
  renderHand();
  const legal = S().legal(viewer);
  const ready = $('#ready');
  const canReady = legal.some((a) => a.type === 'ready');
  ready.toggleAttribute('disabled', !canReady);
  ready.innerHTML = canReady ? '<span class="i">✓</span> Ready' : 'Discard first';
  ready.onclick = () => {
    if (!canReady || !viewer) return;
    const events = act({ type: 'ready' });
    viewer = null;
    $('#dock').hidden = true;
    if (S().state.phase === 'programming') return next();
    void play(events);
  };
  $('#clear').onclick = () => {
    const ship = myShip();
    if (!ship) return;
    for (const slot of SLOT_KEYS) if (ship.program[slot] !== undefined) act({ type: 'remove', ship: ship.id, slot });
    selectedCard = null;
    renderProgramming();
  };
}

function renderShipBoard() {
  const ship = myShip();
  const el = $('#shipboard');
  el.innerHTML = '';
  if (!ship) return;
  const programmable = S().legal(viewer as string).some((a) => a.type === 'place' || a.type === 'remove');
  el.appendChild(h('<div></div>'));
  for (const p of PARTS) el.appendChild(h(`<div class="sb-h">Part ${PART_NAME[p]}</div>`));
  ROWS.forEach((row) => {
    el.appendChild(h(`<div class="sb-row"><span class="ic">${ROW_ICON[row]}</span>${ROW_NAME[row]}</div>`));
    for (const p of PARTS) {
      const key = `${row}${p}`;
      const id = ship.program[key];
      const b = h(`<button class="slot ${row}" data-slot="${key}" aria-label="Part ${PART_NAME[p]} ${ROW_NAME[row]}"></button>`);
      if (ship.blocked.includes(key)) {
        b.classList.add('damaged');
        b.title = 'Damaged: unusable until repaired';
      } else if (id) {
        b.classList.add('filled');
        b.setAttribute('style', bandStyle(row, id));
        b.innerHTML = `<span class="init">${cards.get(id)?.initiative ?? ''}</span>`;
        b.title = describeBand(id, row);
        if (programmable) b.onclick = () => (act({ type: 'remove', ship: ship.id, slot: key }), renderProgramming());
      } else if (programmable) {
        b.textContent = selectedCard ? 'tap to place' : row === 'sail' ? 'No Sail' : '';
        if (selectedCard) b.classList.add('target');
        b.onclick = () => {
          if (!selectedCard) return;
          act({ type: 'place', ship: ship.id, slot: key, card: selectedCard });
          selectedCard = null;
          renderProgramming();
        };
      }
      el.appendChild(b);
    }
    if (row === 'steer') {
      el.appendChild(h('<div class="sb-strip-label">then</div>'));
      el.appendChild(h('<div class="sb-strip"><span>Currents</span><span>Currents</span><span>Currents</span></div>'));
    }
    if (row === 'action') {
      el.appendChild(h('<div class="sb-strip-label">then</div>'));
      el.appendChild(h(`<div class="sb-strip">${PARTS.map(() => `<span>Drift</span>`).join('')}</div>`));
    }
  });
}

function describeBand(id: string, row: SlotRow): string {
  const c = cards.get(id);
  if (!c) return id;
  return row === 'sail' ? SAIL_LABEL[c.sail] : row === 'steer' ? STEER_LABEL[c.steer] : ACTION_LABEL[c.action];
}

function renderHand() {
  const ship = myShip();
  const el = $('#hand');
  if (!ship?.hand) {
    el.innerHTML = `<div class="hand-info">${ship?.status === 'sunk' ? 'Your ship is sunk: she returns in Upkeep.' : ship?.refitting ? 'Your ship is refitting in port this turn.' : ''} Press Ready.</div>`;
    return;
  }
  const legal = S().legal(viewer as string);
  const discarding = legal.some((a) => a.type === 'discard');
  const hand = ship.hand;
  const placed = SLOT_KEYS.filter((k) => ship.program[k] !== undefined).length;
  el.innerHTML = `<div class="hand-info">${discarding ? `<b>Hand over the limit: tap cards to discard</b> (${hand.length})` : `Hand ${hand.length} · placed ${placed} · tap a card, then a glowing slot · tap a placed card to take it back`}</div>`;
  const W = el.clientWidth || 600, H = el.clientHeight || 200;
  const n = hand.length;
  const cardH = Math.min(H * 0.9, (W / Math.max(n, 1)) * 3);
  const cw = cardH * (1064 / 1500);
  el.style.setProperty('--cw', `${cw}px`);
  const step = n > 1 ? Math.min(cw * 0.98, (W - cw) / (n - 1)) : 0;
  const x0 = (W - (cw + step * (n - 1))) / 2;
  hand.forEach((id, i) => {
    const c = h(`<button class="card ${selectedCard === id ? 'sel' : ''}" style="background-image:url(${cardArt(id)}),url(art/cards/back.webp)" data-card="${id}" aria-label="Card ${cards.get(id)?.initiative}"></button>`);
    c.title = `${cards.get(id)?.initiative}: ${describeBand(id, 'sail')} / ${describeBand(id, 'steer')} / ${describeBand(id, 'action')}`;
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    c.style.left = `${x0 + i * step}px`;
    c.style.transform = `rotate(${t * Math.min(12, n * 1.5)}deg) translateY(${t * t * 16}px)`;
    c.style.zIndex = String(n - i);
    c.onclick = () => {
      if (discarding) {
        act({ type: 'discard', ship: ship.id, card: id });
      } else selectedCard = selectedCard === id ? null : id;
      renderProgramming();
    };
    el.appendChild(c);
  });
}

// ---------------- panels ----------------
function renderPanels(v: GameView | null) {
  const view = v ?? S().view(seats()[0]!.player);
  const s = S().state;
  const phase = s.phase === 'programming' ? `<b>Programming</b> · ${s.ready.length} of ${seats().length} ready` : s.phase === 'over' ? '<b>Game over</b>' : `<b>Resolution</b> · Part ${PART_NAME[s.part] ?? ''}`;
  $('#status').innerHTML = `Turn ${s.turn}${view.turnLimit ? ` of ${view.turnLimit}` : ''} · ${phase}`;
  const target = s.setup.seats.length >= 7 ? 2 : 3;
  const rivals = $('#rivals');
  rivals.innerHTML = view.turnLimit
    ? `<h3>Solo Challenge <small>treasure home in ${view.turnLimit} turns${bestScore() === undefined ? '' : ` · best ${bestScore()}`}</small></h3>`
    : `<h3>Players <small>first to ${target} treasure wins</small></h3>`;
  for (const seat of seats()) {
    const ship = view.ships[`${seat.player}-ship`]!;
    const healthy = ship.crew.filter((c) => c.state === 'healthy').length;
    const row = h(`<button class="score-row ${seat.player === viewer ? 'me' : ''}" style="--c:${colours[seat.player]}">
      <span class="sw"></span><span><b>${esc(seat.name)}</b>${ship.carrying ? ' · 💎' : ''}${ship.status === 'sunk' ? ' · sunk' : ''}${ship.refitting ? ' · refitting' : ''}${ship.stuck ? ' · stranded' : ''}</span>
      <span title="treasure scored">💎 ${view.scores[seat.team] ?? 0}</span><span title="healthy crew">👥 ${healthy}/${ship.crew.length}</span><span title="damaged slots">✕ ${ship.blocked.length}</span></button>`);
    row.onclick = () => table.focus(ship.pos);
    rivals.appendChild(row);
  }
  const w = view.weather;
  $('#weather').innerHTML = `<h3>Weather &amp; tide</h3>
    <div class="wx"><img src="${weatherArt(baseId(w.now))}" alt="${esc(weatherName(w.now))}"><div class="next">next<img src="${weatherArt(baseId(w.next))}" alt="${esc(weatherName(w.next))}"></div></div>
    <div class="wx-tide">Now: <b>${esc(weatherName(w.now))}</b> · Tide: <b>${TIDE_NAME[w.tide]}</b> <small>(${TIDES[w.space % 6]})</small></div>`;
  const crew = $('#crew');
  const ship = viewer ? myShip() : undefined;
  crew.hidden = !ship;
  if (ship) {
    crew.innerHTML = `<h3>Your crew <small>${ship.crew.length}/6</small></h3><div class="crew-row">${ship.crew
      .map((c) => `<span class="token ${c.state === 'wounded' ? 'wounded' : ''}" style="background-image:url(art/crew/${c.captain ? 'captain-mammoth' : 'pirate'}.webp)" title="${c.captain ? 'Captain' : 'Pirate'}${c.state === 'wounded' ? ' (wounded)' : ''}"></span>`)
      .join('')}</div>`;
  }
}

const baseId = (id: string) => id.replace(/-\d+$/, '');
function weatherName(id: string): string {
  const card = S().setup.weatherCards.find((c) => c.id === id);
  if (!card) return id;
  return card.direction === undefined ? STRENGTH_NAME[card.strength]! : `${STRENGTH_NAME[card.strength]} ${DIRECTION_NAMES[card.direction]}`;
}

// ---------------- table ----------------
function syncShown() {
  shown = {};
  for (const ship of Object.values(S().state.ships))
    shown[ship.id] = { hex: ship.pos, heading: ship.heading, sail: ship.sail, afloat: ship.status === 'afloat' };
}

function renderTable() {
  table.setShips(
    Object.entries(shown)
      .filter(([, x]) => x.afloat)
      .map(([id, x]) => ({ id, name: shipName(id), colour: colours[S().state.ships[id]!.player]!, hex: x.hex, heading: x.heading, sail: x.sail, selected: false })),
  );
  const s = S().state;
  const marks = [
    ...s.treasures.map((k) => ({ text: '💎', pos: table.hexToWorld(parseHexKey(k), 0.3), cls: 'tok' })),
    ...s.wrecks.map((k) => ({ text: '⚓︎☠', pos: table.hexToWorld(parseHexKey(k), 0.3), cls: 'tok' })),
  ];
  table.setLabels('tokens', marks);
}

// ---------------- playback ----------------
function caption(e: GameEvent): string | null {
  const n = (id: string) => esc(shipName(id));
  switch (e.type) {
    case 'TurnStarted': return `Turn ${e.turn}`;
    case 'PartStarted': return `<b>Part ${PART_NAME[e.part]}</b>: cards revealed`;
    case 'SailSet': return `${n(e.ship)}: ${esc(e.order)}`;
    case 'ShipMoved': return e.cause === 'sail' || e.cause === 'row' ? null : `${n(e.ship)} ${e.cause === 'push' ? 'is pushed' : e.cause === 'current' ? 'is carried by the current' : 'drifts'}`;
    case 'ShipStopped': return `${n(e.ship)} stops (${e.by})`;
    case 'ShipRammed': return `💥 ${n(e.by)} rams ${n(e.ship)}`;
    case 'ShipTurned': return e.cause === 'steer' ? null : `${n(e.ship)} is turned by the ${e.cause}`;
    case 'Teleported': return `🌀 ${n(e.ship)} is swallowed by the whirlpool`;
    case 'WentThroughCave': return `${n(e.ship)} goes through cave ${esc(e.letter)}`;
    case 'DamageRolled': return `🎲 ${n(e.ship)}: ${e.source} damage ${e.dd}DD → rolled ${e.rolls.join(', ')}: ${e.shipDamage} ship, ${e.crewDamage} crew`;
    case 'SlotBlocked': return `${n(e.ship)}: slot ${e.slot} damaged`;
    case 'CardLost': return `${n(e.ship)} loses card ${esc(e.card)}`;
    case 'CrewWounded': return `${n(e.ship)}: a crew member is wounded`;
    case 'CrewKilled': return `${n(e.ship)}: a crew member is killed`;
    case 'ShipSank': return `☠ ${n(e.ship)} sinks (${e.reason})`;
    case 'WreckPlaced': return 'A wreck is left behind';
    case 'TreasureSpawned': return `💎 Treasure appears at spawn point ${esc(e.point)}`;
    case 'TreasurePickedUp': return `💎 ${n(e.ship)} picks up treasure`;
    case 'TreasureKnockedLoose': return `💎 ${n(e.by)} knocks ${n(e.ship)}'s treasure loose`;
    case 'TreasureDropped': return `💎 ${n(e.ship)} drops her treasure`;
    case 'TreasureScored': return `🏆 ${n(e.ship)} brings treasure home: ${esc(teamName(e.team))} has ${e.score}`;
    case 'GameWon': return `🏆 ${esc(teamName(e.team))} wins!`;
    case 'WreckSearched': return `${n(e.ship)} searches a wreck`;
    case 'CrewGained': return `${n(e.ship)} gains a crew member${e.replaced ? ' (swapped)' : ''}`;
    case 'ShipRefitted': return `⚓ ${n(e.ship)} refits${e.repair ? ' · repairs' : ''}${e.heal ? ' · heals' : ''}${e.recruit ? ` · recruits ${e.recruit}` : ''}`;
    case 'WeatherAdvanced': return `Weather: ${esc(weatherName(e.now))}${e.newFronts ? ' (new weather front)' : ''}`;
    case 'TideChanged': return `Tide: ${TIDE_NAME[e.tide]}`;
    case 'ShipStranded': return `${n(e.ship)} is stranded`;
    case 'ShipFreed': return `${n(e.ship)} floats free`;
    case 'ShipReturned': return `${n(e.ship)} returns to play`;
    case 'CannonFired': return `💥 ${n(e.ship)} fires${e.targets.length ? ` at ${e.targets.map(n).join(', ')}` : ': no target in range'}${e.spared.length ? ` (holds fire on ${e.spared.map(n).join(', ')})` : ''}`;
    case 'PortGunsFired': return `💥 ${esc(teamName(e.team))}'s port guns fire at ${e.targets.map(n).join(', ')}`;
    case 'SlotRepaired': return `🔧 ${n(e.ship)} repairs slot ${e.slot}`;
    case 'CrewHealed': return `✚ ${n(e.ship)} heals a crew member`;
    case 'CardsDrawn': return null;
    case 'CardsReturned': return null;
    case 'UpkeepStarted': return '<b>Upkeep</b>';
    case 'SoloFinished': return `🏁 Solo Challenge over: ${e.score} treasure in ${e.turns} turns`;
    case 'PlayerReady': return null;
    case 'DecisionRequested': return null;
  }
}

function showLog() {
  const pb = $('#playback');
  pb.hidden = false;
  pb.innerHTML = `<div class="log">${log.slice(-6).map((l) => `<div>${l}</div>`).join('')}</div><div class="ctl"><button class="btn" id="speed">${fast ? 'Normal speed' : 'Faster'}</button></div>`;
  pb.querySelector<HTMLElement>('#speed')!.onclick = () => ((fast = !fast), showLog());
}
let fast = false;

async function play(events: readonly GameEvent[]) {
  busy = true;
  table.resetView();
  $('#app').classList.remove('programming');
  $('#dock').hidden = true;
  const ms = () => (fast ? 150 : 550);
  for (const e of events) {
    const text = caption(e);
    if (text) {
      log.push(text);
      showLog();
    }
    const x = 'ship' in e && typeof e.ship === 'string' ? shown[e.ship] : undefined;
    switch (e.type) {
      case 'ShipMoved':
        if (x) {
          x.hex = e.to;
          await table.animateShip(e.ship, [e.to], x.heading, x.sail, ms());
        }
        break;
      case 'ShipTurned':
        if (x) {
          x.heading = e.to;
          await table.animateShip(e.ship, [], e.to, x.sail, ms());
        }
        break;
      case 'SailSet':
        if (x) x.sail = e.sail;
        renderTable();
        break;
      case 'Teleported':
      case 'WentThroughCave':
        if (x) {
          x.hex = e.to;
          renderTable();
          await sleep(ms());
        }
        break;
      case 'ShipSank':
        if (x) x.afloat = false;
        renderTable();
        await sleep(ms() * 2);
        break;
      case 'ShipReturned':
        if (x) Object.assign(x, { hex: e.at, heading: e.heading, afloat: true, sail: 'none' });
        renderTable();
        await sleep(ms());
        break;
      case 'CannonFired':
        for (const t of e.targets) table.broadside(e.ship, t);
        await sleep(ms() * 2);
        break;
      case 'PartStarted':
      case 'UpkeepStarted':
      case 'SoloFinished':
      case 'DamageRolled':
      case 'TreasureScored':
      case 'GameWon':
        await sleep(ms() * 2);
        break;
      default:
        if (text) await sleep(ms());
    }
  }
  syncShown();
  busy = false;
  next();
}

// ---------------- decisions ----------------
const DECISION_TITLE: Record<string, string> = {
  placeShipDamage: 'Choose a slot to take ship damage',
  placeCrewDamage: 'Choose which crew member takes damage',
  holdFire: 'A friendly ship is in your broadside: fire or hold?',
  repairSlot: 'Choose a damaged slot to repair',
  healCrew: 'Choose a crew member to heal',
  knockLoose: 'You rammed a treasure ship: knock the treasure loose to a hex, or deal damage?',
  returnHex: 'Your ship returns: choose the hex',
  returnHeading: 'Your ship returns: choose the heading',
  refit: 'In port: choose your refit',
  crewSwap: 'The wreck has a crew member but your crew is full: swap one?',
};

function crewLabel(id: string): string {
  const ship = Object.values(S().state.ships).find((s) => s.crew.some((c) => c.id === id));
  const c = ship?.crew.find((m) => m.id === id);
  if (!c) return id;
  const n = /-(\d+)$/.exec(id)?.[1];
  return `${c.captain ? 'Captain' : `Pirate${n ? ` ${n}` : ''}`}${c.state === 'wounded' ? ' (wounded)' : ''}`;
}

function optionLabel(kind: string, o: unknown, i: number): string {
  switch (kind) {
    case 'placeShipDamage': {
      const s = o as Slot;
      return `Part ${PART_NAME[s.part]} · ${ROW_NAME[s.row]}`;
    }
    case 'placeCrewDamage': {
      const c = o as { wound?: string; kill?: string };
      return c.wound ? `Wound the ${crewLabel(c.wound)}` : `Kill the ${crewLabel(c.kill as string)}`;
    }
    case 'holdFire': {
      const [what, id] = (o as string).split(':') as [string, string];
      return `${what === 'fire' ? 'Fire on' : 'Hold fire on'} ${shipName(id)}`;
    }
    case 'repairSlot': return `Slot ${o as string}`;
    case 'healCrew': return `Heal the ${crewLabel(o as string)}`;
    case 'knockLoose': return o === 'damage' ? 'Deal ram damage instead' : `Knock it to hex ${i}`;
    case 'returnHex': return `Hex ${i + 1}`;
    case 'returnHeading': return `Face ${DIRECTION_NAMES[o as Direction]}`;
    case 'refit': {
      const r = o as RefitChoice;
      const parts = [r.repair && 'repair all', r.heal && 'heal all', r.recruit && `recruit ${r.recruit}`].filter(Boolean);
      return parts.length ? `Refit: ${parts.join(', ')} (miss next turn)` : 'No refit: sail on';
    }
    case 'crewSwap': return o === 'keep' ? 'Keep my crew' : `Swap out the ${crewLabel(o as string)}`;
    default: return JSON.stringify(o);
  }
}

function decisionScreen() {
  const s = S().state;
  const d = s.pending!;
  const player = d.player;
  const v = S().view(player);
  const opts = (v.decision?.options ?? []) as unknown[];
  // Hex options get numbered labels on the table.
  const hexes = d.kind === 'returnHex' ? opts.map((o, i) => [o as Hex, i + 1] as const) : d.kind === 'knockLoose' ? opts.flatMap((o, i) => (o === 'damage' ? [] : [[o as Hex, i] as const])) : [];
  table.setLabels('options', hexes.map(([x, n]) => ({ text: String(n), pos: table.hexToWorld(x, 0.4), cls: 'opt-label' })));
  if (hexes[0]) table.focus(hexes[0][0]);
  const box = screen(`<h2 style="color:${colours[player]}">${esc(playerName(player))} decides</h2>
    <p>${esc(DECISION_TITLE[d.kind] ?? d.kind)}${hexes.length ? ' (numbered on the map: close this box to look, the numbers stay)' : ''}</p>
    <div class="decision"></div>`);
  const list = box.querySelector('.decision')!;
  opts.forEach((o, i) => {
    const b = h(`<button class="btn ${i === v.decision?.defaultIndex ? 'default' : ''}">${esc(optionLabel(d.kind, o, i))}</button>`);
    b.onclick = () => {
      if (busy) return;
      table.setLabels('options', []);
      hideScreen();
      void play(act({ type: 'answer', choice: i }, player));
    };
    list.appendChild(b);
  });
  if (hexes.length) {
    const peek = h('<button class="btn">Look at the map</button>');
    peek.onclick = () => {
      hideScreen();
      toast('Tap “Back to the choice” when ready');
      const back = h('<button class="btn primary" style="position:fixed;bottom:2em;left:50%;translate:-50%;z-index:45">Back to the choice</button>');
      back.onclick = () => (back.remove(), ($('#screen').hidden = false));
      document.body.appendChild(back);
    };
    list.appendChild(peek);
  }
}

function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), 2500);
}

// ---------------- end ----------------
const BEST_KEY = 'msb-solo-best-v1';
function bestScore(): number | undefined {
  const raw = localStorage.getItem(BEST_KEY);
  return raw === null ? undefined : Number(raw);
}

function endScreen() {
  const s = S().state;
  const v = S().view(seats()[0]!.player);
  const rows = Object.values(s.teams)
    .sort((a, b) => b.score - a.score)
    .map((t) => `<div class="score-row" style="--c:${colours[t.players[0]!]}"><span class="sw"></span><b>${esc(teamName(t.id))}</b><span>💎 ${t.score}</span><span></span><span></span></div>`)
    .join('');
  let title = `🏆 ${esc(v.winner ? teamName(v.winner) : '')} wins!`;
  let note = `After ${s.turn} turns.`;
  if (v.turnLimit) {
    const score = v.scores[seats()[0]!.team] ?? 0;
    const best = bestScore();
    title = `🏁 Solo Challenge: ${score} treasure`;
    note = `In ${s.turn} turns. ${best === undefined || score > best ? 'A new best score!' : `Your best: ${best}.`}`;
    if (best === undefined || score > best) localStorage.setItem(BEST_KEY, String(score));
  }
  const box = screen(`<h1>${title}</h1><p>${note}</p>${v.turnLimit ? '' : rows}
    <div class="row" style="margin-top:1em"><button class="btn primary big" id="again">New game</button></div>`);
  box.querySelector<HTMLElement>('#again')!.onclick = () => (Session.clear(), startScreen());
}

// ---------------- menu & view controls ----------------
$('#menu-btn').onclick = () => {
  const m = $('#menu');
  m.innerHTML = `<h2>Mammoth Sea Battles <button class="btn sq" id="menu-x" aria-label="Close menu">✕</button></h2>
    <p>Hot-seat prototype on the real rules engine. The game saves after every move: reload the page to resume.</p>
    <div class="grid"><button class="btn" id="m-new">Abandon and start a new game</button></div>
    <h4>Map key</h4><p>Arrows: currents (one, two or three arrows for strength). Rings: rotors. Spiral with a number: whirlpool. Letters: sea caves. Pink zigzag: wall reef. Numbered discs: treasure spawn points. 💎 loose treasure, ⚓︎☠ wreck.</p>`;
  m.querySelector<HTMLElement>('#menu-x')!.onclick = () => (m.hidden = true);
  m.querySelector<HTMLElement>('#m-new')!.onclick = () => {
    if (!confirm('Abandon this game?')) return;
    m.hidden = true;
    Session.clear();
    $('#dock').hidden = true;
    startScreen();
  };
  m.hidden = false;
};
document.querySelectorAll<HTMLElement>('#viewctl [data-v]').forEach((b) => {
  b.onclick = () => {
    const v = b.dataset.v;
    if (v === 'in') table.zoom(0.75);
    else if (v === 'out') table.zoom(1.33);
    else if (v === 'home') table.resetView();
    else {
      const ship = myShip();
      if (ship) table.focus(ship.pos);
    }
  };
});
new ResizeObserver(() => viewer && session && renderHand()).observe($('#hand'));

// Expose for automated checks (screenshot script).
(window as unknown as { msb: unknown }).msb = { get session() { return session; }, get busy() { return busy; }, HIDDEN };
$('#dock').hidden = true;
startScreen();
