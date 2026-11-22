/**
 * Mammoth Sea Battles: two-to-four-player hot-seat prototype (implementation plan P8) on the real rules engine.
 * One device is passed round the table: a hand-over screen hides each player's hand from the others.
 * The UI only reads views and events and sends actions through the Session (engineering design §11).
 */
import './style.css';
import './play.css';
import { DIRECTION_NAMES, hexEquals, hexKey, neighbor, type Direction, type Hex } from '@msb/hex';
import {
  DEFAULT_CONFIG,
  currentWeather,
  driftsInPart,
  HIDDEN,
  isLand,
  parseHexKey,
  SLOT_KEYS,
  type Action,
  type CommandCard,
  type GameEvent,
  type GameView,
  type RefitChoice,
  type SailLevel,
  type TreasureKind,
  type Slot,
  type SlotRow,
} from '@msb/msb-rules';
import { prototypeSetup } from '@msb/msb-data';
import type { AiLevel, Personality } from '@msb/msb-ai';
import { askAi } from './ai';
import { ACTION_LABEL, SAIL_LABEL, STEER_LABEL, TIDES, cardArt, weatherArt } from './data/content';
import { PLAYER_COLOURS } from './game';
import { drawBoard } from './board-art';
import { Session } from './session';
import { POINT_COLOUR, POINT_NAME, sailRose } from './sail-rose';
import { TREASURE_NAME } from './treasure-models';
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
let shown: Record<string, { hex: Hex; heading: Direction; sail: SailLevel; afloat: boolean; cargo?: TreasureKind }> = {};
/** Treasure as shown on the table: loose pieces by hex, and each team's pieces brought home (they lag the state during play-back). */
let shownLoose: Record<string, TreasureKind> = {};
let shownHolds: Record<string, TreasureKind[]> = {};
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
    const oldWho = [...names.querySelectorAll<HTMLSelectElement>('select.who')].map((s) => s.value);
    const oldStyle = [...names.querySelectorAll<HTMLSelectElement>('select.style')].map((s) => s.value);
    names.innerHTML = '';
    for (let i = 0; i < n; i++)
      names.appendChild(
        h(`<div class="row"><span class="sw" style="--c:${PLAYER_COLOURS[i]}"></span><input type="text" value="${esc(old[i] ?? `Player ${i + 1}`)}" aria-label="Player ${i + 1} name">
          <select class="btn who" aria-label="Player ${i + 1} is played by">${WHO.map(([v, label]) => `<option value="${v}" ${oldWho[i] === v ? 'selected' : ''}>${label}</option>`).join('')}</select>
          <select class="btn style" aria-label="Player ${i + 1} computer personality" ${oldWho[i] && oldWho[i] !== 'human' ? '' : 'hidden'}>${STYLE_NAMES.map(([v, label]) => `<option value="${v}" ${oldStyle[i] === v ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`),
      );
  };
  draw();
  // The personality choice only matters for a computer player.
  names.onchange = (e) => {
    const sel = e.target as HTMLSelectElement;
    if (sel.classList.contains('who')) (sel.nextElementSibling as HTMLSelectElement).hidden = sel.value === 'human';
  };
  box.querySelector<HTMLElement>('#add')!.onclick = () => ((n = Math.min(4, n + 1)), draw());
  box.querySelector<HTMLElement>('#del')!.onclick = () => ((n = Math.max(1, n - 1)), draw());
  box.querySelector<HTMLElement>('#go')!.onclick = () => {
    const players = [...names.querySelectorAll('input')].map((i, k) => ({ name: i.value.trim() || `Player ${k + 1}` }));
    const safe = box.querySelector<HTMLInputElement>('#safe')!.checked;
    Session.clear();
    const who = [...names.querySelectorAll<HTMLSelectElement>('select.who')].map((sel) => sel.value);
    const style = [...names.querySelectorAll<HTMLSelectElement>('select.style')].map((sel) => sel.value as Personality);
    const ai = who.flatMap((w, k) => (w === 'human' ? [] : [`P${k + 1}`]));
    const levels = Object.fromEntries(who.flatMap((w, k) => (w === 'human' ? [] : [[`P${k + 1}`, w as AiLevel]])));
    const styles = Object.fromEntries(who.flatMap((w, k) => (w === 'human' ? [] : [[`P${k + 1}`, style[k] as Personality]])));
    void begin(new Session(prototypeSetup(players, (Date.now() % 1_000_000_007) >>> 0), safe, [], ai, levels, styles));
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
  if (s.phase === 'resolving' && s.pending) {
    // The computer answers its own questions.
    if (isAi(s.pending.player)) return void computerAct('answer', s.pending.player);
    return decisionScreen();
  }
  // The computer programs first (it can't see anyone's cards, so the order doesn't matter).
  const robot = seats().find((seat) => !s.ready.includes(seat.player) && isAi(seat.player));
  if (robot) return void computerAct('program', robot.player);
  const waiting = seats().find((seat) => !s.ready.includes(seat.player));
  if (waiting) handOver(waiting.player);
}

const isAi = (player: string) => S().ai.includes(player);
const levelOf = (player: string): AiLevel => S().levels[player] ?? 'normal';
const styleOf = (player: string): Personality => S().styles[player] ?? 'balanced';
const STYLE_NAMES: readonly [Personality, string][] = [['balanced', 'Balanced'], ['hunter', 'Treasure hunter'], ['raider', 'Raider'], ['cautious', 'Cautious']];
const styleLabel = (player: string) => (STYLE_NAMES.find(([v]) => v === styleOf(player)) as [Personality, string])[1].toLowerCase();
const WHO: readonly [string, string][] = [['human', 'Human'], ['easy', 'Computer: Easy'], ['normal', 'Computer: Normal'], ['hard', 'Computer: Hard']];

/** Let the computer take its actions (after a moment, so the screen can show it thinking), then play out what they caused. */
async function computerAct(kind: 'program' | 'answer', player: string) {
  busy = true;
  banner(`🤖 ${esc(playerName(player))} is thinking…`);
  // The thinking happens in a Web Worker (src/ai-worker.ts), so the table keeps moving meanwhile.
  const [actions] = await Promise.all([askAi(kind, S().state, player, S().config, levelOf(player), styleOf(player)), sleep(250)]);
  const events: GameEvent[] = [];
  for (const action of actions) events.push(...act(action, player));
  $('#banner').hidden = true;
  busy = false;
  if (events.some((e) => e.type !== 'PlayerReady')) return void play(events);
  next();
}

function handOver(player: string) {
  // Only one human at the table: no one to hide the cards from.
  if (seats().filter((seat) => !isAi(seat.player)).length === 1) return showHand(player);
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
  $('#whose').innerHTML = `<span class="sw" style="--c:${colours[viewer]}"></span>${esc(playerName(viewer))}’s ship: program your orders`;
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
    for (const slot of SLOT_KEYS) if (ship.program[slot] !== undefined) takeBack(ship.id, slot);
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
        if (programmable)
          dragSource(
            b,
            // Tap: with a card selected, it replaces this one; otherwise this one goes back to the hand.
            () => {
              if (selectedCard) placeCard(ship.id, key, selectedCard);
              else takeBack(ship.id, key);
              selectedCard = null;
              renderProgramming();
            },
            // Dragged to another slot: the two swap (or it just moves, if that slot was empty).
            (slot) => {
              const other = myShip()?.program[slot];
              act({ type: 'remove', ship: ship.id, slot: key });
              if (other) act({ type: 'remove', ship: ship.id, slot });
              act({ type: 'place', ship: ship.id, slot, card: id });
              if (other) act({ type: 'place', ship: ship.id, slot: key, card: other });
            },
            () => takeBack(ship.id, key),
          );
      } else if (programmable) {
        b.textContent = selectedCard ? 'tap to place' : row === 'sail' ? 'No Sail' : '';
        if (selectedCard) b.classList.add('target');
        b.onclick = () => {
          if (!selectedCard) return;
          // Tapped into place: the card flies from the hand to the slot (a dragged card is already there).
          const from = document.querySelector(`#hand .card[data-card="${selectedCard}"]`)?.getBoundingClientRect();
          if (from) flights.push({ card: selectedCard, from, to: `#shipboard .slot[data-slot="${key}"]` });
          placeCard(ship.id, key, selectedCard);
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
      // Wind drift happens only in some Parts, by wind strength (§5.2): the others are ghosted out.
      const w = currentWeather(S().state.weather, S().setup.weatherCards);
      const arrow = ['↑', '↗', '↘', '↓', '↙', '↖'][w.direction]!;
      const when: Record<string, string> = { gale: 'Gale: every Part', strong: 'Strong: Parts II and III', firm: 'Firm: Part III only' };
      el.appendChild(
        h(`<div class="sb-strip drift">${PARTS.map((p) =>
          S().config.windDrift && driftsInPart(w.strength, p)
            ? `<span class="on" title="Wind drift this Part (${when[w.strength]}): 1 hex ${DIRECTION_NAMES[w.direction]}">Drift ${arrow}</span>`
            : `<span class="off" title="${S().config.windDrift ? 'No wind drift this Part with this weather' : 'No wind drift: the rule is off for now (rules v0.152)'}">no drift</span>`,
        ).join('')}</div>`),
      );
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
  el.innerHTML = `<div class="hand-info">${discarding ? `<b>Hand over the limit: tap cards to discard</b> (${hand.length})` : `Hand ${hand.length} · placed ${placed} · drag a card onto a slot (or tap the card, then the slot); a card already there comes back · tap a placed card to take it back, or drag it to another slot to swap`}</div>`;
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
    const tap = () => {
      if (discarding) {
        act({ type: 'discard', ship: ship.id, card: id });
      } else selectedCard = selectedCard === id ? null : id;
      renderProgramming();
    };
    dragSource(c, tap, discarding ? null : (slot) => placeCard(ship.id, slot, id));
    el.appendChild(c);
  });
  swoosh();
}

// ---------------- placing and taking back ----------------
/**
 * Cards on the move, for the swoosh after the next redraw: where each left from, and the element it lands on (a hand card going
 * back, or a slot when tapped into place).
 */
let flights: { card: string; from: DOMRect; to: string }[] = [];
/** How long a card takes to fly between the hand and the ship board (ms): slow enough to follow by eye. */
const SWOOSH_MS = 500;

function slotRect(slot: string): DOMRect | undefined {
  return document.querySelector(`#shipboard .slot[data-slot="${slot}"]`)?.getBoundingClientRect();
}

/** Take a card off the ship board, back into the hand (it swooshes back). */
function takeBack(shipId: string, slot: string) {
  const card = myShip()?.program[slot];
  const from = slotRect(slot);
  act({ type: 'remove', ship: shipId, slot });
  if (card && from) flights.push({ card, from, to: `#hand .card[data-card="${card}"]` });
}

/** Put a card in a slot; a card already there goes back to the hand. */
function placeCard(shipId: string, slot: string, card: string) {
  if (myShip()?.program[slot] !== undefined) takeBack(shipId, slot);
  act({ type: 'place', ship: shipId, slot, card });
}

/** Fly each moving card from where it was to where it is now (slot to hand, or hand to slot). */
function swoosh() {
  const moving = flights;
  flights = [];
  for (const { card, from, to: where } of moving) {
    const target = document.querySelector<HTMLElement>(where);
    if (!target) continue;
    const to = target.getBoundingClientRect();
    const fly = h(`<div class="swoosh" style="background-image:url(${cardArt(card)}),url(art/cards/back.webp)"></div>`);
    Object.assign(fly.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
    document.body.appendChild(fly);
    target.style.visibility = 'hidden';
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = Math.max(0.2, from.width / to.width);
    fly
      .animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(-8deg)`, opacity: 0.6 },
          { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 40}px) scale(${(1 + scale) / 2}) rotate(6deg)`, opacity: 1, offset: 0.55 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: SWOOSH_MS, easing: 'cubic-bezier(.2,.8,.3,1)' },
      )
      .finished.then(() => {
        fly.remove();
        target.style.visibility = '';
      });
  }
}

// ---------------- drag and drop ----------------
/**
 * Make an element draggable onto the ship board's free slots. A short press without moving is a tap (the old tap-then-slot way
 * still works). `drop` gets the slot it lands on; `toHand`, if given, runs when it's dropped back on the hand.
 */
function dragSource(el: HTMLElement, tap: () => void, drop: ((slot: string) => void) | null, toHand?: () => void) {
  el.onpointerdown = (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const start = { x: ev.clientX, y: ev.clientY };
    let ghost: HTMLElement | null = null;
    let over: HTMLElement | null = null;
    const target = (x: number, y: number) => {
      const under = document.elementsFromPoint(x, y);
      const slot = under.find((e) => e instanceof HTMLElement && e !== el && e.matches('#shipboard .slot:not(.damaged)')) as HTMLElement | undefined;
      if (slot) return slot;
      return toHand && under.some((e) => e.id === 'hand') ? $('#hand') : null;
    };
    const move = (e: PointerEvent) => {
      if (!ghost) {
        if (!drop || Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
        const r = el.getBoundingClientRect();
        ghost = el.cloneNode(true) as HTMLElement;
        ghost.classList.add('drag-ghost');
        Object.assign(ghost.style, { left: '0', top: '0', width: `${r.width}px`, height: `${r.height}px`, transform: 'none', rotate: '0deg' });
        document.body.appendChild(ghost);
        el.classList.add('dragging');
        document.querySelectorAll('#shipboard .slot:not(.damaged)').forEach((s) => s !== el && s.classList.add('target'));
      }
      ghost.style.translate = `${e.clientX - ghost.offsetWidth / 2}px ${e.clientY - ghost.offsetHeight / 2}px`;
      const t = target(e.clientX, e.clientY);
      if (t !== over) {
        over?.classList.remove('hover');
        over = t;
        over?.classList.add('hover');
      }
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!ghost) return tap();
      ghost.remove();
      el.classList.remove('dragging');
      const t = e.type === 'pointerup' ? target(e.clientX, e.clientY) : null;
      selectedCard = null;
      if (t?.dataset.slot) drop?.(t.dataset.slot);
      else if (t && toHand) toHand();
      renderProgramming();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
}

// ---------------- panels ----------------
function renderPanels(v: GameView | null) {
  const view = v ?? S().view(seats()[0]!.player);
  const s = S().state;
  const phase = s.phase === 'programming' ? `<b>Programming</b> · ${s.ready.length} of ${seats().length} ready` : s.phase === 'over' ? '<b>Game over</b>' : `<b>Resolution</b> · Part ${PART_NAME[s.part] ?? ''}`;
  // Whose turn it is, so anyone walking up to the screen can tell (programming: the player whose cards are showing).
  const who = viewer && s.phase === 'programming' ? `<span class="who-chip" style="--c:${colours[viewer]}"><span class="sw"></span>${esc(playerName(viewer))}’s turn</span> · ` : '';
  $('#status').innerHTML = `${who}Turn ${s.turn}${view.turnLimit ? ` of ${view.turnLimit}` : ''} · ${phase}`;
  const target = s.setup.seats.length >= 7 ? 2 : 3;
  const rivals = $('#rivals');
  rivals.innerHTML = view.turnLimit
    ? `<h3>Solo Challenge <small>treasure home in ${view.turnLimit} turns${bestScore() === undefined ? '' : ` · best ${bestScore()}`}</small></h3>`
    : `<h3>Players <small>first to ${target} treasure wins</small></h3>`;
  for (const seat of seats()) {
    const ship = view.ships[`${seat.player}-ship`]!;
    const healthy = ship.crew.filter((c) => c.state === 'healthy').length;
    const row = h(`<button class="score-row ${seat.player === viewer ? 'me' : ''}" style="--c:${colours[seat.player]}">
      <span class="sw"></span><span><b>${isAi(seat.player) ? '🤖 ' : ''}${esc(seat.name)}</b>${isAi(seat.player) ? ` <small>(${levelOf(seat.player)}, ${styleLabel(seat.player)})</small>` : ''}${ship.carrying ? ' · 💎' : ''}${ship.status === 'sunk' ? ' · sunk' : ''}${ship.refitting ? ' · refitting' : ''}${ship.stuck ? ' · stranded' : ''}</span>
      <span title="treasure scored">💎 ${view.scores[seat.team] ?? 0}</span><span title="healthy crew">👥 ${healthy}/${ship.crew.length}</span><span title="damaged slots">✕ ${ship.blocked.length}</span></button>`);
    row.onclick = () => table.focus(ship.pos);
    rivals.appendChild(row);
  }
  const w = view.weather;
  const nowCard = S().setup.weatherCards.find((c) => c.id === w.now);
  const mine = viewer ? myShip() : undefined;
  $('#weather').innerHTML = `<h3>Weather &amp; tide <small>edges: Half / Full Sail move</small></h3>
    <div class="wx rose">${nowCard ? sailRose(nowCard, weatherArt(baseId(w.now)), mine?.status === 'afloat' ? mine.heading : undefined) : ''}<div class="next">next<img src="${weatherArt(baseId(w.next))}" alt="${esc(weatherName(w.next))}"></div></div>
    <div class="rose-key">${(['running', 'broadReach', 'closeHauled', 'windward'] as const).map((p) => `<span><i style="background:${POINT_COLOUR[p]}"></i>${POINT_NAME[p]}</span>`).join('')}${mine ? '<span><i class="me"></i>your heading</span>' : ''}</div>
    <div class="wx-tide">Now: <b>${esc(weatherName(w.now))}</b> · Tide: <b>${TIDE_NAME[w.tide]}</b> <small>(${TIDES[w.space % 6]})</small></div>`;
  const crew = $('#crew');
  const ship = viewer ? myShip() : undefined;
  crew.hidden = !ship;
  if (ship) {
    crew.innerHTML = `<h3>${esc(playerName(viewer as string))}’s crew <small>${ship.crew.length}/6</small></h3><div class="crew-row">${ship.crew
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

/** The build, for the game log (vite.config.ts: the commit when built by GitHub). */
declare const __BUILD__: string;

// ---------------- table ----------------
function syncShown() {
  shown = {};
  const s = S().state;
  for (const ship of Object.values(s.ships))
    shown[ship.id] = { hex: ship.pos, heading: ship.heading, sail: ship.sail, afloat: ship.status === 'afloat', ...(ship.cargo ? { cargo: ship.cargo } : {}) };
  shownLoose = Object.fromEntries(s.treasures.map((k) => [k, s.treasureKinds[k] ?? 'gold']));
  shownHolds = Object.fromEntries(Object.values(s.teams).map((t) => [t.id, [...(t.hold ?? [])]]));
}

/** Keep the shown treasure in step with an event as it plays. */
function moveTreasure(e: GameEvent) {
  switch (e.type) {
    case 'TreasureSpawned':
      shownLoose[e.at] = e.kind;
      break;
    case 'TreasurePickedUp':
      delete shownLoose[e.at];
      if (shown[e.ship]) shown[e.ship]!.cargo = e.kind;
      break;
    case 'TreasureKnockedLoose':
    case 'TreasureDropped':
      if (shown[e.ship]) delete shown[e.ship]!.cargo;
      shownLoose[hexKey(e.type === 'TreasureDropped' ? e.at : e.to)] = e.kind;
      break;
    case 'TreasureScored':
      if (shown[e.ship]) delete shown[e.ship]!.cargo;
      (shownHolds[e.team] ??= []).push(e.kind);
      break;
    default:
      return;
  }
  renderTable();
}

function renderTable() {
  table.setShips(
    Object.entries(shown)
      .filter(([, x]) => x.afloat)
      .map(([id, x]) => ({ id, name: shipName(id), colour: colours[S().state.ships[id]!.player]!, hex: x.hex, heading: x.heading, sail: x.sail, selected: false, ...(x.cargo ? { cargo: x.cargo } : {}) })),
  );
  const s = S().state;
  table.setTreasures(
    Object.entries(shownLoose).map(([k, kind]) => ({ hex: parseHexKey(k), kind })),
    Object.entries(shownHolds).map(([team, kinds]) => ({ hex: s.teams[team]!.homePort, kinds })),
  );
  const marks = [
    ...s.wrecks.map((k) => ({ text: '⚓︎☠', pos: table.hexToWorld(parseHexKey(k), 0.3), cls: 'tok' })),
  ];
  table.setLabels('tokens', marks);
}

// ---------------- playback ----------------
const MOVE_COLOUR = { sail: '#ffffff', row: '#ffe08a', push: '#ff9a3c', current: '#3fd4ff', drift: '#c9b8ff' } as const;
const MOVE_WORD = { sail: 'sails', row: 'rows', push: '💥 pushed', current: '🌊 current', drift: '🌬 drifts' } as const;
const ORDER_WORD: Record<string, string> = { none: 'No Sail', half: 'Half Sail', full: 'Full Sail', anchor: 'Anchor', rowAhead: 'Row Ahead', rowBack: 'Row Back' };
const STOP_WORD: Record<string, string> = { cliff: 'cliff', beach: 'land', wallReef: 'wall reef', ship: 'a ship in the way', anchored: 'an anchored ship', edge: 'map edge', stuck: 'stranded' };
const turnWord = (from: Direction, to: Direction) => {
  const d = (to - from + 6) % 6;
  return d === 3 ? '↻ 180°' : d < 3 ? `↻ ${d * 60}° starboard` : `↺ ${(6 - d) * 60}° port`;
};

/** Which step of the turn an event belongs to, for the step banner (rules §5.2). */
function stepOf(e: GameEvent): string | null {
  switch (e.type) {
    case 'SailSet':
      return 'Move';
    case 'ShipMoved':
      return e.cause === 'sail' || e.cause === 'row' || e.cause === 'push' ? null : e.cause === 'current' ? 'Currents' : 'Wind drift';
    case 'ShipTurned':
      return e.cause === 'steer' ? 'Steer' : e.cause === 'current' ? 'Currents' : null;
    case 'CannonFired':
    case 'SlotRepaired':
    case 'CrewHealed':
    case 'PortGunsFired':
      return 'Action';
    case 'UpkeepStarted':
      return 'Upkeep';
    default:
      return null;
  }
}

function caption(e: GameEvent): string | null {
  const n = (id: string) => esc(shipName(id));
  switch (e.type) {
    case 'TurnStarted': return `Turn ${e.turn}`;
    case 'PartStarted': return `<b>Part ${PART_NAME[e.part]}</b>: cards revealed`;
    case 'SailSet': return `${n(e.ship)}: ${ORDER_WORD[e.order] ?? esc(e.order)}`;
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
    case 'ShipSank': return e.reason === 'edge' ? `☠ ${n(e.ship)} goes off the edge of the map and sinks` : `☠ ${n(e.ship)} sinks (${e.reason})`;
    case 'WreckPlaced': return 'A wreck is left behind';
    case 'TreasureSpawned': return `💎 Treasure (${TREASURE_NAME[e.kind]}) appears at spawn point ${esc(e.point)}`;
    case 'TreasurePickedUp': return `💎 ${n(e.ship)} picks up ${TREASURE_NAME[e.kind]}`;
    case 'TreasureKnockedLoose': return `💎 ${n(e.by)} knocks ${n(e.ship)}'s ${TREASURE_NAME[e.kind].replace(/^an? /, '')} loose`;
    case 'TreasureDropped': return `💎 ${n(e.ship)} drops ${TREASURE_NAME[e.kind]}`;
    case 'TreasureScored': return `🏆 ${n(e.ship)} brings ${TREASURE_NAME[e.kind]} home: ${esc(teamName(e.team))} has ${e.score}`;
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
  let phase = '';
  let part = S().state.part;
  for (const e of events) {
    noteCause(e);
    moveTreasure(e);
    if (e.type === 'PartStarted') (part = e.part), (phase = '');
    // A step banner whenever the turn moves on to a new step (Move, Steer, Currents, Action, Wind drift).
    const step = stepOf(e);
    if (step && step !== phase) {
      phase = step;
      banner(`<b>${e.type === 'UpkeepStarted' ? '' : `Part ${PART_NAME[part] ?? ''} · `}${step}</b>`);
      await sleep(ms() * 1.6);
    }
    const text = caption(e);
    if (text) {
      log.push(text);
      showLog();
      banner(text);
    }
    const x = 'ship' in e && typeof e.ship === 'string' ? shown[e.ship] : undefined;
    switch (e.type) {
      case 'ShipMoved':
        // Through a sea cave: the WentThroughCave that follows shows it (she doesn't glide across the island).
        if (x && e.cave) break;
        if (x) {
          table.pulse(e.ship, MOVE_COLOUR[e.cause]);
          table.trail(e.from, e.to, MOVE_COLOUR[e.cause], ms() * 3);
          if (e.cause !== 'sail' && e.cause !== 'row') float(e.ship, MOVE_WORD[e.cause]);
          x.hex = e.to;
          await table.animateShip(e.ship, [e.to], x.heading, x.sail, ms() * 1.3);
        }
        break;
      case 'ShipTurned':
        if (x) {
          table.pulse(e.ship, e.cause === 'steer' ? '#ffe08a' : MOVE_COLOUR.current);
          float(e.ship, `${turnWord(x.heading, e.to)}${e.cause === 'steer' ? '' : ` (${e.cause})`}`);
          x.heading = e.to;
          await table.animateShip(e.ship, [], e.to, x.sail, ms() * 1.3);
        }
        break;
      case 'SailSet':
        if (x) {
          x.sail = e.sail;
          table.pulse(e.ship, '#ffffff', ms() * 1.5);
          float(e.ship, `⛵ ${ORDER_WORD[e.order] ?? e.order}`);
        }
        renderTable();
        await sleep(ms());
        break;
      case 'ShipStopped':
        table.pulse(e.ship, '#e0402a', ms() * 2);
        float(e.ship, `✋ stopped: ${STOP_WORD[e.by] ?? e.by}`);
        await sleep(ms() * 1.5);
        break;
      case 'Teleported':
      case 'WentThroughCave':
        if (x) {
          float(e.ship, e.type === 'Teleported' ? '🌀 whirlpool!' : '🕳 cave!');
          await table.teleport(e.ship, e.to, x.heading, ms() * 2.4);
          x.hex = e.to;
          renderTable();
          table.pulse(e.ship, MOVE_COLOUR.current, ms() * 2);
        }
        break;
      case 'ShipSank':
        // Off the map: show her sailing over the edge first, so it's clear why she sinks.
        if (x && e.off) {
          float(e.ship, '⚠ off the edge of the map!');
          table.pulse(e.ship, '#e0402a', ms() * 2);
          table.trail(x.hex, e.off, '#e0402a', ms() * 3);
          await table.animateShip(e.ship, [e.off], x.heading, x.sail, ms() * 1.6);
          await sleep(ms() * 0.5);
        }
        float(e.ship, '☠ sinks');
        await table.sink(e.ship, ms() * 2.5);
        if (x) x.afloat = false;
        renderTable();
        await sleep(ms());
        break;
      case 'ShipReturned':
        if (x) Object.assign(x, { hex: e.at, heading: e.heading, afloat: true, sail: 'none' });
        renderTable();
        table.pulse(e.ship, '#7cff9a', ms() * 2);
        float(e.ship, '⚓ back in play');
        await sleep(ms() * 1.5);
        break;
      case 'CannonFired': {
        const from = table.shipPosition(e.ship);
        await Promise.all(
          e.targets.map((t) => {
            table.broadside(e.ship, t);
            const to = table.shipPosition(t);
            return from && to ? table.arc(from, to, '#ff7a2f', ms() * 1.4, true) : Promise.resolve();
          }),
        );
        await sleep(ms());
        break;
      }
      case 'PortGunsFired': {
        const port = S().state.teams[e.team]?.homePort;
        await Promise.all(
          e.targets.map((t) => {
            const to = table.shipPosition(t);
            return port && to ? table.arc(table.hexToWorld(port), to, '#ff7a2f', ms() * 1.4, true) : Promise.resolve();
          }),
        );
        await sleep(ms());
        break;
      }
      case 'ShipRammed': {
        const a = table.shipPosition(e.by), b = table.shipPosition(e.ship);
        if (a && b) await table.arc(a, b, '#ffb03a', ms(), true);
        break;
      }
      case 'DamageRolled': {
        const at = table.shipPosition(e.ship) ?? (shown[e.ship] ? table.hexToWorld(shown[e.ship]!.hex) : undefined);
        if (at) await table.rollDice(at, e.rolls, fast ? 500 : 1100, fast ? 700 : 1600);
      }
        float(e.ship, `🎲 ${e.rolls.join(' ')} → ${e.shipDamage ? `−${e.shipDamage} slot${e.shipDamage > 1 ? 's' : ''}` : ''}${e.shipDamage && e.crewDamage ? ', ' : ''}${e.crewDamage ? `−${e.crewDamage} crew` : ''}${!e.shipDamage && !e.crewDamage ? 'miss' : ''}`);
        await sleep(ms() * 2);
        break;
      case 'TreasurePickedUp':
      case 'TreasureScored':
      case 'TreasureDropped':
        if ('ship' in e) float(e.ship, e.type === 'TreasureScored' ? '🏆 +1' : e.type === 'TreasurePickedUp' ? '💎 picked up' : '💎 dropped');
        renderTable();
        await sleep(ms() * 2);
        break;
      case 'PartStarted':
      case 'UpkeepStarted':
      case 'SoloFinished':
      case 'GameWon':
        await sleep(ms() * 2);
        break;
      default:
        if (text) await sleep(ms());
    }
  }
  checkBoard();
  syncShown();
  busy = false;
  $('#banner').hidden = true;
  next();
}

/**
 * After a turn plays out, check that the board shows each ship where the game has her (for the game log): what the playback
 * tracked from the events, and where the 3D model actually stands. Anything different is noted in the log.
 */
function checkBoard() {
  const s = S().state;
  if (s.phase === 'resolving') return; // mid-turn the state is still the turn's start (engineering design D1)
  for (const ship of Object.values(s.ships)) {
    const x = shown[ship.id];
    const afloat = ship.status === 'afloat';
    if (!x) continue;
    if (x.afloat !== afloat) S().note(`the board shows ${ship.id} ${x.afloat ? 'afloat' : 'sunk'}, but she is ${ship.status}`);
    if (!afloat) continue;
    if (hexKey(x.hex) !== hexKey(ship.pos)) S().note(`the board's playback put ${ship.id} at ${hexKey(x.hex)}, but she is at ${hexKey(ship.pos)}`);
    if (x.heading !== ship.heading) S().note(`the board's playback left ${ship.id} facing ${x.heading}, but she faces ${ship.heading}`);
    const model = table.shipPosition(ship.id);
    if (model && model.distanceTo(table.hexToWorld(ship.pos, model.y)) > 0.4) {
      S().note(`the 3D model of ${ship.id} stands off her hex ${hexKey(ship.pos)} (${model.distanceTo(table.hexToWorld(ship.pos, model.y)).toFixed(2)} away)`);
    }
  }
}

/** The game log as text: copy it, or save it as a file, to look into anything odd (Menu). */
async function exportLog(how: 'copy' | 'save') {
  const text = S().report(__BUILD__, new Date().toISOString(), navigator.userAgent);
  if (how === 'copy') {
    try {
      await navigator.clipboard.writeText(text);
      return `Copied the game log (${Math.round(text.length / 1024)} KB): paste it where you need it.`;
    } catch {
      how = 'save'; // no clipboard here (e.g. not allowed): save a file instead
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = `msb-game-log-turn${S().state.turn}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return `Saved the game log as ${a.download}.`;
}

/** The latest caption, large, at the top of the table while it plays out. */
function banner(text: string) {
  const b = $('#banner');
  b.innerHTML = text;
  b.hidden = false;
}

/** A short note floating above a ship (damage rolled, treasure). */
function float(ship: string, text: string) {
  const pos = table.shipPosition(ship) ?? (shown[ship] ? table.hexToWorld(shown[ship].hex) : undefined);
  if (!pos) return;
  const set = `float-${ship}-${Math.random()}`;
  table.setLabels(set, [{ text, pos: pos.setY(3.4), cls: 'float' }]);
  setTimeout(() => table.setLabels(set, []), fast ? 1200 : 2600);
}

// ---------------- decisions ----------------
const DECISION_TITLE: Record<string, string> = {
  placeShipDamage: 'Choose a slot to take ship damage',
  placeCrewDamage: 'Choose which crew member takes damage',
  holdFire: 'A ship is in your broadside: fire, or hold fire?',
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

/** What caused the next question, remembered from the events played just before it (so the panel can show it on the board). */
interface Cause {
  /** The ship the question is about (damaged, rammed, …). */
  ship?: string;
  /** Where the trouble came from: a ship, or a hex (port guns). */
  fromShip?: string;
  fromHex?: Hex;
  text: string;
  /** Damage still to place from this roll: [ship, crew]. */
  left?: [number, number];
}
let cause: Cause | null = null;
let lastShot: Record<string, string> = {}; // target ship → shooter ship
let lastPortGuns: Record<string, Hex> = {}; // target ship → port hex
let lastRam: { by: string; ship: string } | null = null;
/** Where a returning ship was told to come back (the answer to returnHex), for the heading question that follows. */
let returnAt: Record<string, Hex> = {};

const SOURCE_TEXT: Record<string, string> = {
  roughWater: 'Rough water', storm: 'Storm', cliff: 'Hit a cliff', wallReef: 'Hit a wall reef', ram: 'Rammed', gale: 'Full Sail in a Gale',
  cannon: 'Cannon fire', portGuns: 'Port guns',
};

/** Keep track of causes while events play (called for every event, before it's animated). */
function noteCause(e: GameEvent) {
  switch (e.type) {
    case 'PartStarted':
      lastShot = {};
      lastPortGuns = {};
      lastRam = null;
      break;
    case 'CannonFired':
      for (const t of e.targets) lastShot[t] = e.ship;
      break;
    case 'PortGunsFired': {
      const port = S().state.teams[e.team]?.homePort;
      if (port) for (const t of e.targets) lastPortGuns[t] = port;
      break;
    }
    case 'ShipRammed':
      lastRam = { by: e.by, ship: e.ship };
      break;
    case 'DamageRolled': {
      const from = e.source === 'cannon' ? lastShot[e.ship] : e.source === 'ram' && lastRam?.ship === e.ship ? lastRam.by : undefined;
      const who = from ? ` by ${shipName(from)}` : e.source === 'portGuns' ? '' : '';
      cause = {
        ship: e.ship,
        ...(from ? { fromShip: from } : {}),
        ...(e.source === 'portGuns' && lastPortGuns[e.ship] ? { fromHex: lastPortGuns[e.ship] } : {}),
        text: `${SOURCE_TEXT[e.source] ?? e.source}${who}: ${e.dd} damage ${e.dd === 1 ? 'die' : 'dice'}, rolled ${e.rolls.join(', ')} → <b>${e.shipDamage} ship damage, ${e.crewDamage} crew damage</b>`,
        left: [e.shipDamage, e.crewDamage],
      };
      break;
    }
    case 'SlotBlocked':
      if (cause?.left && cause.ship === e.ship) cause.left[0]--;
      break;
    case 'CrewWounded':
    case 'CrewKilled':
      if (cause?.left && cause.ship === e.ship) cause.left[1]--;
      break;
    case 'TurnStarted':
      returnAt = {};
      cause = null;
      break;
    case 'TreasureKnockedLoose':
      cause = null;
      break;
  }
}

/** The cause shown for a question that isn't about damage. */
function causeFor(kind: string, player: string, opts: unknown[]): Cause | null {
  const mine = `${player}-ship`;
  switch (kind) {
    case 'placeShipDamage':
    case 'placeCrewDamage':
      return cause;
    case 'holdFire': {
      const friend = (opts[0] as string).split(':')[1] as string;
      return { ship: friend, fromShip: mine, text: `Your broadside covers ${esc(shipName(friend))}` };
    }
    case 'knockLoose': {
      const victim = lastRam?.by === mine ? lastRam.ship : Object.entries(lastShot).find(([, by]) => by === mine)?.[0];
      return victim ? { ship: victim, fromShip: mine, text: `You hit ${esc(shipName(victim))}, who is carrying treasure` } : null;
    }
    case 'returnHex':
    case 'returnHeading':
      return { text: 'Your ship was sunk and comes back at Upkeep, fully repaired with 3 new crew' };
    case 'refit':
      return { ship: mine, text: 'Your ship is in her home port' };
    case 'crewSwap':
      return { ship: mine, text: 'Your ship searched a wreck and found a crew member' };
    case 'repairSlot':
    case 'healCrew':
      return { ship: mine, text: 'Your Action this Part' };
    default:
      return null;
  }
}

let panelLoop = 0;
/** The question, in a small panel on the board next to the ship it's about, with the cause drawn on the table. */
function decisionScreen() {
  const s = S().state;
  const d = s.pending!;
  const player = d.player;
  const v = S().view(player);
  const opts = (v.decision?.options ?? []) as unknown[];
  const why = causeFor(d.kind, player, opts);
  const about = why?.ship ?? `${player}-ship`;
  const ship = s.ships[about];
  // A returning ship isn't on the table yet: point at the hex she comes back to.
  const team = s.teams[s.players[player]?.team ?? ''];
  const backAt = d.kind === 'returnHeading' ? (returnAt[about] ?? team?.homePort) : undefined;
  hideScreen();
  $('#dock').hidden = true;
  // On the table: an arc from whatever caused it, a ring on the ship it's about, numbers on hex choices.
  table.clearArcs();
  const target = backAt ? table.hexToWorld(backAt) : (table.shipPosition(about) ?? (ship ? table.hexToWorld(ship.pos) : undefined));
  const source = why?.fromShip ? table.shipPosition(why.fromShip) : why?.fromHex ? table.hexToWorld(why.fromHex) : undefined;
  if (source && target) void table.arc(source, target, d.kind === 'holdFire' ? '#5fb4ff' : '#ff7a2f', 700);
  const hexes = d.kind === 'returnHex' ? opts.map((o, i) => [o as Hex, i + 1] as const) : d.kind === 'knockLoose' ? opts.flatMap((o, i) => (o === 'damage' ? [] : [[o as Hex, i] as const])) : [];
  table.setLabels('options', hexes.map(([x, n]) => ({ text: String(n), pos: table.hexToWorld(x, 0.4), cls: 'opt-label' })));
  const ring = backAt ?? ship?.pos;
  table.setOverlay(ring && !hexes.length ? [ring] : hexes.map(([x]) => x), hexes.length ? '#ffd75e' : backAt ? '#7cff9a' : '#e0402a', 0.4);
  if (hexes[0]) table.focus(hexes[0][0]);
  else if (ring && !source) table.focus(ring);
  const ghost = (heading: Direction) => backAt && table.setGhost(colours[player]!, [], [{ hex: backAt, heading, sail: 'none', label: '' }]);
  if (backAt) ghost(opts[v.decision?.defaultIndex ?? 0] as Direction);

  const panel = $('#decide');
  const left = why?.left && (d.kind === 'placeShipDamage' ? why.left[0] : d.kind === 'placeCrewDamage' ? why.left[1] : 0);
  panel.innerHTML = `<div class="who" style="--c:${colours[player]}"><span class="sw"></span>${esc(playerName(player))} decides</div>
    ${why ? `<div class="why">${why.text}</div>` : ''}
    <div class="q">${esc(DECISION_TITLE[d.kind] ?? d.kind)}${left && left > 1 ? ` <small>(${left} to place)</small>` : ''}</div>
    <div class="opts ${d.kind === 'returnHeading' ? 'two' : ''}"></div>`;
  const list = panel.querySelector<HTMLElement>('.opts')!;
  const answer = (i: number) => {
    if (busy) return;
    table.setLabels('options', []);
    table.setOverlay([]);
    table.clearArcs();
    table.setGhost('#fff', [], []);
    if (d.kind === 'returnHex') returnAt[about] = opts[i] as Hex;
    panel.hidden = true;
    cancelAnimationFrame(panelLoop);
    void play(act({ type: 'answer', choice: i }, player));
  };
  if (d.kind === 'placeShipDamage' && ship) list.appendChild(slotPicker(ship.id, opts as Slot[], v.decision?.defaultIndex ?? 0, answer));
  else
    opts.forEach((o, i) => {
      const b = h(`<button class="btn ${i === v.decision?.defaultIndex ? 'default' : ''}">${esc(optionLabel(d.kind, o, i))}</button>`);
      if (d.kind === 'placeCrewDamage') {
        const c = o as { wound?: string; kill?: string };
        const crew = ship?.crew.find((m) => m.id === (c.wound ?? c.kill));
        b.prepend(h(`<span class="token mini ${crew?.state === 'wounded' ? 'wounded' : ''}" style="background-image:url(art/crew/${crew?.captain ? 'captain-mammoth' : 'pirate'}.webp)"></span>`));
      }
      const hx = hexes.find(([, n]) => n === (d.kind === 'returnHex' ? i + 1 : i));
      if (backAt) b.onmouseenter = () => ghost(o as Direction);
      if (hx) {
        b.onmouseenter = () => table.setOverlay([hx[0]], '#7cff9a', 0.55);
        b.onmouseleave = () => table.setOverlay(hexes.map(([x]) => x), '#ffd75e', 0.4);
      }
      b.onclick = () => answer(i);
      list.appendChild(b);
    });
  panel.hidden = false;
  // Keep the panel beside the ship as the view moves.
  const place = () => {
    const p = target ? table.toScreen(target) : { x: innerWidth / 2, y: innerHeight / 3 };
    const host = $('#table').getBoundingClientRect();
    const w = panel.offsetWidth, hgt = panel.offsetHeight;
    let x = p.x + 60;
    if (x + w > host.width - 12) x = p.x - 60 - w;
    x = Math.max(12, Math.min(x, host.width - w - 12));
    const y = Math.max(70, Math.min(p.y - hgt / 2, host.height - hgt - 12));
    panel.style.transform = `translate(${x}px, ${y}px)`;
    panelLoop = requestAnimationFrame(place);
  };
  cancelAnimationFrame(panelLoop);
  place();
}

/** The damaged ship's board in miniature: tap the slot that takes the damage. */
function slotPicker(shipId: string, options: Slot[], def: number, answer: (i: number) => void): HTMLElement {
  const ship = S().state.ships[shipId]!;
  const grid = h('<div class="mini-board"></div>');
  grid.appendChild(h('<div></div>'));
  for (const p of PARTS) grid.appendChild(h(`<div class="mh">${PART_NAME[p]}</div>`));
  for (const row of ROWS) {
    grid.appendChild(h(`<div class="mr">${ROW_ICON[row]}</div>`));
    for (const p of PARTS) {
      const key = `${row}${p}`;
      const i = options.findIndex((o) => o.row === row && o.part === p);
      const card = ship.program[key];
      const b = h(`<button class="slot ${row} ${i === def ? 'default' : ''}" title="Part ${PART_NAME[p]} · ${ROW_NAME[row]}"></button>`);
      if (ship.blocked.includes(key)) b.classList.add('damaged');
      else if (card) {
        b.classList.add('filled');
        b.setAttribute('style', bandStyle(row, card));
        b.title += ` (${describeBand(card, row)}: the card is lost)`;
      }
      if (i >= 0) b.onclick = () => answer(i);
      else (b as HTMLButtonElement).disabled = true;
      grid.appendChild(b);
    }
  }
  grid.appendChild(h('<div class="mini-note">A whole damaged row sinks her. A card in the slot is lost.</div>'));
  return grid;
}

function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), 2500);
}

// ---------------- hover tips (PC) ----------------
const TERRAIN_TIP: Record<string, (tide: 'high' | 'mid' | 'low') => string> = {
  sea: () => '<b>Open sea</b>',
  cliff: () => `<b>Cliff</b> (land): stops a ship, and she takes ${DEFAULT_CONFIG.dd.cliff} damage dice`,
  beach: () => '<b>Beach</b> (land): stops a ship, no damage',
  sandbank: (t) => `<b>Sandbank</b>: land (like a beach) except at High tide. Now <b>${t === 'high' ? 'water' : 'land'}</b>`,
  underwaterReef: (t) => `<b>Underwater reef</b>: water except at Low tide, when it's land. Now <b>${t === 'low' ? 'land' : 'water'}</b>`,
  deathReef: () => '<b>Death reef</b>: sinks any ship that enters it, however she got there',
  roughWater: () => `<b>Rough water</b>: ${DEFAULT_CONFIG.dd.roughWater} damage dice to a ship in it at the end of each Part`,
  storm: () => `<b>Storm</b>: ${DEFAULT_CONFIG.dd.storm} damage dice to a ship in it at the end of each Part`,
};
const STRENGTH_WORD = ['', 'Single', 'Double', 'Triple'];

function describeHex(x: Hex): string {
  const s = S().state;
  const map = s.setup.map;
  const key = hexKey(x);
  const hx = map.hexes[key];
  if (!hx) return '';
  const tide = S().view(seats()[0]!.player).weather.tide;
  const lines: string[] = [TERRAIN_TIP[hx.terrain]!(tide)];
  if (hx.fog) lines.push('<b>Fog</b>: no cannon fire into, out of or through it, except at an adjacent ship');
  if (hx.whirlpool !== undefined) {
    lines.push(`<b>Whirlpool ${hx.whirlpool}</b>: a ship that moves onto it is sent at once to the other whirlpool ${hx.whirlpool}, keeping her heading (not if that one is occupied)`);
  }
  const c = hx.current;
  if (c?.kind === 'flow') {
    const dir = ([0, 1, 2, 3, 4, 5] as Direction[]).find((d) => hexKey(neighbor(x, d)) === c.to);
    lines.push(`<b>${STRENGTH_WORD[c.strength]} current</b>${dir === undefined ? ' (jumps to a hex further away)' : ` towards ${DIRECTION_NAMES[dir]}`}: in the Currents phase it carries a ship here along the arrows, up to ${c.strength} hex${c.strength > 1 ? 'es' : ''}${c.turn ? `, and turns her ${Math.abs(c.turn) * 60}° ${c.turn > 0 ? 'clockwise' : 'anticlockwise'}` : ', keeping her heading'}. Blocked if the hex is occupied`);
  } else if (c?.kind === 'eddy') {
    lines.push(`<b>Eddy</b>: in the Currents phase it turns a ship here ${Math.abs(c.turn) * 60}° ${c.turn > 0 ? 'clockwise' : 'anticlockwise'}; she doesn’t move`);
  }
  for (const r of map.rotors ?? []) {
    if (r.moves[key])
      lines.push(`<b>Rotor</b> (${Object.keys(r.moves).length} hexes): in the Currents phase the ships on it all move round one place together and turn ${Math.abs(r.turn) * 60}°`);
  }
  for (const cave of map.caves ?? []) {
    if (cave.hex === key) lines.push(`<b>Sea cave ${cave.letter}</b> on its ${DIRECTION_NAMES[cave.side]} side: a ship entering it comes out of the other cave ${cave.letter}, facing out`);
    if (hexKey(neighbor(parseHexKey(cave.hex), cave.side)) === key) lines.push(`<b>Mouth of sea cave ${cave.letter}</b>`);
  }
  for (const w of map.wallReefs ?? []) {
    if (w.hex === key) lines.push(`<b>Wall reef</b> on the ${DIRECTION_NAMES[w.side]} edge: blocks crossing it (${DEFAULT_CONFIG.dd.wallReef} damage dice); cannon fire passes`);
    else if (hexKey(neighbor(parseHexKey(w.hex), w.side)) === key) lines.push('<b>Wall reef</b> on one edge: blocks crossing it');
  }
  const spawn = Object.entries(map.spawnPoints ?? {}).find(([, k]) => k === key)?.[0];
  if (spawn) lines.push(`<b>Treasure spawn point ${spawn}</b>${isLand(hx.terrain, tide) ? ' (on land: dig it up from a hex next to it)' : ''}`);
  const port = seats().find((seat) => hexEquals(seat.homePort, x));
  if (port) lines.push(`<b>${esc(port.name)}’s home port</b>: bring treasure here to score; refit here; no drift, storm or Gale damage here`);
  if (s.treasures.includes(key)) lines.push(`💎 <b>Treasure: ${TREASURE_NAME[s.treasureKinds[key] ?? 'gold']}</b> (every piece is worth 1): sail through to pick it up${isLand(hx.terrain, tide) ? ', or dig it up from a hex next to it at the end of the turn' : ''}`);
  if (s.wrecks.includes(key)) lines.push('⚓︎☠ <b>Shipwreck</b>: end a turn on it (or next to it, if it’s on land) to search it for a crew member');
  for (const ship of Object.values(s.ships)) {
    if (ship.status !== 'afloat' || !hexEquals(ship.pos, x)) continue;
    const healthy = ship.crew.filter((m) => m.state === 'healthy').length;
    lines.push(`<span class="sw" style="--c:${colours[ship.player]}"></span> <b>${esc(shipName(ship.id))}</b>: facing ${DIRECTION_NAMES[ship.heading]}, crew ${healthy}/${ship.crew.length} healthy, ${ship.blocked.length} damaged slot${ship.blocked.length === 1 ? '' : 's'}${ship.carrying ? `, carrying ${TREASURE_NAME[ship.cargo ?? 'gold']} 💎` : ''}${ship.stuck ? ', stranded' : ''}${ship.refitting ? ', refitting' : ''}`);
  }
  return lines.map((l) => `<div>${l}</div>`).join('');
}

let tipTimer = 0;
table.onHover = (x, cx, cy) => {
  clearTimeout(tipTimer);
  const tip = $('#tip');
  tip.hidden = true;
  if (!x || !session || !$('#screen').hidden) return;
  tipTimer = window.setTimeout(() => {
    const html = describeHex(x);
    if (!html) return;
    tip.innerHTML = html;
    tip.hidden = false;
    const host = $('#table').getBoundingClientRect();
    const px = cx - host.left, py = cy - host.top;
    const w = tip.offsetWidth, hgt = tip.offsetHeight;
    tip.style.transform = `translate(${px + 18 + w > host.width ? px - w - 18 : px + 18}px, ${Math.max(8, py + 18 + hgt > host.height ? py - hgt - 18 : py + 18)}px)`;
  }, 400);
};

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
    ${session ? `<h4>Game log</h4><p>Everything that has happened in this game (every card, move and ship and board state, with automatic checks), as text, to look into anything odd. It shows every player's hidden cards.</p>
    <div class="grid"><button class="btn" id="m-copy">📋 Copy game log</button><button class="btn" id="m-save">💾 Save game log</button></div><p id="m-log-msg" class="hint"></p>` : ''}
    <h4>Map key</h4><p>Arrows: currents (one, two or three arrows for strength). Rings: rotors. Spiral with a number: whirlpool. Letters: sea caves. Pink zigzag: wall reef. Numbered discs: treasure spawn points. 💎 loose treasure, ⚓︎☠ wreck.</p>`;
  m.querySelector<HTMLElement>('#menu-x')!.onclick = () => (m.hidden = true);
  for (const how of ['copy', 'save'] as const) {
    const b = m.querySelector<HTMLElement>(`#m-${how}`);
    if (b) b.onclick = async () => (m.querySelector<HTMLElement>('#m-log-msg')!.textContent = await exportLog(how));
  }
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

// Draw the weather card at the board's angle, so its directions line up with the board's (rules §3.5 aid).
const tiltCard = () => {
  const { tilt, turn } = table.viewAngles();
  const w = $('#weather');
  w.style.setProperty('--tilt', `${tilt}rad`);
  // Turning the camera by `turn` turns the board's north `turn` clockwise on screen; CSS rotateZ is clockwise too, so the same sign.
  w.style.setProperty('--turn', `${turn}rad`);
  requestAnimationFrame(tiltCard);
};
tiltCard();

// Expose for automated checks (screenshot script).
(window as unknown as { msb: unknown }).msb = { get session() { return session; }, get busy() { return busy; }, table, refresh: () => (syncShown(), renderTable()), HIDDEN };
$('#dock').hidden = true;
startScreen();
