# Mammoth Sea Battles: Engineering Design

> **Draft 0.1, for the designer's review.** It turns the architecture outline in [`web-spec.md`](web-spec.md) §3 into a design that can be built from.
> Scope: **v1 = M1 engine + M2 local play** (web-spec §1): browser game, 2–4 ships, pass-and-play humans and AI, core rules + Treasure Hunt.
> Rules are in [`rules.md`](rules.md) (source of truth). The implementation plan follows this document and is not written yet.
>
> **Decisions that need the designer** are marked **D1–D7** and listed in §13. Everything else is a proposal that stands unless challenged.

## 1. What exists today

| Area | State | Reference |
|---|---|---|
| `engine` | Seeded RNG; a pending-decision type. No state, phases, events or views yet. | `packages/engine/src` |
| `hex` | Flat-topped hex maths: directions, distance, lines, broadside wedges. | `packages/hex/src/hex.ts` |
| `msb-rules` | Isolated pure functions: sail move and points of sail, drift, damage die, initiative order, ship-board slots, crew damage, broadside targets. **No game state and no turn loop.** | `packages/msb-rules/src` |
| `client` | The layout A **mock-up**. It has its own throwaway game model and turn loop (`game.ts`); only sailing, damage dice and arcs come from `msb-rules`. | `packages/client/src`, [`ui/mockup/README.md`](ui/mockup/README.md) |
| `msb-data`, `msb-ai`, `sim` | Not started. | web-spec §3.1 |
| Quality gates | 100% line and branch coverage on engine, hex and rules; purity test; CI also builds the mock-up. | `vitest.config.ts`, `test/purity.test.ts`, `.github/workflows/ci.yml` |

So the principles are settled and tested, but the design of the game itself (state, resolution, board data, events, client structure) is not written down anywhere. That is what this document covers.

## 2. Packages and dependencies

Unchanged from web-spec §3.1: `engine ← hex ← msb-rules ← msb-ai / sim / client`, plus `msb-data` (content) read by `msb-rules`.

| Package | Owns | May use |
|---|---|---|
| `engine` | Game definition interface, action log, replay, RNG, decisions, views, events (all generic) | nothing |
| `hex` | Grid maths | nothing |
| `msb-data` | Cards, weather, crew, treasure map cards, maps, scenarios, as data with validators | `hex` (types) |
| `msb-rules` | State, setup, turn loop, every rule, legal actions, views, ghost preview | `engine`, `hex`, `msb-data` |
| `msb-ai` | AI players | `msb-rules` (views and legal actions only) |
| `sim` | Batch runner and statistics. The only package allowed Node I/O. | all of the above |
| `client` | Session, presentation, 3D table, UI | all of the above |

The purity test extends to `msb-data` and `msb-ai`.

## 3. Domain model

**Teams, players and ships are separate from the first line of code (NFR-13).** A team has 1+ players; a player (seat) commands 1–2 ships; rules that count use ships (rules §8.6).

```ts
type TeamId = string; type PlayerId = string; type ShipId = string; type CardId = string; type CrewId = string;

interface GameState {
  readonly setup: Setup;            // scenario id, seats, modules on/off, rules config, seed. Never changes.
  readonly rng: RngState;
  readonly turn: number;
  readonly phase: Phase;            // 'setupHeadings' | 'programming' | 'resolving' | 'upkeep' | 'over'
  readonly teams: Record<TeamId, Team>;       // score, home port hex
  readonly players: Record<PlayerId, Player>; // team, kind (human | ai level), ship ids
  readonly ships: Record<ShipId, Ship>;
  readonly decks: { command: CardId[]; crew: CrewId[]; treasureMap: number[] };
  readonly weather: WeatherCircuit; // 6 spaces, index of "now" (also gives the tide)
  readonly tokens: { treasures: Treasure[]; wrecks: Wreck[] };
  readonly resolution?: Resolution; // only while resolving, see §5
  readonly winner?: TeamId;
}

interface Ship {
  readonly id: ShipId; readonly player: PlayerId;
  readonly pos: Hex; readonly heading: Direction; readonly sail: SailLevel;
  readonly status: 'afloat' | 'stuck' | 'refitting';   // sunk ships respawn at once, so there is no 'sunk' state
  readonly hand: CardId[];
  readonly program: Partial<Record<SlotKey, CardId>>;  // 9 slots
  readonly blocked: SlotKey[];                          // damage markers
  readonly crew: CrewMember[];                          // open information
  readonly carrying: boolean;                           // treasure
}
```

- State is plain JSON: no classes, Maps, Sets or functions, so it can be saved, sent to a server and compared in tests.
- The **board is not in the state**. It is static data looked up by scenario id; only things that move or change live in the state. The tide is derived from the weather circuit.
- Every number comes from `RulesConfig` (already in `msb-rules/src/config.ts`).

## 4. Engine kernel

The kernel knows nothing about ships (NFR-8). A game plugs in by implementing one interface:

```ts
interface GameDef<State, Action, View, Event, Setup> {
  init(setup: Setup): State;
  /** Who may act now, and what they may do. Empty for every player = automatic step or game over. */
  legalActions(state: State, player: PlayerId): Action[];
  /** Pure. Throws on an illegal action. */
  apply(state: State, player: PlayerId, action: Action): { state: State; events: Event[] };
  view(state: State, player: PlayerId): View;
  result(state: State): { winner: string } | undefined;
}
```

- **A game is its setup plus its action log.** `replay(def, setup, log)` rebuilds any state. This one mechanism gives save files, replays, bug reports, and the deterministic tests (NFR-3).
- **Simultaneous programming**: several players have legal actions at once; the phase ends when every ship is marked ready.
- **Events** are returned from `apply`, never stored in the state. Each carries enough data to animate and caption it without reading the state (§8).
- The kernel also provides the action-log type, a schema version stamp, and helpers for shuffling and drawing with the state's RNG.

## 5. Resolution and decisions in the middle of it

This is the hardest design point. Resolution must be able to **stop, ask one player a question, and resume**, deterministically (online-version.md), while the state stays plain JSON.

**Proposal (D1): re-run from the start of the turn.**
- When the last ship is ready, the state keeps a **snapshot of the turn start** and an empty **list of answers**.
- Resolution is written as ordinary straight-line code, one function per phase, in the order of rules §5.2. When a rule needs a choice it calls `ask(decision)`.
- If the answer list already has an answer for that question, `ask` returns it and resolution continues. If not, resolution stops and the state records the pending decision.
- When the player answers, the answer is appended and the turn is **re-run from the snapshot**. It follows exactly the same path (same RNG, same answers) and gets one question further. Only events after the previous stopping point are emitted.

| | Re-run from snapshot (proposed) | Explicit step queue (alternative) |
|---|---|---|
| Rules code | Reads like the rulebook: one function per rules section | Every rule split into resumable steps with a hand-written cursor |
| Serialisable | Yes: snapshot + answers | Yes: cursor + queue |
| Cost | The turn is recomputed once per decision. Target is < 50 ms per turn (NFR-11), so a turn with 10 decisions costs well under a second in total | Each step runs once |
| Risk | Any hidden non-determinism breaks it. The purity test and replay tests already guard this | More code, more branches to cover at 100% |
| Port to Board Game Arena | Needs translating to BGA states by hand | Maps more directly to BGA states |

I recommend re-running. It keeps the rules readable and testable, which matters more for a game whose rules are still changing. The first rules slice (§12) will prove it with damage placement before anything else depends on it.

**Decisions in v1** (kind, who, default on timeout):

| Decision | Who | Default | Rule |
|---|---|---|---|
| Starting heading | Each ship's player | Facing away from the map edge | §4 |
| Hold fire on a target | Firing player, only when a rival is in arc | Fire at all | §7.1 |
| Knock treasure loose instead of 1 DD, and where it lands | Attacker, only when the victim carries treasure | Take the DD | §8.2.3 |
| Place Ship damage | Damaged player | Least useful slot (already-resolved Parts first, never completing a row if avoidable) | §7.3 |
| Place Crew damage | Damaged player | Wound before kill; Captain last | §7.4 |
| Refit this turn or not | Ship's player, at Upkeep | Refit if damaged | §7.7 (D5) |
| Crew swap at the cap of 6 | Ship's player | Keep current crew | §3.6 |

Decisions with one legal option are answered automatically and never shown.

## 6. Movement

Rules §5.2 says ships move at the same time and initiative settles conflicts. **Design: ships resolve one at a time in initiative order.** Moves that don't interfere give the same result in any order, and for moves that do interfere this is exactly "the higher moves first, then the other moves against the new situation" (§5.3). It is also how RoboRally resolves, and it avoids a separate conflict detector.

**One function moves a ship one hex**, whatever the cause, because the rules say terrain applies "however a ship gets there" (§3.2.0):

```
stepShip(state, ship, direction, cause: 'sail' | 'push' | 'current' | 'drift' | 'cave')
  1. Edge crossed: wall reef → stop + 2 DD.  Cave mouth → come out of the partner cave facing out (§3.2.2).
  2. Target hex off the map → board-edge rule (Q24, open).
  3. Terrain at the current tide: cliff → stop + 2 DD; beach, dry sandbank, dry reef, stuck ship → stop; death reef → sink.
  4. Occupied by a ship: 'sail' and 'cave' push her with the same function (chains; first ship rammed takes 1 DD; no DD for a teammate).
     'current' and 'drift' stay put.
  5. Move. Whirlpool → jump to the partner unless it is occupied (§3.2.1). Treasure in the hex → pick up if not carrying.
  returns: moved | stopped, plus events
```

| Phase | How it uses `stepShip` |
|---|---|
| Move | Ships in Sail-slot initiative order. Each takes her whole sail move hex by hex and stops early if stopped. Gale DD per Full Sail. |
| Steer | All ships turn. No conflicts possible. |
| Currents | Three sub-steps (triple; double + triple; all). In each, ships on an active current step once, in Sail-slot initiative order. |
| Action | Ships in Action-slot initiative order: fire (with decisions), repair, heal. Then port guns. Sinking is applied at once, so a sunk ship does not fire. |
| Drift | If the wind drifts in this Part, each ship steps once downwind, in Sail-slot initiative order. |
| End of Part | Rough water 2 DD, storm 3 DD. |

Stuck and refitting ships skip Move, Steer, Currents and Drift. The **ghost preview** runs the same code on a copy of the state containing only that ship, so the preview and the real rules cannot drift apart (today the mock-up has its own copy of this logic).

## 7. Board and content data (`msb-data`)

### 7.1 Map format
The mock-up's map files hold only the art alignment (hex size, origin, list of hexes). v1 needs the rules content of each hex. Proposed format, one JSON file per map:

```jsonc
{
  "id": "two-isles",
  "art": { "image": "maps/two-isles.webp", "size": 126.339, "originX": 133.763, "originY": 205.443 },
  "hexes": {
    "4,7": { "terrain": "sea" },
    "5,7": { "terrain": "sandbank" },
    "6,7": { "terrain": "sea", "current": { "strength": 2, "dir": "NE", "turn": 0 } },
    "7,7": { "terrain": "sea", "eddy": "cw" },
    "8,7": { "terrain": "sea", "portal": 1 },
    "9,7": { "terrain": "cliff", "caves": [{ "edge": "SW", "letter": "A" }] },
    "3,2": { "terrain": "sea", "fog": true }
  },
  "wallReefs": [["4,6", "NE"]],
  "spawnPoints": { "1": "6,3", "2": "10,11" },
  "homePorts": ["0,4", "12,10", "4,13", "8,2"],
  "startWrecks": ["2,3"]
}
```

- `terrain`: `sea | cliff | beach | sandbank | underwaterReef | deathReef | roughWater | storm` (rules §3.2.0). Land and sea are one field so a hex can never be both.
- Hexes are keyed by axial coordinates (`hex` package). Edges are named by hex + direction.
- A validator checks: portals and caves come in pairs, currents don't point off the map, 9 spawn points, home ports on the edge, every hex in the art has an entry.
- **Currents store the exact effect, never inferred from the art** (rules §6.6): each arrow's step direction and `turn` in hex sides
  (signed, + clockwise), e.g. curved arrow `turn: ±1`; corner ring (3-hex rotor) `turn: ±2`; eddy `{ "eddy": "cw", "turn": 1 }` (or 2, Q63) with no step;
  rotors as a group of hexes with a centre and an angle, moved together. Dashed eddies, gyres and the maelstrom may still add fields (Q20).
- Whether a board is one printed map or several tiles joined (Q18) does not change this format: tiles would be assembled into one map file by a build step.

**Authoring (D2).** Three maps of roughly 120 hexes each must be transcribed from the printed art. I propose a small **map painter**, a developer-only page in the client that shows the map art with the grid, lets you click hexes and edges to set terrain and features, and saves the JSON. It then doubles as the tool for checking the transcription with the designer. The alternative is typing the JSON by hand, which is slower and error-prone.

### 7.2 Other content
| Content | Source | Notes |
|---|---|---|
| Command cards | `data/cards/command-cards.csv` (45 cards) | Replaces the copy in `client/src/data/content.ts`. Needs the answers on the two 360s, Anchor, Row and Hard About (mock-up README, questions 1–2) |
| Weather cards | `data/cards/weather-cards.csv` (28 cards) | Lightning Storm and Hurricane need rules (question 4) |
| Crew | Captain (draws 3 cards) and basic crew; core game has no powers (rules §9) | The core crew deck list is a rules gap (Q48) |
| Treasure map cards | 1–9 | |
| Scenarios | Map + seat count + home ports used + wrecks + win target | One per map and player count to start |

**Cards are authored as CSV files in [`data/cards/`](../data/cards/README.md)**, one per card type, so the designer can edit them in Excel.
A build step in `msb-data` reads the CSVs, validates them and generates typed TypeScript modules; the engine and client import those
modules and never parse CSV at run time. Maps and scenarios stay as JSON (§7.1). Validation runs in tests and at build time (web-spec §5). I propose plain validator functions rather than a schema library, to keep the pure packages free of dependencies.

## 8. Events

Events are the only thing the client animates and the only source of teaching captions. Each has a type, the rule section it comes from, and the data needed to show it.

| Group | Events |
|---|---|
| Turn | `TurnStarted`, `ProgramsRevealed`, `PartStarted`, `PhaseStarted`, `UpkeepStarted`, `GameWon` |
| Movement | `SailSet`, `ShipSailed` (from, to, point of sail, wind, hexes), `ShipTurned`, `ShipPushed`, `ShipStopped` (by what), `ShipCarriedByCurrent`, `ShipSpun`, `ShipDrifted`, `Teleported`, `WentThroughCave`, `ShipStranded`, `ShipFreed` |
| Combat | `CannonFired` (targets, spared), `PortGunsFired`, `DamageRolled` (source, faces), `SlotBlocked`, `CrewWounded`, `CrewKilled`, `SlotRepaired`, `CrewHealed`, `ShipSank`, `ShipReturned` |
| Objects | `TreasureSpawned`, `TreasurePickedUp`, `TreasureKnockedLoose`, `TreasureScored`, `WreckPlaced`, `WreckSearched`, `CrewGained`, `ShipRefitted` |
| Cards and weather | `CardsDrawn` (count; ids only in the owner's view), `WeatherAdvanced`, `TideChanged` |
| Decisions | `DecisionRequested`, `DecisionAnswered` |

Events that reveal hidden information (which cards were drawn) are filtered per player by the same `view` rules as the state.

## 9. Views and hidden information

`view(state, player)` returns the state with these removed or reduced (web-spec §3.2, rules §7.10):

| Thing | What a player sees |
|---|---|
| Own ships' hands and programs | Everything |
| Teammates' hands and programs | Everything, read-only (rules §8.6) |
| Rivals' hands | Card count only |
| Rivals' programs | Which slots are filled; cards are shown when revealed (Q28 decides all at once or per Part) |
| Decks | Counts only; never the order; the top treasure map card is hidden |
| RNG state | Removed |
| Crew, damage, sail, treasure, weather and the next two cards | Open to everyone |

The AI and the UI receive only views. In pass-and-play the device holds the full state, so the client shows a **hand-over screen** between players (web-spec W2) and renders strictly from the current player's view.

## 10. AI and simulation

```ts
interface AiPlayer { choose(view: View, options: Action[], rng: Rng): Action; }
```

- The AI gets a view and the legal actions and returns one of them. It answers mid-resolution decisions through the same call.
- It has its own RNG stream, seeded from the game seed and the seat, so games with AI are still reproducible.
- **Random** picks a random legal program (used for fuzz tests from the first rules slice). **Basic** scores candidate programs with the ghost preview (web-spec §3.4). **Good** (Monte Carlo) is after v1.
- Programming is one action per card placement plus "ready", so the UI's undo is just removing a placement. The AI submits a whole program with a helper that expands to those actions.
- `sim` runs games in a loop and writes one row per game (web-spec §3.5). It is also the performance test for NFR-11.

## 11. Client

```
ui (panels, cards, menus)  ─┐
table (Three.js board)     ─┼─ presenter ── session ── engine + rules + AI
```

| Layer | Job |
|---|---|
| **Session** | Owns the game: setup, action log, current state, AI seats, save and load. Its interface is asynchronous messages (send an action; receive a view and events), the same shape a server connection will have in M4, so online play replaces the session, not the UI. |
| **Presenter** | Turns events into a timeline of animations and captions with play, pause, step, speed and skip. Keeps a small "display state" updated event by event, so the board can show the middle of a turn. |
| **Table** | The existing Three.js scene (`table.ts`): board, ships, tokens, overlays. Kept from the mock-up. |
| **UI** | Dock, hand, ship board, weather, rivals, crew, menus, hand-over, start and end screens. |

- **The mock-up's `game.ts` is deleted.** Its turn loop, AI and ghost preview are replaced by the real engine. `table.ts`, the CSS, the art pipeline and the layout checks carry over.
- **UI framework (D3).** The mock-up is framework-free TypeScript in one 836-line file. v1 adds a start screen, hand-over, tutorial, end screen and component tests (web-spec §6), which that structure will not carry. web-spec §3.6 proposed React. I recommend React for the overlay only; the 3D table stays plain Three.js.
- **AI off the main thread.** The session runs AI turns in a Web Worker so the board never freezes; needed for the Good AI later, cheap to do now because the session is already message-based.
- **Saving.** A save is the setup plus the action log, stored in the browser (IndexedDB), written after every action. Loading replays it. Saves are stamped with the rules version; a save from an older rules version is refused rather than replayed wrongly.
- **Offline.** A service worker caches the app and art after first load (web-spec §3.6).
- **Rendering engine (D4).** The mock-up already runs on Three.js. web-spec §3.6 planned to measure Three.js against Babylon.js on real devices first. I recommend keeping Three.js and measuring only frame rate on a real iPad and the Galaxy Note with 8 ships; that test has not been done yet.

## 12. Testing

As web-spec §6, with these additions that follow from the design:

- **Rules slices are built in the order of a turn**, each with tests tagged by rules section, and each kept at 100% coverage.
- **Scenario files** (language-neutral JSON): map fragment + ships + programs + answers + seed → expected positions, damage and event types.
- **Replay test**: every fuzz game is replayed from its log and must produce an identical state. This is what protects the re-run design in §5.
- **Invariants** checked after every action in fuzz games: at most one ship per hex, cards conserved across deck, hands and boards, hand ≤ 9, crew ≤ 6, no ship on dry land unless stuck.
- **Client**: the existing layout checks (no scroll, target size, font size) stay; add one Playwright test that plays a whole game against AI.

## 13. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| **D1** | Resolution: re-run from the turn snapshot, or an explicit step queue (§5) | Re-run |
| **D2** | Build a map painter to transcribe the maps (§7.1) | Yes |
| **D3** | UI framework for the overlay (§11) | React |
| **D4** | Keep Three.js without a Babylon.js comparison (§11) | Keep, measure on real devices |
| **D5** | Is refitting optional when a ship ends the turn in port? Rules §7.7 says she "can" refit | Optional (a decision at Upkeep) |
| **D6** | Reveal all 9 cards at once or Part by Part (rules Q28). Affects views and events | Part by Part: keeps later Parts hidden, as in RoboRally |
| **D7** | v1 ship count: 2–4 only, or up to 8. The 45-card deck covers 4 ships (4 × 9 = 36 cards out at most); 8 ships can need 72 | 2–4 for v1 |

## 14. Rules gaps the design depends on

These are rules questions, not engineering ones. Where no answer exists the engine will use the assumption shown, kept in `RulesConfig` or behind one function so it is cheap to change.

| Gap | Blocks | Working assumption |
|---|---|---|
| **Current diagram** (Q20/Q19): turning, eddies, gyres, maelstrom | Currents phase; map data | Straight currents only until it arrives |
| **Map contents**: terrain, spawn points, home ports for each printed map (Q18, Q44) | All play on real maps | Transcribe from the art, designer checks |
| Board edge (Q24) | `stepShip` | Edge stops the ship, no damage |
| Anchor, Row Ahead/Back, Hard About, the two 360s | Card data | The mock-up's assumptions (mock-up README) |
| Lightning Storm, Hurricane, New Weather Front, how the circuit refills (Q37) | Weather | Leave the two storm cards out of the v1 deck |
| Core crew deck list (Q48); recruits at refit | Setup, refit, wrecks | Captain + Pirates only |
| Used cards: shuffled in or discard pile (Q7); draw past 9 | Deck | Discard pile, reshuffled when the deck runs out; stop at 9 |
| Gale DD per Move phase or per turn (Q38) | Move phase | Per Move phase at Full Sail |
| Return after sinking: hand, heading, sail (Q16) | Sinking | Keeps hand; No Sail; player chooses heading |
| Number and place of starting wrecks (Q50) | Scenarios | Per scenario |
| Knock loose with no empty adjacent hex (Q44) | Decision options | Option not offered |

## 15. Risks

| Risk | Mitigation |
|---|---|
| Rules still changing under the code | Rules in small modules mapped to sections; numbers in config; the re-run design keeps each rule in one place |
| Currents redesign after the diagram | Currents are one phase function and a few map fields |
| Map transcription errors | Painter with overlay on the art; validator; designer review |
| iPad performance never measured on a device | Measure before building the v1 client (D4) |
| 100% coverage slowing rule changes | Scenario files cover most branches cheaply; keep helpers small |
