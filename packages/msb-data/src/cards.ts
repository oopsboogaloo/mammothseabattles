/**
 * The real card decks, read from the CSV files in data/cards (engineering design §7.2), with the rules' corrections applied.
 */

import type { Direction } from '@msb/hex';
import type { ActionOrder, CommandCard, SailOrder, SteerOrder, WeatherCard } from '@msb/msb-rules';
import { parseCsv } from './csv';
import { COMMAND_CARDS_CSV, CREW_CARDS_CSV, TREASURE_MAP_CARDS_CSV, WEATHER_CARDS_CSV } from './generated/csv';

const SAIL: Readonly<Record<string, SailOrder>> = {
  'Half Sail': 'half',
  'Full Sail': 'full',
  Anchor: 'anchor',
  'Row Ahead 1': 'rowAhead',
  'Row Back 1': 'rowBack',
};
const STEER: Readonly<Record<string, SteerOrder>> = {
  'Ease Port': 'easePort',
  'Ease Starboard': 'easeStbd',
  'Hard to Port': 'hardPort',
  'Hard to Starboard': 'hardStbd',
  'Hard About': 'hardAbout',
};
const ACTION: Readonly<Record<string, ActionOrder>> = { 'Fire Cannons': 'fire', Repair: 'repair', Heal: 'heal' };

function lookup<T>(table: Readonly<Record<string, T>>, value: string, what: string): T {
  const found = table[value];
  if (found === undefined) throw new Error(`Unknown ${what}: "${value}"`);
  return found;
}

/**
 * Corrections the rules make to the printed cards until the art is fixed (designer's to-do):
 * the second card numbered 360 is 380 (rules v0.131).
 */
export const INITIATIVE_OVERRIDES: Readonly<Record<string, number>> = { '360b': 380 };

/** Every copy of every command card (rules §3.3), from command-cards.csv. */
export function commandCards(csv: string = COMMAND_CARDS_CSV): CommandCard[] {
  return parseCsv(csv).flatMap((r) => {
    const id = r['id'] as string;
    const card = {
      initiative: INITIATIVE_OVERRIDES[id] ?? Number(r['initiative']),
      sail: lookup(SAIL, r['sail_order'] as string, 'sail order'),
      steer: lookup(STEER, r['steer_order'] as string, 'steer order'),
      action: lookup(ACTION, r['action_order'] as string, 'action order'),
      octopus: Number(r['octopus_icons']),
    };
    const copies = Number(r['copies']);
    return Array.from({ length: copies }, (_, i) => ({ id: copies === 1 ? id : `${id}-${i + 1}`, ...card }));
  });
}

const STRENGTH: Readonly<Record<string, WeatherCard['strength']>> = {
  'Dead Calm': 'deadCalm',
  Light: 'light',
  Firm: 'firm',
  Strong: 'strong',
  Gale: 'gale',
};
const DIRECTION: Readonly<Record<string, Direction>> = { N: 0, NE: 1, SE: 2, S: 3, SW: 4, NW: 5 };

/** Cards left out of the weather deck for now (rules §3.5, v0.136): their rules aren't settled. */
export const LEFT_OUT_WEATHER: readonly string[] = [
  'lightning-storm',
  'hurricane',
  // Gales are out for now too (designer, rules v0.151).
  ...['n', 'ne', 'se', 's', 'sw', 'nw'].map((d) => `gale-${d}`),
];

/** The weather deck (rules §3.5), from weather-cards.csv, without the cards left out for now. */
export function weatherCards(csv: string = WEATHER_CARDS_CSV): WeatherCard[] {
  return parseCsv(csv)
    .filter((r) => !LEFT_OUT_WEATHER.includes(r['id'] as string))
    .flatMap((r) => {
      const id = r['id'] as string;
      const strength = r['name'] === 'New Weather Front' ? 'newFront' : lookup(STRENGTH, r['wind_strength'] as string, 'wind strength');
      const dir = r['wind_direction'] as string;
      const card: WeatherCard = dir === '' ? { id, strength } : { id, strength, direction: lookup(DIRECTION, dir, 'wind direction') };
      const copies = Number(r['copies']);
      return Array.from({ length: copies }, (_, i) => (copies === 1 ? card : { ...card, id: `${id}-${i + 1}` }));
    });
}

export interface CrewCardDef {
  readonly id: string;
  readonly name: string;
  /** Command cards drawn while healthy (rules §3.6). */
  readonly cardIcons: number;
}

/** The crew cards (rules §3.6), from crew-cards.csv. The prototype uses the Captain and the Pirate. */
export function crewCards(csv: string = CREW_CARDS_CSV): CrewCardDef[] {
  return parseCsv(csv).map((r) => ({ id: r['id'] as string, name: r['name'] as string, cardIcons: Number(r['card_icons']) }));
}

/** The treasure map deck (rules §8.2.1): spawn point numbers, from treasure-map-cards.csv. */
export function treasureMapCards(csv: string = TREASURE_MAP_CARDS_CSV): string[] {
  return parseCsv(csv).map((r) => r['spawn_point_number'] as string);
}
