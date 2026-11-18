/**
 * The card data files in data/cards are edited by hand (in Excel), so this test checks they are still well formed:
 * the expected columns, unique ids, and only known values in the fields the rules depend on.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/** Minimal CSV reader: quoted fields, doubled quotes, CRLF or LF, optional byte-order mark. */
function readCsv(name: string): Record<string, string>[] {
  const text = readFileSync(`data/cards/${name}.csv`, 'utf8').replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (quoted) throw new Error(`${name}.csv: a quoted field is never closed`);
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  const columns = header!.map((h) => h.trim());
  expect(columns, `columns of ${name}.csv`).toEqual(COLUMNS[name]);
  const filled = body.filter((r) => r.some((v) => v.trim() !== ''));
  for (const r of filled) expect(r.length, `${name}.csv, row starting "${r[0]}": number of fields`).toBe(columns.length);
  return filled.map((r) => Object.fromEntries(columns.map((h, i) => [h, r[i]!.trim()])));
}

const COLUMNS: Record<string, string[]> = {
  'command-cards': ['id', 'initiative', 'octopus_icons', 'sail_order', 'steer_order', 'action_order', 'copies', 'art_file', 'notes'],
  'weather-cards': ['id', 'name', 'wind_strength', 'wind_direction', 'sail_move_modifier', 'modifier_applies_to', 'text_1', 'text_2', 'text_3', 'copies', 'art_file', 'notes'],
  'equipment-cards': ['id', 'name', 'text', 'copies', 'art_file', 'notes'],
  'crew-cards': ['id', 'name', 'card_icons', 'power_text', 'status', 'art_file', 'wounded_art_file', 'copies', 'notes'],
  'treasure-map-cards': ['id', 'spawn_point_number', 'status', 'art_file', 'copies', 'notes'],
  'crew-card-ideas': ['id', 'name', 'group', 'creature', 'card_icons', 'power_text', 'flavour_text', 'use', 'notes'],
};

/** Every id is filled in and no two rows share one. */
const uniqueIds = (rows: Record<string, string>[]) => rows.every((r) => r.id !== '') && new Set(rows.map((r) => r.id)).size === rows.length;
/** A whole number of copies, at least 1. `blankAllowed` is for crew, where the deck list is not decided yet. */
const validCopies = (value: string | undefined, blankAllowed = false) => (blankAllowed && value === '') || /^[1-9]\d*$/.test(value ?? '');
const DIRECTIONS = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];

describe('card data files', () => {
  it('command cards: 45 cards with known orders', () => {
    const rows = readCsv('command-cards');
    expect(rows).toHaveLength(45);
    expect(uniqueIds(rows)).toBe(true);
    for (const r of rows) {
      expect(Number.isInteger(Number(r.initiative)) && Number(r.initiative) > 0, `initiative of ${r.id}`).toBe(true);
      expect(['0', '1', '2', '3'], `octopus icons of ${r.id}`).toContain(r.octopus_icons);
      expect(['Anchor', 'Row Ahead 1', 'Row Back 1', 'Half Sail', 'Full Sail'], `sail order of ${r.id}`).toContain(r.sail_order);
      expect(['Ease Port', 'Ease Starboard', 'Hard to Port', 'Hard to Starboard', 'Hard About'], `steer order of ${r.id}`).toContain(r.steer_order);
      expect(['Fire Cannons', 'Heal', 'Repair'], `action order of ${r.id}`).toContain(r.action_order);
      expect(validCopies(r.copies), `copies of ${r.id}`).toBe(true);
    }
  });

  it('weather cards: every strength in every direction, plus the special cards', () => {
    const rows = readCsv('weather-cards');
    expect(rows).toHaveLength(28);
    expect(uniqueIds(rows)).toBe(true);
    for (const strength of ['Light', 'Firm', 'Strong', 'Gale'])
      expect(rows.filter((r) => r.wind_strength === strength).map((r) => r.wind_direction).sort(), strength).toEqual([...DIRECTIONS].sort());
    for (const r of rows) {
      expect(['', 'Dead Calm', 'Light', 'Firm', 'Strong', 'Gale'], `strength of ${r.id}`).toContain(r.wind_strength);
      expect(['', ...DIRECTIONS], `direction of ${r.id}`).toContain(r.wind_direction);
      expect(['', '-1', '1', '+1'], `modifier of ${r.id}`).toContain(r.sail_move_modifier);
      expect(['', 'All sail moves', 'Full Sail moves'], `modifier scope of ${r.id}`).toContain(r.modifier_applies_to);
      expect(validCopies(r.copies), `copies of ${r.id}`).toBe(true);
    }
  });

  it('equipment, crew and treasure map cards have unique ids and names', () => {
    for (const name of ['equipment-cards', 'crew-cards', 'treasure-map-cards']) {
      const rows = readCsv(name);
      expect(rows.length, name).toBeGreaterThan(0);
      expect(uniqueIds(rows), name).toBe(true);
      for (const r of rows) expect(validCopies(r.copies, name === 'crew-cards'), `copies of ${r.id}`).toBe(true);
    }
    expect(readCsv('equipment-cards').every((r) => r.name !== '' && r.text !== '')).toBe(true);
    const ideas = readCsv('crew-card-ideas');
    expect(uniqueIds(ideas)).toBe(true);
    for (const r of ideas) expect(r.name !== '' && r.power_text !== '' && /^\d+$/.test(r.card_icons ?? ''), `crew idea ${r.id}`).toBe(true);
    expect(readCsv('treasure-map-cards').map((r) => r.spawn_point_number)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });
});
