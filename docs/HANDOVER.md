# Handover: state of the project

For the next working session (which will have access to all the art). Written at the end of the first design session.

## Where things are

| Document | What it is | State |
|---|---|---|
| [`rules.md`](rules.md) | **Design spec: the source of truth for the rules.** Every rule, decision log, prioritised open questions, change log. | v0.87, core game fully specified |
| [`rulebook.md`](rulebook.md) | Player-facing rulebook written from the spec | Playtest draft 0.1 (behind the spec: no teams/Fleets yet) |
| [`core-rules-summary.md`](core-rules-summary.md) | Core rules on one page | From spec v0.81 |
| [`web-spec.md`](web-spec.md) | Digital version: roadmap, NFRs, architecture, UI, testing | Draft 0.1 + decisions since |
| [`online-version.md`](online-version.md) | Product goals of the free online version, BGA research, mid-resolution prompts | Draft |
| [`ui/wireframe-evaluation.md`](ui/wireframe-evaluation.md) | 4 wireframe layouts, scores, **layout A chosen** (bottom dock, fanned hand) | Done |
| [`research/`](research/) | RoboRally and Full Metal Planète reference notes | Done |
| `packages/` | Engine skeleton: seeded RNG, decisions, hex maths, first rules; 100% coverage gate | M1 started |

## Working conventions (agreed with the designer)
- **Rules spec first.** Every answer from the designer goes into `rules.md` straight away: rule text in its section, open question struck
  through with the answer, a change-log line, and the version bumped. Assumptions are marked ❓ and confirmed later.
- **Ship vs player vs team**: always explicit (pillar P7). A player can command 2 ships; teams share port and goals.
- **Code**: TypeScript monorepo; rules are pure and deterministic (no `Math.random`, clock, DOM, network; enforced by `test/purity.test.ts`);
  every number in `packages/msb-rules/src/config.ts`; **100% line and branch coverage** (`npm run check`); tests tagged with rule sections.
- The designer likes **concise answers with references**, and prefers searching to guessing.

## Next steps
1. **Clickable mock-up of layout A** (web-spec §4.2) with the **real art**: fanned hand of real command cards, ship board art with damage
   markers, weather board, crew cards, example board as a flat tabletop in gentle perspective (**flat-topped hexes**), placeholder or real ships.
   Include the ship switcher for Fleets/teams. Test at 1920×1080 and 1024×768, no scrollbars. Then test with the designer's family.
2. **Ship model pipeline**: OBJ (high-poly, separate parts, no textures) → simplified GLB (~10k triangles), simple materials, sails take the
   player colour, sail state shown by the sail parts (web-spec §3.6).
3. **Engine (M1)**: turn loop (program → Parts I–III → Upkeep), movement with pushing, portals and caves, terrain and tides, then Treasure Hunt,
   then AI and the simulation CLI. **Players/teams/ships separate from day one (NFR-13).**
4. **Waiting on the designer**: the **current-types diagram** (turning amounts, eddies, gyres, maelstrom) and the **board tile diagram**
   (sets the map data format).
5. Bring `rulebook.md` up to date with spec v0.87 (Teams §8.6, Fleets §8.7, rough water and storm, setup).

## Biggest open rules questions (see `rules.md` "Open questions")
- Current diagram details (Q20/Q19); board tiles (Q18); critical hits are a placeholder; the full command card list and the crew deck (≥ 50 cards).
- Smaller: knocking treasure loose with no empty adjacent hex; "haul her out" for stranded ships; Race/Deathmatch/Capture the Flag details;
  timed-game tie-break.
