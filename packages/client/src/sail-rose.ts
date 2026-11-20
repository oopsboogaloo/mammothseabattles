/**
 * The weather card as a Points-of-Sail player aid (rules §3.5, v0.144): the card art in a hex, with the Half / Full Sail move for a
 * ship heading towards each edge printed on that edge, coloured by point of sail. Values come from the rules engine (sailMove), so
 * the card and the game always agree.
 */
import { DIRECTION_NAMES, type Direction } from '@msb/hex';
import { DEFAULT_CONFIG, pointOfSail, sailMove, type PointOfSail, type WeatherCard } from '@msb/msb-rules';

export const POINT_COLOUR: Record<PointOfSail, string> = {
  windward: '#d8432f',
  closeHauled: '#e8a33a',
  broadReach: '#3fae5a',
  running: '#3b82d6',
};
export const POINT_NAME: Record<PointOfSail, string> = {
  windward: 'Windward',
  closeHauled: 'Close hauled',
  broadReach: 'Broad reach',
  running: 'Running',
};

const fmt = (n: number) => (n < 0 ? `←${-n}` : String(n));

/** The SVG for one weather card. `heading` (optional) rings the edge a ship is facing. */
export function sailRose(card: WeatherCard, art: string, heading?: Direction): string {
  const R = 100; // hex radius (corner)
  const corner = (i: number) => [R * Math.cos((Math.PI / 3) * i), R * Math.sin((Math.PI / 3) * i)] as const;
  const hexPts = Array.from({ length: 6 }, (_, i) => corner(i).join(',')).join(' ');
  const inner = 0.72;
  const innerPts = Array.from({ length: 6 }, (_, i) => corner(i).map((v) => v * inner).join(',')).join(' ');
  const wind = card.strength === 'newFront' ? undefined : card.direction;
  let edges = '';
  if (card.strength !== 'newFront') {
    for (let d = 0 as Direction; d < 6; d = (d + 1) as Direction) {
      // Flat-topped hex: edge d sits between corners d+4 and d+5 (N edge between the top-left and top-right corners).
      const [x0, y0] = corner((d + 4) % 6), [x1, y1] = corner((d + 5) % 6);
      const [ix0, iy0] = corner((d + 4) % 6).map((v) => v * inner) as unknown as [number, number];
      const [ix1, iy1] = corner((d + 5) % 6).map((v) => v * inner) as unknown as [number, number];
      const weather = { strength: card.strength, direction: (wind ?? 0) as Direction };
      const point = wind === undefined ? undefined : pointOfSail(d, wind);
      const colour = point ? POINT_COLOUR[point] : '#8a8a8a';
      const half = sailMove('half', d, weather, DEFAULT_CONFIG), full = sailMove('full', d, weather, DEFAULT_CONFIG);
      const mx = ((x0 + x1) / 2) * 0.86, my = ((y0 + y1) / 2) * 0.86;
      const angle = d * 60 + (d >= 2 && d <= 4 ? 180 : 0); // keep text upright
      const mine = heading === d;
      edges += `<polygon points="${x0},${y0} ${x1},${y1} ${ix1},${iy1} ${ix0},${iy0}" fill="${colour}" stroke="${mine ? '#fff' : '#1b130e'}" stroke-width="${mine ? 4 : 1.2}"/>
        <g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${angle})">
          <title>${DIRECTION_NAMES[d]}: ${point ? POINT_NAME[point] : 'no wind'}. Half Sail ${fmt(half)}, Full Sail ${fmt(full)}</title>
          <text x="-15" y="5" text-anchor="middle" class="rose-h">${fmt(half)}</text>
          <text x="0" y="4" text-anchor="middle" class="rose-sep">/</text>
          <text x="15" y="5" text-anchor="middle" class="rose-f">${fmt(full)}</text>
        </g>`;
    }
  }
  return `<svg class="sail-rose" viewBox="-104 -92 208 184" role="img" aria-label="Weather card with sail moves on each edge">
    <defs><clipPath id="rose-clip-${card.id}"><polygon points="${innerPts}"/></clipPath></defs>
    <polygon points="${hexPts}" fill="#1b130e"/>
    <image href="${art}" x="${-R * inner}" y="${-R * inner * 0.866}" width="${2 * R * inner}" height="${2 * R * inner * 0.866}" preserveAspectRatio="xMidYMid slice" clip-path="url(#rose-clip-${card.id})"/>
    ${edges}
  </svg>`;
}
