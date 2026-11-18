/**
 * Mock-up content, transcribed from the designer's art (Cards/Movecards, Cards/Weather cards, Cards/CrewCards, Crew).
 * In M1 this moves to msb-data with schema validation (web-spec §5).
 */
import type { Direction } from '@msb/hex';
import type { WindStrength } from '@msb/msb-rules';

/** Blue band. Anchor, Row Ahead 1 and Row Back 1 are on the art but not yet in rules.md (see mock-up README). */
export type SailOrder = 'half' | 'full' | 'anchor' | 'rowAhead' | 'rowBack';
export type SteerOrder = 'easePort' | 'easeStbd' | 'hardPort' | 'hardStbd' | 'hardAbout';
export type ActionOrder = 'fire' | 'heal' | 'repair';

export interface CommandCard {
  readonly id: string;
  readonly initiative: number;
  readonly sail: SailOrder;
  readonly steer: SteerOrder;
  readonly action: ActionOrder;
  /** Octopus icons (sea monster module, rules §9.1). */
  readonly octopus: number;
}

type Row = [init: number, sail: SailOrder, steer: SteerOrder, action: ActionOrder, octopus: number, id?: string];
const ROWS: Row[] = [
  [100, 'rowAhead', 'easePort', 'fire', 0], [120, 'rowBack', 'easePort', 'heal', 1], [140, 'anchor', 'easePort', 'repair', 1],
  [160, 'anchor', 'easeStbd', 'fire', 0], [180, 'rowAhead', 'easeStbd', 'heal', 1], [200, 'rowBack', 'easeStbd', 'repair', 0],
  [220, 'rowBack', 'hardPort', 'fire', 0], [240, 'anchor', 'hardPort', 'heal', 1], [260, 'rowAhead', 'hardPort', 'repair', 1],
  [280, 'rowAhead', 'hardStbd', 'fire', 0], [300, 'rowBack', 'hardStbd', 'heal', 3], [320, 'anchor', 'hardStbd', 'repair', 0],
  [340, 'anchor', 'hardAbout', 'fire', 1], [360, 'rowBack', 'hardAbout', 'heal', 0], [360, 'rowAhead', 'hardAbout', 'repair', 2, '360b'],
  [400, 'half', 'easePort', 'fire', 1], [420, 'half', 'easePort', 'heal', 0], [440, 'half', 'easePort', 'repair', 1],
  [460, 'half', 'easeStbd', 'fire', 1], [480, 'half', 'easeStbd', 'heal', 0], [500, 'half', 'easeStbd', 'repair', 0],
  [520, 'half', 'hardPort', 'fire', 2], [540, 'half', 'hardPort', 'heal', 1], [560, 'half', 'hardPort', 'repair', 0],
  [580, 'half', 'hardStbd', 'fire', 0], [600, 'half', 'hardStbd', 'heal', 1], [620, 'half', 'hardStbd', 'repair', 0],
  [640, 'half', 'hardAbout', 'fire', 2], [660, 'half', 'hardAbout', 'heal', 0], [680, 'half', 'hardAbout', 'repair', 1],
  [700, 'full', 'easePort', 'fire', 1], [720, 'full', 'easePort', 'heal', 0], [740, 'full', 'easePort', 'repair', 2],
  [760, 'full', 'easeStbd', 'fire', 0], [780, 'full', 'easeStbd', 'heal', 2], [800, 'full', 'easeStbd', 'repair', 0],
  [820, 'full', 'hardPort', 'fire', 0], [840, 'full', 'hardPort', 'heal', 1], [860, 'full', 'hardPort', 'repair', 0],
  [880, 'full', 'hardStbd', 'fire', 0], [900, 'full', 'hardStbd', 'heal', 1], [920, 'full', 'hardStbd', 'repair', 1],
  [940, 'full', 'hardAbout', 'fire', 1], [960, 'full', 'hardAbout', 'heal', 1], [980, 'full', 'hardAbout', 'repair', 0],
];

export const CARDS: readonly CommandCard[] = ROWS.map(([initiative, sail, steer, action, octopus, id]) => ({
  id: id ?? String(initiative),
  initiative,
  sail,
  steer,
  action,
  octopus,
}));
export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export const cardArt = (id: string): string => `art/cards/${id}.webp`;

export const SAIL_LABEL: Record<SailOrder, string> = {
  half: 'Half Sail', full: 'Full Sail', anchor: 'Anchor', rowAhead: 'Row Ahead 1', rowBack: 'Row Back 1',
};
export const STEER_LABEL: Record<SteerOrder, string> = {
  easePort: 'Ease Port', easeStbd: 'Ease Starboard', hardPort: 'Hard to Port', hardStbd: 'Hard to Starboard', hardAbout: 'Hard About',
};
export const ACTION_LABEL: Record<ActionOrder, string> = { fire: 'Fire Cannons', heal: 'Heal', repair: 'Repair' };
/** 60° steps clockwise. Hard About is assumed to be 180° (not yet in rules.md). */
export const STEER_STEPS: Record<SteerOrder, number> = { easePort: -1, easeStbd: 1, hardPort: -2, hardStbd: 2, hardAbout: 3 };

// ---- Weather ----
export interface WeatherCard {
  readonly id: string;
  readonly name: string;
  readonly strength: WindStrength | null; // null: special card (new front, storm, hurricane)
  readonly direction: Direction | null;
  readonly text: string;
}
const DIRS: Record<string, Direction> = { n: 0, ne: 1, se: 2, s: 3, sw: 4, nw: 5 };
const STRENGTH_TEXT: Record<string, string> = {
  light: '−1 all sail moves',
  firm: 'No sail modifier · drifts in Part III',
  strong: '+1 Full Sail moves · drifts in Parts II–III',
  gale: '+1 all sail moves · 1 DD per Full Sail · drifts every Part',
};
const STRENGTH_ID: Record<string, WindStrength> = { light: 'light', firm: 'firm', strong: 'strong', gale: 'gale' };
export const WEATHER: readonly WeatherCard[] = [
  ...['light', 'firm', 'strong', 'gale'].flatMap((st) =>
    Object.entries(DIRS).map(([d, dir]) => ({
      id: `${st}-${d}`,
      name: `${st[0]!.toUpperCase()}${st.slice(1)} ${d.toUpperCase()} wind`,
      strength: STRENGTH_ID[st]!,
      direction: dir,
      text: STRENGTH_TEXT[st]!,
    })),
  ),
  { id: 'dead-calm', name: 'Dead Calm', strength: 'deadCalm', direction: null, text: 'No sail moves' },
  { id: 'new-front', name: 'New Weather Front', strength: null, direction: null, text: 'Reshuffle the weather deck' },
  { id: 'lightning-storm', name: 'Lightning Storm', strength: null, direction: null, text: '2 DD at each turn start' },
  { id: 'hurricane', name: 'Hurricane', strength: null, direction: null, text: 'Water as high tide · 1 DD each turn' },
];
export const WEATHER_BY_ID = new Map(WEATHER.map((w) => [w.id, w]));
export const weatherArt = (id: string): string => `art/weather/${id}.webp`;

/** Weather board ring, clockwise from the top (rules §3.5). */
export const TIDES = ['High', 'Mid (ebbing)', 'Mid (ebbing)', 'Low', 'Mid (flooding)', 'Mid (flooding)'] as const;

// ---- Crew ----
export interface CrewDef {
  readonly id: string;
  readonly name: string;
  /** Command cards drawn per turn (card icons). */
  readonly draws: number;
  readonly art: string;
  /** True when the art is a finished crew card; false = a portrait standing in for an unfinished card. */
  readonly finished: boolean;
  readonly power?: string;
}
export const CREW: Record<string, CrewDef> = {
  captain: { id: 'captain', name: 'Captain Mammoth', draws: 3, art: 'art/crew/captain-mammoth.webp', finished: true, power: 'Draws 3 command cards' },
  pirate: { id: 'pirate', name: 'Pirate', draws: 1, art: 'art/crew/pirate.webp', finished: true },
  pirate2: { id: 'pirate2', name: 'Pirate', draws: 1, art: 'art/crew/pirate-2.webp', finished: true },
  gunner: { id: 'gunner', name: 'Gunner', draws: 1, art: 'art/portraits/gunner.webp', finished: false, power: 'Placeholder crew' },
  lookout: { id: 'lookout', name: 'Lookout', draws: 1, art: 'art/portraits/lookout.webp', finished: false, power: 'Placeholder crew' },
  cook: { id: 'cook', name: 'Cook', draws: 1, art: 'art/portraits/cook.webp', finished: false, power: 'Placeholder crew' },
  carpenter: { id: 'carpenter', name: 'Carpenter', draws: 1, art: 'art/portraits/carpenter.webp', finished: false, power: 'Placeholder crew' },
  helmsman: { id: 'helmsman', name: 'Helmsman', draws: 1, art: 'art/portraits/helmsman.webp', finished: false, power: 'Placeholder crew' },
  navigator: { id: 'navigator', name: 'Navigator', draws: 1, art: 'art/portraits/navigator.webp', finished: false, power: 'Placeholder crew' },
  marksman: { id: 'marksman', name: 'Marksman', draws: 1, art: 'art/portraits/marksman.webp', finished: false, power: 'Placeholder crew' },
  bosun: { id: 'bosun', name: 'Bosun', draws: 1, art: 'art/portraits/bosun.webp', finished: false, power: 'Placeholder crew' },
  quartermaster: { id: 'quartermaster', name: 'Quartermaster', draws: 1, art: 'art/portraits/quartermaster.webp', finished: false, power: 'Placeholder crew' },
  cartographer: { id: 'cartographer', name: 'Cartographer', draws: 1, art: 'art/portraits/cartographer.webp', finished: false, power: 'Placeholder crew' },
};
export const WOUNDED_ART = 'art/crew/wounded.webp';

export const EQUIPMENT: Record<string, { name: string; text: string }> = {
  'first-aid-kit': { name: 'First Aid Kit', text: 'Use to immediately heal 2 crew.' },
  'ocean-charts': { name: 'Ocean Charts', text: 'Ignore ocean currents for the rest of the turn.' },
  'wind-chimes': { name: 'Wind Chimes', text: 'Ignore wind drift for the rest of the turn.' },
  weathervane: { name: 'Weathervane', text: 'Look at the uncovered weather cards; you may re-arrange them.' },
  fireworks: { name: 'Fireworks', text: 'Cannon range +4, but it only does 1 DD.' },
  'big-cannonballs': { name: 'Really Big Cannonballs', text: 'Cannon damage is +1 DD this turn.' },
  'cannon-sights': { name: 'Cannon Sights', text: 'Cannon range +2 this turn.' },
  'grape-shot': { name: 'Grape Shot', text: 'Cannon does 1 injury to crew in addition to any other damage this turn.' },
  'armour-plating': { name: 'Armour Plating', text: 'Prevent up to 3 DD of damage, from any source.' },
  'repair-kit': { name: 'Repair Kit', text: 'Repair 2 damage.' },
  'strong-rudder': { name: 'Strong Rudder', text: 'Immediately turn the boat around, 180 degrees.' },
  'extra-sail': { name: 'Extra Sail', text: 'Sail move is +1 for this move phase.' },
};
export const equipmentArt = (id: string): string => `art/equipment/${id}.webp`;
