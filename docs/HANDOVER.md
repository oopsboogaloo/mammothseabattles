# Handover: state of the project

For the next working session (which will have access to all the art). Written at the end of the first design session.

## Where things are

| Document | What it is | State |
|---|---|---|
| [`rules.md`](rules.md) | **Design spec: the source of truth for the rules.** Every rule, decision log, prioritised open questions, change log. | v0.127, core game fully specified; currents illustrated |
| [`rulebook.md`](rulebook.md) | Player-facing rulebook written from the spec | Playtest draft 0.2, matches spec v0.111 (not yet the current examples or board categories) |
| [`core-rules-summary.md`](core-rules-summary.md) | Core rules on one page | From spec v0.107 |
| [`web-spec.md`](web-spec.md) | Digital version: roadmap, NFRs, architecture, UI, testing | Draft 0.1 + decisions since |
| [`engineering-design.md`](engineering-design.md) | **Engineering design** for v1: state, resolution, movement, map format, events, views, client | **v1.0, approved 2026-11-19** (D1–D7 as recommended) |
| [`implementation-plan.md`](implementation-plan.md) | **Plan to a two-player hot-seat prototype**: steps P1–P9 | **Current work** |
| [`v1-gaps.md`](v1-gaps.md) | What v1 still needs: art list, design inputs, engineering | 2026-11-18 |
| [`online-version.md`](online-version.md) | Product goals of the free online version, BGA research, mid-resolution prompts | Draft |
| [`ui/wireframe-evaluation.md`](ui/wireframe-evaluation.md) | 4 wireframe layouts, scores, **layout A chosen** (bottom dock, fanned hand) | Done |
| [`suggestions.md`](suggestions.md) | Ideas for the designer to consider (not rules): 15 equipment cards so far | Open |
| [`research/`](research/) | RoboRally and Full Metal Planète reference notes | Done |
| `packages/` | Engine skeleton: seeded RNG, decisions, hex maths, first rules; 100% coverage gate | M1 started |
| [`ui/mockup/README.md`](ui/mockup/README.md) | **Clickable mock-up of layout A with the real art** (`packages/client`, `npm run mockup`); checks, screenshots, questions found in the art | Built; **approved by the designer (2026-11-18)**; to test with the family |
| [`../tools/ship-pipeline/`](../tools/ship-pipeline/README.md) | Blender ship model → web GLB (9k and 2.6k triangles) | Done |

## Working conventions (agreed with the designer)
- **Rules spec first.** Every answer from the designer goes into `rules.md` straight away: rule text in its section, open question struck
  through with the answer, a change-log line, and the version bumped. Assumptions are marked ❓ and confirmed later.
- **Ship vs player vs team**: always explicit (pillar P7). A player can command 2 ships; teams share port and goals.
- **Code**: TypeScript monorepo; rules are pure and deterministic (no `Math.random`, clock, DOM, network; enforced by `test/purity.test.ts`);
  every number in `packages/msb-rules/src/config.ts`; **100% line and branch coverage** (`npm run check`); tests tagged with rule sections.
- The designer likes **concise answers with references**, and prefers searching to guessing.

## Next steps
0. **Build the hot-seat prototype** following [`implementation-plan.md`](implementation-plan.md) (P1 kernel → P8 client → P9 play-test).
   The engineering design was approved on 2026-11-19.
1. **Test the mock-up with the designer's family** ([`ui/mockup/README.md`](ui/mockup/README.md), "What to watch for"). It was built
   on 2026-11-18 with all the real cards, weather, maps and the ship model, and passes the no-scroll/target/font checks at 1920×1080
   and 1024×768. Not yet tried on a real iPad.
2. **Answer the questions the art raised** (mock-up README, "Questions for the designer"): the two 360 cards; the Anchor, Row and Hard About
   orders; flat-topped hexes on the printed maps (Q18); the Lightning Storm and Hurricane weather cards. Then put the answers in `rules.md`.
3. **Engine (M1)**: turn loop (program → Parts I–III → Upkeep), movement with pushing, portals and caves, terrain and tides, then Treasure Hunt,
   then AI and the simulation CLI. **Players/teams/ships separate from day one (NFR-13).**
4. **Waiting on the designer**: the **current-types diagram** (turning amounts, eddies, gyres, maelstrom) and the **board tile diagram**
   (sets the map data format).
5. Keep `rulebook.md` and `core-rules-summary.md` in step with `rules.md` (both match v0.107).

## Biggest open rules questions (see `rules.md` "Open questions")
- Current diagram details (Q20/Q19); board tiles (Q18); critical hits are a placeholder; the full command card list and the crew deck (≥ 50 cards).
- Smaller: knocking treasure loose with no empty adjacent hex; "haul her out" for stranded ships; Race/Deathmatch/Capture the Flag details;
  timed-game tie-break.
