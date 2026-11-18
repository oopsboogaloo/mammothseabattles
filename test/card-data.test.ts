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
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(header!.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const uniqueIds = (rows: Record<string, string>[]) => new Set(rows.map((r) => r.id)).size === rows.length;
const DIRECTIONS = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];

describe('card data files', () => {
  it('command cards: 45 cards with known orders', () => {
    const rows = readCsv('command-cards');
    expect(Object.keys(rows[0]!)).toEqual(['id', 'initiative', 'octopus_icons', 'sail_order', 'steer_order', 'action_order', 'copies', 'art_file', 'notes']);
    expect(rows).toHaveLength(45);
    expect(uniqueIds(rows)).toBe(true);
    for (const r of rows) {
      expect(Number.isInteger(Number(r.initiative)) && Number(r.initiative) > 0, `initiative of ${r.id}`).toBe(true);
      expect(['0', '1', '2', '3'], `octopus icons of ${r.id}`).toContain(r.octopus_icons);
      expect(['Anchor', 'Row Ahead 1', 'Row Back 1', 'Half Sail', 'Full Sail'], `sail order of ${r.id}`).toContain(r.sail_order);
      expect(['Ease Port', 'Ease Starboard', 'Hard to Port', 'Hard to Starboard', 'Hard About'], `steer order of ${r.id}`).toContain(r.steer_order);
      expect(['Fire Cannons', 'Heal', 'Repair'], `action order of ${r.id}`).toContain(r.action_order);
      expect(Number(r.copies), `copies of ${r.id}`).toBeGreaterThanOrEqual(1);
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
    }
  });

  it('equipment, crew and treasure map cards have unique ids and names', () => {
    for (const name of ['equipment-cards', 'crew-cards', 'treasure-map-cards']) {
      const rows = readCsv(name);
      expect(rows.length, name).toBeGreaterThan(0);
      expect(uniqueIds(rows), name).toBe(true);
      for (const r of rows) expect(r.id, name).not.toBe('');
    }
    expect(readCsv('equipment-cards').every((r) => r.name !== '' && r.text !== '')).toBe(true);
    expect(readCsv('treasure-map-cards').map((r) => r.spawn_point_number)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });
});
