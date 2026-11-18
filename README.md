# Mammoth Sea Battles

A board game in design, with a companion online version.

## Project aims

1. **Design and test the board game rules** — rules spec, player-facing instructions, playtesting.
2. **Playable online version** (own site + Board Game Arena) — free, complements the physical game; its main job is to **teach the game** and drive sales of the physical game.
3. **Reusable board game engine** — for future games.
4. **Online turn-based infrastructure** — how to build, host and run turn-based multiplayer.

## Documents

- [`docs/HANDOVER.md`](docs/HANDOVER.md) — **start here**: current state, conventions and next steps

- [`docs/rulebook.md`](docs/rulebook.md) — player-facing rulebook (playtest draft)
- [`docs/web-spec.md`](docs/web-spec.md) — digital version spec: requirements, architecture, UI, testing
- [`docs/engineering-design.md`](docs/engineering-design.md) — engineering design for v1 (draft for review)
- [`docs/v1-gaps.md`](docs/v1-gaps.md) — what v1 still needs: art, design inputs, engineering
- [`docs/ui/wireframe-evaluation.md`](docs/ui/wireframe-evaluation.md) — UI wireframes (4 layouts) and evaluation

- [`docs/online-version.md`](docs/online-version.md) — online version goals and teaching approach

- [`docs/rules.md`](docs/rules.md) — working rules specification (source of truth)
- [`docs/core-rules-summary.md`](docs/core-rules-summary.md) — core rules on one page
- [`docs/research/roborally.md`](docs/research/roborally.md) — notes on RoboRally, the reference game
- [`docs/research/full-metal-planete.md`](docs/research/full-metal-planete.md) — tide mechanic reference

## Code

TypeScript monorepo (see [`docs/web-spec.md`](docs/web-spec.md) §3).

| Package | Purpose |
|---|---|
| `packages/engine` | Generic board-game kernel: seeded RNG, decisions during resolution |
| `packages/hex` | Flat-topped hex grid maths: directions, distance, lines, broadside wedges |
| `packages/msb-rules` | Mammoth Sea Battles rules: sailing and wind, damage dice, initiative, ship and crew damage, cannon fire |

```sh
npm install
npm test            # run tests
npm run check       # type-check + tests with the 100% coverage gate (as in CI)
```

Rules code must be pure and deterministic: `test/purity.test.ts` fails the build if engine or rules code uses
`Math.random`, the clock, the DOM, the network or Node I/O.
