/**
 * NFR-1 / NFR-3: engine, hex and rules code must be pure and deterministic, with no clock, no Math.random,
 * no DOM, no network and no Node I/O. This test scans the source so a violation fails the build.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PURE_PACKAGES = ['engine', 'hex', 'msb-rules', 'msb-data'];
const FORBIDDEN: [RegExp, string][] = [
  [/Math\.random/, 'Math.random (use the seeded Rng)'],
  [/\bDate\b/, 'Date (no clock in rules)'],
  [/performance\.now/, 'performance.now'],
  [/\b(window|document|localStorage|sessionStorage)\b/, 'DOM / browser globals'],
  [/\bfetch\(|XMLHttpRequest|WebSocket/, 'network'],
  [/from ['"]node:/, 'Node built-ins'],
  [/\bprocess\./, 'process'],
  [/setTimeout|setInterval/, 'timers'],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('purity of engine and rules code', () => {
  for (const pkg of PURE_PACKAGES) {
    it(`${pkg} uses no clock, randomness, DOM, network or Node I/O`, () => {
      const files = sourceFiles(join('packages', pkg, 'src'));
      expect(files.length).toBeGreaterThan(0);
      const problems: string[] = [];
      for (const file of files) {
        const text = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        for (const [re, what] of FORBIDDEN) if (re.test(text)) problems.push(`${file}: ${what}`);
      }
      expect(problems).toEqual([]);
    });
  }
});
