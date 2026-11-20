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
| **P2** ✅ | **Programming** | Deal from crew icons, place and take back cards, ready, reveal Part by Part (D6), discard down to 9, used cards to the deck bottom. A **random player** (legal random programs) for fuzz tests | §5.1 |
| **P3** ✅ | **Movement** | `stepShip` (engineering design §6); Move with pushing and ramming; Steer; wind drift; terrain at each tide; board edge; whirlpools; caves; stranding | §3.2, §5.2, §6 |
| **P4** ✅ | **Currents** | The three sub-steps; straight, curved, rotors (2-, 3- and 4-hex), eddies (60/120/180°), jumps to non-adjacent hexes; blocked = stay put | §6.6 |
| **P5** ✅ | **Action and damage** | Cannon fire with "hold fire", repair, heal, port guns, sinking, and return at Upkeep (the player chooses the heading) | §7 |
| **P6** ✅ | **Upkeep and Treasure Hunt** | Refit (optional and partial, D5), wrecks, treasure spawn, pickup, knocking loose, scoring, the win; weather and tide advance; Gale damage; draw | §5.4, §8.2 |
| **P7** ✅ | **Content data** (`msb-data`) | Command and weather cards generated from the CSVs in `data/cards/`; crew cards (Captain, Pirate) and treasure map cards 1–9; the test map as JSON with a validator | engineering §7 |
| **P8** ✅ | **Hot-seat client** | Session and presenter (engineering §11) replace the mock-up's `game.ts`; start screen (2–4 players, names), **hand-over screen**, decisions shown to the right player, end screen | web-spec §4 |
| **P9** | **Play-test** | Family game on PC and iPad; findings back into `rules.md` and this plan | |

**Done in P1:** `engine` has `GameDef`, `replay` and the re-run resolution (`resolution.ts`); `msb-rules` has the game state, setup,
the ready → resolve → next turn loop, and end-of-Part rough water and storm damage with Ship and Crew damage placement asked of the
damaged ship's player (defaults: never complete a row if avoidable; wound before kill, Captain last). A sunk ship stays sunk until
P5 adds the return at Upkeep.

**Done in P2:** the command deck (one shared deck, shuffled at setup; card lists come with the setup until P7), dealing one card per
icon on healthy crew, placing and taking back cards (not into damaged slots), discarding down to 9 before ready, rivals' programs hidden
and revealed Part by Part (D6) with teammates seeing each other's hands, used and discarded cards shuffled onto the deck bottom, drawing
at Upkeep, and a random player. Fuzz tests play random games and check that every card is accounted for and that each game replays
exactly. While a turn is paused for a decision, the state shows the turn part-way through.

**Done in P3:** the weather board (6 spaces, random starting space, tide from the space); the Move phase in Sail initiative order with
sailing (points of sail and weather), rowing and Anchor; pushing chains and ramming (1 DD to the first ship hit, none to teammates);
steering; wind drift; terrain at each tide; wall reefs; death reefs; the map edge and the optional Safe edge; whirlpools; sea caves;
Gale damage at Upkeep. Damaged slots' cards are ignored. Caves join two hexes and follow the normal pushing and blocking rules (rules Q69).

**Done in P4:** currents in three sub-steps (triple, then double and triple, then all), in Sail initiative order, each ship moved at most
once per sub-step: straight and curved flows, eddies (60°, 120°, 180°), rotors of any size moving all their ships together (so ships
swap), jumps to non-adjacent hexes that ignore the hexes between, and blocked currents leaving the ship where she is (not turned: Q70, agreed).
Map data stores each current's destination and turn (engineering design §7.1).

**Done in P5:** the Action phase in Action-slot initiative order: Fire Cannons (both broadsides, every enemy in the arcs takes 1 DD,
no friendly fire, the firer may hold fire on each target, fog and whirlpools block), Repair (one marker of the player's choice) and Heal
(one wounded crew member); then every home port's guns (1 DD to rivals within 2 hexes, fog hides). A card in a slot that takes Ship
damage is lost. Sinking leaves a shipwreck; at Upkeep a sunk ship comes back at her port (or a free hex next to it, her player's choice),
heading of her player's choice, repaired, with 3 Pirates and no Captain, and draws a new hand (Q71, answered in v0.142: if her port is occupied, the nearest free hex).

**Done in P6:** the full Upkeep order (§5.4): dig up treasure on land, sunk ships come back, refit (any part; default full if damaged;
costs the next turn), search wrecks (gain a Pirate; swap with a full crew), spawn treasure for each one scored, Gale damage, advance the
weather board (refill, reshuffle, New Weather Front) with tide changes and stranding, then draw. Stuck ships can't move or be moved and
stop others like a beach. In her own port a ship has no drift, storm or Gale; leaving port under sail she always gets 1 hex out. Treasure:
spawning with the treasure map deck, picking up by passing through, digging up on land, knocking loose by ram or cannon instead of the DD,
dropping on sinking, scoring in her own port, and the win at the target (the game ends at once).
*Not in the prototype:* hauling a stranded ship out (§6.7). *Engine assumptions:* the "leaving port" working (Q60); a refitting ship can
still be pushed; a ship already carrying sails through treasure (§8.2.2 ❓).

**Done in P7:** `packages/msb-data` reads the card CSVs (copied into a generated module by `npm run data`, checked by a test) into the
real command deck (45 cards; 360b read as 380), weather deck (26 cards; the two storm cards left out), crew cards and treasure map
cards; a **test map** (radius 5, 91 hexes) with every supported feature and 4 rim ports; and `prototypeSetup(players, seed)` for 2–4
players. Whole random games on the real data run to 60 turns, keep all 45 cards and replay exactly. (Random players mostly sail off the
map edge, so they never score: a job for the AI, and a hint that the Safe edge option suits beginners.)

**Done in P8:** a separate page, `play.html` (`npm run mockup` → `/play.html`), plays the real engine; the layout A mock-up stays as it
was. Start screen (2–4 names, Safe edge option, Resume); the test map is drawn from its data (`board-art.ts`: terrain, fog,
whirlpools, currents by strength, eddies, rotors, caves, wall reef, spawn points, ports). Each turn a **hand-over screen** ("pass the
device to …") guards each player's hand; programming with the real cards (tap a card, then a slot; tap a placed card to take it
back; discard down to 9). After the last Ready the turn's events play back on the table with a running caption (moves, turns,
whirlpools, caves, sinking, returns, broadsides, damage rolls, treasure, Upkeep). Every decision is shown by name to the player who
must make it, with the default marked; hex choices are numbered on the map. End screen with the scores. `Session` saves the action
log to the browser after every action, so a reload resumes the game. Checked by driving 4 full turns in headless Chromium (5 decisions,
resume restores all actions). *Not yet:* ghost preview of the program, broadside arcs, a weather-board view, card zoom.

**After P8 (designer's own play-testing first):** a **Solo Challenge** (rules §8.8: 1 player, 14 turns, score = treasure brought home;
best score kept in the browser), so the designer can play-test alone; name fields readable; the hand shows the card back while a
card picture loads.

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
| ~~**Lightning Storm** and **Hurricane**~~ | **Designer (v0.136): left out of the deck for now** |
| ~~**How the weather board refills**~~ | **Answered (v0.137):** discard the old card, refill from the top of the weather deck, reshuffle the discards when it runs out |

## After the prototype

1. The family play-test findings.
2. The basic AI and the simulator (web-spec §3.4–3.5), so one person can play.
3. The v1 client: React overlay (D3), saving, offline, tutorial, iPad frame-rate test (D4).
4. Real boards, then the map painter (D2) and the map generator (web-spec §5.1).
