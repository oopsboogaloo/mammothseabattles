# Implementation plan: two-player hot-seat prototype

> Written 2026-11-19, after the designer approved [`engineering-design.md`](engineering-design.md) (D1–D7).
> **Goal:** two people play a whole **Treasure Hunt** on one device, taking turns (hot-seat), with the **real rules engine** underneath the
> approved layout A mock-up. Then a family play-test on PC and iPad.
> Rules source of truth: [`rules.md`](rules.md) v0.127.

## Scope

| In | Out (later) |
|---|---|
| 2 ships, 2 human players, hot-seat with a hand-over screen | AI opponents (the random AI is built only as a test tool), online play |
| Core rules (rules §5–§7) and Treasure Hunt (§8.2) | Equipment, flotsam, the Derelict, crew powers, the sea monster |
| One hand-made **test map** that uses every board feature the prototype supports (not dashed eddies, gyres as a whole or the maelstrom, which aren't defined yet) | Real boards (still being designed, rules §3.1.1); the map painter (D2); the map generator (web-spec §5.1) |
| The mock-up's UI, rewired to the engine | React (D3), saving, offline, tutorial: these come with the v1 client |

**Why keep the mock-up's UI for now:** moving to React (D3) before anyone has played the real rules would delay the play-test by weeks.
The prototype's job is to test the **rules**. The React move happens in the v1 client, reusing the session and presenter built here.

## Steps

Each step is one pull request, fully tested (100% coverage, rules-section tags) and merged before the next.

| # | Step | What it delivers | Rules |
|---|---|---|---|
| **P1** ✅ | **Kernel and the re-run design (D1)** | `GameDef` interface, action log and `replay`; game state with teams, players and ships kept separate; setup on a test map; resolution with `ask()` and re-run from the turn snapshot, proved on **damage placement** (a Ship or Crew damage choice mid-turn) | §5, §7.2–7.4 |
| **P2** | **Programming** | Deal from crew icons, place and take back cards, ready, reveal Part by Part (D6), discard down to 9, used cards to the deck bottom. A **random player** (legal random programs) for fuzz tests | §5.1 |
| **P3** | **Movement** | `stepShip` (engineering design §6); Move with pushing and ramming; Steer; wind drift; terrain at each tide; board edge; whirlpools; caves; stranding | §3.2, §5.2, §6 |
| **P4** | **Currents** | The three sub-steps; straight, curved, rotors (2-, 3- and 4-hex), eddies (60/120/180°), jumps to non-adjacent hexes; blocked = stay put | §6.6 |
| **P5** | **Action and damage** | Cannon fire with "hold fire", repair, heal, port guns, sinking, and return at Upkeep (the player chooses the heading) | §7 |
| **P6** | **Upkeep and Treasure Hunt** | Refit (optional and partial, D5), wrecks, treasure spawn, pickup, knocking loose, scoring, the win; weather and tide advance; Gale damage; draw | §5.4, §8.2 |
| **P7** | **Content data** (`msb-data`) | Command and weather cards generated from the CSVs in `data/cards/`; crew cards (Captain, Pirate) and treasure map cards 1–9; the test map as JSON with a validator | engineering §7 |
| **P8** | **Hot-seat client** | Session and presenter (engineering §11) replace the mock-up's `game.ts`; start screen (2 players, names), **hand-over screen**, decisions shown to the right player, end screen | web-spec §4 |
| **P9** | **Play-test** | Family game on PC and iPad; findings back into `rules.md` and this plan | |

**Done in P1:** `engine` has `GameDef`, `replay` and the re-run resolution (`resolution.ts`); `msb-rules` has the game state, setup,
the ready → resolve → next turn loop, and end-of-Part rough water and storm damage with Ship and Crew damage placement asked of the
damaged ship's player (defaults: never complete a row if avoidable; wound before kill, Captain last). A sunk ship stays sunk until
P5 adds the return at Upkeep.

P7 can run alongside P3–P6. From P2 on, every step adds to a **fuzz test**: thousands of random games, each replayed from its log and
checked against the invariants (engineering §12).

## Questions the prototype needs answered

These come from the art (mock-up README, "Questions for the designer") and are **not yet in `rules.md`**. The prototype uses the
mock-up's assumptions until they're answered, each kept in one place so it is cheap to change.

| Question | Assumption used |
|---|---|
| ~~**Anchor**~~ | **Answered (rules v0.129):** No Sail plus no movement of any kind (sailing, pushing, drift, currents); turning allowed (only Steer turns her); ramming her stops the mover and she takes the 1 DD; lasts for its Part (Q67). Also: **sail level is no longer persistent**, an empty Move slot means No Sail for that Part |
| ~~**Row Ahead 1 / Row Back 1**~~ | **Answered (v0.131):** 1 hex ahead or astern whatever the wind, at No Sail; pushes and rams (Q68) |
| ~~**Hard About**~~ | **Answered (v0.131):** turn 180° |
| ~~**Two cards numbered 360**~~ | **Answered (v0.131):** `360b` (Row Ahead 1 / Hard About / Repair) is **380**. P7 sets it in `msb-data` until the designer corrects the CSV and card art |
| **Lightning Storm** and **Hurricane** weather cards | Left out of the deck |
| **How the weather board refills** (rules Q66) | The card leaving "now" is discarded and the space gets the top card of the weather deck; New Weather Front reshuffles and deals 6 new cards (engineering design §14) |

## After the prototype

1. The family play-test findings.
2. The basic AI and the simulator (web-spec §3.4–3.5), so one person can play.
3. The v1 client: React overlay (D3), saving, offline, tutorial, iPad frame-rate test (D4).
4. Real boards, then the map painter (D2) and the map generator (web-spec §5.1).
