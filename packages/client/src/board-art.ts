/**
 * Draws a rules map (GameMap) as a flat printed board on a canvas, for maps that have no printed art yet (the test map).
 * The canvas becomes the board texture on the 3D table (table.ts). Everything printed on a real board is drawn here:
 * terrain, fog, whirlpools, caves, wall reefs, currents, rotors, spawn points and ports.
 */
import { neighbor, type Direction, type Hex } from '@msb/hex';
import type { GameMap, Terrain } from '@msb/msb-rules';
import { parseHexKey } from '@msb/msb-rules';
import { hexToOffset } from './game';
import type { MapInfo } from './table';

const S = 110; // hex radius in canvas pixels
const HH = Math.sqrt(3) * S;
const MARGIN = 60;

const TERRAIN_FILL: Record<Terrain, string> = {
  sea: '#2f6f9a',
  cliff: '#8c6d5c',
  beach: '#e5cb86',
  sandbank: '#cdb06b',
  underwaterReef: '#4f9c95',
  deathReef: '#3b3633',
  roughWater: '#7b4a7d',
  storm: '#3f4658',
};
const TERRAIN_LABEL: Partial<Record<Terrain, string>> = {
  cliff: 'CLIFF',
  beach: 'BEACH',
  sandbank: 'SANDBANK',
  underwaterReef: 'REEF',
  deathReef: '☠',
  roughWater: 'ROUGH',
  storm: '⚡ STORM',
};

export interface BoardArt {
  info: MapInfo;
  canvas: HTMLCanvasElement;
}

/** Map info (hex size, origin, list of hexes) laid out so the whole map fits with a margin. */
export function layoutMap(map: GameMap): MapInfo {
  const offs = Object.keys(map.hexes).map((k) => hexToOffset(parseHexKey(k)));
  const cols = offs.map(([c]) => c);
  const ys = offs.map(([c, r]) => HH * (r + 0.5 * (c & 1)));
  const minCol = Math.min(...cols), maxCol = Math.max(...cols);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const originX = MARGIN + S - 1.5 * S * minCol;
  const originY = MARGIN + HH / 2 - minY;
  return {
    width: Math.ceil(originX + 1.5 * S * maxCol + S + MARGIN),
    height: Math.ceil(originY + maxY + HH / 2 + MARGIN),
    size: S,
    originX,
    originY,
    hexes: offs,
  };
}

function centre(info: MapInfo, h: Hex): [number, number] {
  const [col, row] = hexToOffset(h);
  return [info.originX + 1.5 * info.size * col, info.originY + HH * (row + 0.5 * (col & 1))];
}

/** Screen angle of a hex direction (flat-topped: N is straight up). */
const dirAngle = (d: Direction) => -Math.PI / 2 + (d * Math.PI) / 3;

function hexPath(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    g[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a));
  }
  g.closePath();
}

function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, colour: string) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.strokeStyle = colour;
  g.fillStyle = colour;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1 - Math.cos(a) * width * 1.6, y1 - Math.sin(a) * width * 1.6);
  g.stroke();
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - Math.cos(a - 0.5) * width * 3, y1 - Math.sin(a - 0.5) * width * 3);
  g.lineTo(x1 - Math.cos(a + 0.5) * width * 3, y1 - Math.sin(a + 0.5) * width * 3);
  g.closePath();
  g.fill();
}

function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour = '#fff', weight = 800) {
  g.font = `${weight} ${size}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = size / 5;
  g.strokeStyle = 'rgba(0,0,0,.55)';
  g.strokeText(text, x, y);
  g.fillStyle = colour;
  g.fillText(text, x, y);
}

/** Draw the board. `ports` maps a hex key to the colour of the team whose port it is. */
export function drawBoard(map: GameMap, ports: Readonly<Record<string, string>>): BoardArt {
  const info = layoutMap(map);
  const canvas = document.createElement('canvas');
  canvas.width = info.width;
  canvas.height = info.height;
  const g = canvas.getContext('2d')!;
  const at = (key: string) => centre(info, parseHexKey(key));

  // Terrain, with a light grid.
  for (const [key, hex] of Object.entries(map.hexes)) {
    const [x, y] = at(key);
    hexPath(g, x, y, S);
    g.fillStyle = TERRAIN_FILL[hex.terrain];
    g.fill();
    if (hex.terrain === 'sandbank' || hex.terrain === 'underwaterReef') {
      g.save();
      hexPath(g, x, y, S);
      g.clip();
      g.strokeStyle = hex.terrain === 'sandbank' ? 'rgba(255,240,190,.55)' : 'rgba(210,255,240,.45)';
      g.lineWidth = 9;
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        g.moveTo(x - S, y + i * 30 - S * 0.4);
        g.lineTo(x + S, y + i * 30 + S * 0.4);
        g.stroke();
      }
      g.restore();
    }
    hexPath(g, x, y, S);
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 3;
    g.stroke();
    const text = TERRAIN_LABEL[hex.terrain];
    if (text) label(g, text, x, y + S * 0.62, hex.terrain === 'deathReef' ? 70 : 24);
    if (hex.fog) {
      hexPath(g, x, y, S * 0.96);
      g.fillStyle = 'rgba(240,240,240,.55)';
      g.fill();
      label(g, 'FOG', x, y - S * 0.6, 26, '#fff');
    }
    if (hex.whirlpool !== undefined) {
      g.strokeStyle = 'rgba(230,245,255,.9)';
      for (let r = 20; r < S * 0.8; r += 18) {
        g.lineWidth = 6;
        g.beginPath();
        g.arc(x, y, r, 0.3 * r, 0.3 * r + Math.PI * 1.5);
        g.stroke();
      }
      label(g, String(hex.whirlpool), x, y, 54, '#fff');
    }
  }

  // Currents: arrows from the hex they start in. Strength = number of arrows (single, double, triple).
  for (const [key, hex] of Object.entries(map.hexes)) {
    const c = hex.current;
    if (!c) continue;
    const [x, y] = at(key);
    if (c.kind === 'eddy') {
      g.strokeStyle = '#e8eef8';
      g.lineWidth = 8;
      g.beginPath();
      g.arc(x, y, S * 0.5, 0, Math.PI * 1.6, c.turn < 0);
      g.stroke();
      label(g, `${c.turn > 0 ? '↻' : '↺'} ${Math.abs(c.turn) * 60}°`, x, y, 34, '#fff');
      continue;
    }
    const [tx, ty] = at(c.to);
    const dx = tx - x, dy = ty - y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    for (let i = 0; i < c.strength; i++) {
      const off = (i - (c.strength - 1) / 2) * 26;
      const px = -uy * off, py = ux * off;
      arrow(g, x - ux * S * 0.55 + px, y - uy * S * 0.55 + py, x + ux * S * 0.95 + px, y + uy * S * 0.95 + py, 10, 'rgba(232,238,248,.95)');
    }
    if (c.turn !== 0) label(g, `${c.turn > 0 ? '↻' : '↺'} ${Math.abs(c.turn) * 60}°`, x, y - S * 0.5, 28);
    if (len > HH * 1.2) label(g, 'jump', x, y + S * 0.5, 26);
  }

  // Rotors: a ring through the rotor's hexes, labelled with the angle.
  for (const rotor of map.rotors ?? []) {
    const pts = Object.keys(rotor.moves).map(at);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const r = Math.max(...pts.map(([px, py]) => Math.hypot(px - cx, py - cy)));
    g.strokeStyle = 'rgba(232,238,248,.95)';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 1.75, rotor.turn < 0);
    g.stroke();
    label(g, `rotor ${Math.abs(rotor.turn) * 60}°`, cx, cy, 30);
  }

  // Wall reefs: a jagged line along the edge.
  for (const edge of map.wallReefs ?? []) {
    const h = parseHexKey(edge.hex);
    const [x, y] = centre(info, h);
    const a = dirAngle(edge.side);
    const mx = x + Math.cos(a) * HH * 0.5, my = y + Math.sin(a) * HH * 0.5;
    const ex = -Math.sin(a) * S * 0.5, ey = Math.cos(a) * S * 0.5;
    g.strokeStyle = '#f0a7c0';
    g.lineWidth = 10;
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const t = i / 8 - 0.5;
      const z = i % 2 ? 14 : -14;
      g[i ? 'lineTo' : 'moveTo'](mx + ex * 2 * t + Math.cos(a) * z, my + ey * 2 * t + Math.sin(a) * z);
    }
    g.stroke();
  }

  // Sea caves: the letter on the cave mouth.
  for (const cave of map.caves ?? []) {
    const h = parseHexKey(cave.hex);
    const [x, y] = centre(info, h);
    const a = dirAngle(cave.side);
    const mx = x + Math.cos(a) * HH * 0.42, my = y + Math.sin(a) * HH * 0.42;
    g.fillStyle = '#1b130e';
    g.beginPath();
    g.arc(mx, my, 34, 0, Math.PI * 2);
    g.fill();
    label(g, cave.letter, mx, my, 40, '#ffe8a0');
    const [nx, ny] = centre(info, neighbor(h, cave.side));
    arrow(g, mx + (nx - mx) * 0.25, my + (ny - my) * 0.25, mx + (nx - mx) * 0.55, my + (ny - my) * 0.55, 7, '#ffe8a0');
  }

  // Spawn points and ports.
  for (const [n, key] of Object.entries(map.spawnPoints ?? {})) {
    const [x, y] = at(key);
    g.fillStyle = 'rgba(255,248,220,.92)';
    g.beginPath();
    g.arc(x + S * 0.5, y - S * 0.45, 26, 0, Math.PI * 2);
    g.fill();
    label(g, n, x + S * 0.5, y - S * 0.45, 30, '#6b3b10', 900);
  }
  for (const [key, colour] of Object.entries(ports)) {
    const [x, y] = at(key);
    hexPath(g, x, y, S * 0.88);
    g.strokeStyle = colour;
    g.lineWidth = 16;
    g.stroke();
    label(g, '⚓ PORT', x, y + S * 0.6, 26, '#fff');
  }
  return { info, canvas };
}
