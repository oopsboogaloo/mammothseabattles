# Mammoth Sea Battles: Digital Version Spec

> Draft 0.1. Complements [`online-version.md`](online-version.md) (product goals) and [`rules.md`](rules.md) (game rules, source of truth).
> **v1 = a locally playable version against AI.** Online play, sign-in and Steam come later, but the architecture must allow them from day one.

---

## 1. Goals and roadmap

| Release | Scope |
|---|---|
| **M0 Design** | Wireframes generated and evaluated; tech spike (3D board on PC, iPad, Galaxy Note) |
| **M1 Engine** | Headless rules engine, 100% test coverage, simulation CLI, basic AI |
| **M2 v1: local play** | Browser game: humans (**pass and play** on one device) and AI players, core rules + Treasure Hunt |
| **M3 Steam** | Desktop build of v1 for Steam |
| **M4 Online** | Play with friends via invite link, **no sign-in**, no matchmaking; AI can fill seats |
| **M5 Accounts** | **Mandatory sign-in** to build an email list (physical game, Kickstarter) |
| Later | Add-on modules, other modes, Board Game Arena port, other board games on the same engine |

Purpose (from `online-version.md`): free, **teaches the game**, drives sales of the physical game.

---

## 2. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Headless.** The full game runs without any UI: every rule, every phase, AI turns. |
| NFR-2 | **Simulation.** A CLI runs thousands of AI-vs-AI games with chosen rules and settings, and outputs statistics (CSV/JSON) for analysis and rule experiments. |
| NFR-3 | **Deterministic.** Same starting state + seed + player inputs → identical game. All randomness comes from a seeded generator held in the game state. Any game can be replayed from its log. |
| NFR-4 | **Test coverage: total.** 100% line and branch coverage of engine, rules and AI, enforced in CI (the build fails below 100%). UI covered by component, end-to-end and visual tests (§8). |
| NFR-5 | **Platforms.** Web on desktop PC (Chrome, Edge, Firefox, Safari) is primary. **iPad (Safari)** supported. Android tablet (Galaxy Note) tested, best effort. **Phones out of scope.** **Steam** desktop build later. Mouse **and** touch. |
| NFR-6 | **One screen.** The game fits a single screen with **no scroll bars**; panels and menus fold out. Must work from 16:9 desktop down to 4:3 iPad. |
| NFR-7 | **It feels like a board game on a table.** A gentle-perspective 3D view of a **flat, printed game board** (the designer's tile art), with the **ships as 3D miniatures** standing on it. **No 3D terrain**: islands, reefs and currents are printed art, just as on the physical board. |
| NFR-8 | **Generic engine.** The core engine knows nothing about ships or the sea. Mammoth Sea Battles is a **rules plug-in**, so future expansions and other board games reuse the engine. |
| NFR-9 | **Online-ready.** The same engine runs on a server later (authoritative, hidden information never sent to the wrong player). |
| NFR-10 | **AI players** use the same interface as humans, and only see what their player can see (no cheating). |
| NFR-11 | **Performance targets** (proposed): resolve a full turn headless in < 50 ms for 8 ships; ≥ 1,000 AI-vs-AI games per minute on a laptop for simulation; 60 fps board on a recent PC, ≥ 30 fps on iPad. |
| NFR-12 | **Accessibility.** Card bands are colour **and** icon coded (already true of the art); check colour-blind safety; readable at iPad size. |

---

## 3. Architecture

### 3.1 Packages (TypeScript monorepo)

```
packages/
  engine/      generic board-game kernel   (no game knowledge, no UI, no I/O)
  hex/         hex-grid maths              (flat-topped hexes, cube coordinates, distances, arcs, lines)
  msb-rules/   Mammoth Sea Battles rules   (plug-in for engine; data-driven content)
  msb-data/    cards, crew, weather, tiles, scenarios (JSON + schema validation)
  msb-ai/      AI players
  sim/         simulation CLI              (batch games → statistics)
  client/      web app: 3D board + UI
  desktop/     Steam wrapper (M3)
  server/      online server (M4)
```

Dependency rule: `engine` ← `hex` ← `msb-rules` ← `msb-ai` / `sim` / `client` / `server`. **Nothing below `client` may touch the DOM,
the clock, `Math.random`, or the network.** These are enforced by lint rules and tested.

### 3.2 Engine kernel (generic)
- **State** is plain, JSON-serialisable data. Rules are **pure functions** `(state, input) → (newState, events)`.
- **Phases** are a state machine defined by the rules plug-in. It supports **simultaneous** phases (everyone programs at once, as in BGA's
  `multipleactiveplayer` states), **sequential** phases and **automatic** phases (resolution).
- **Decisions during resolution.** When a rule needs a player's choice in the middle of resolution (hold fire, knock treasure loose, where
  damage goes), the engine **pauses** with a pending decision: who decides, the legal options, the **default** and a **timeout** (1 minute
  online). Humans, AI and timeouts all answer through the same mechanism.
- **Player views.** `view(state, player)` removes hidden information: other hands, deck order, the next treasure map card (unless peeked).
  The client and AI only ever receive views.
- **Seeded randomness** is stored in the state, so dice and shuffles are reproducible.
- **Event log.** Every change produces events (`ShipSailed`, `ShipPushed`, `Teleported`, `CannonFired`, `DamageRolled`, `SlotBlocked`,
  `ShipSank`, ...). Events drive the animations and the teaching captions, and make up the replay file.
- **Legal action generation** for every decision. It's used by the UI (only valid moves are offered), by the AI, and by tests.

### 3.3 Rules plug-in (msb-rules)
- One module per rule area, **mapped to spec sections**: sailing and points of sail §6.1–6.3, pushing §6.5, currents §6.6, tides §6.4/6.7,
  terrain §3.2.0, portals and caves §3.2.1–3.2.2, combat §7.1, damage §7.2–7.5, refit and sinking §7.7–7.8, wrecks §7.9, Treasure Hunt §8.2,
  weather §3.5.
- **Modules are switchable** per game (points of sail, sea monster, equipment, crew powers), matching rules §9.
- All numbers (sail table, damage die faces, gun range, crew cap, ...) live in a **rules config**, so experiments can change them without
  code changes. This is how the simulator tests "what if cliffs did 1 DD?".
- **Ghost preview:** a pure function that predicts a ship's path for a draft program, ignoring other ships. The UI uses it while you program.

### 3.4 AI (msb-ai)
| Level | Approach |
|---|---|
| Random | Random legal program. For fuzz testing and baseline statistics. |
| Basic | Builds programs with the ghost preview: scores sail moves towards a goal (treasure, port, wreck) and avoids hazards. Fires whenever enemies are in arc. |
| Good | Samples likely opponent programs and simulates them with the engine, choosing the program with the best expected result (Monte Carlo). |

The AI only sees its own player view. Difficulty is set per seat.

### 3.5 Simulation CLI (sim)
`sim --games 10000 --players 4 --ai basic --mode treasure --config experiments/cliff-1dd.json --seed 1 --out results.csv`
- Reports per game: length in turns, winner, treasures, sinkings, damage by source, cards drawn, monster kills, and so on.
- Can sweep a parameter (e.g. crew cap 4–8) and compare the results.

### 3.6 Client (web)
- **Rendering:** **Three.js** for the 3D tabletop (proposed). It has a smaller download than Babylon.js, and community reports favour it on mobile.
  Neither has a clear benchmark win, so **the M0 spike will measure both** on iPad and Galaxy Note before we commit.
  ([LogRocket comparison](https://blog.logrocket.com/three-js-vs-babylon-js/), [Utsubo 2026 comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison),
  [Babylon forum: mobile first-frame](https://forum.babylonjs.com/t/babylonjs-takes-longer-to-render-the-first-frame-on-mobile-compared-to-threejs/41213))
- **UI layer:** HTML/CSS overlay components (React proposed) for cards, panels and menus, over the 3D canvas.
- **Assets:** the designer supplies **OBJ models and PNG art**. An **asset pipeline** converts OBJ (+ its MTL/PNG textures) to **GLB**
  (glTF binary, the web's standard 3D format: one file, compressed meshes, faster loading), and PNGs to compressed web textures
  (resized, with mipmaps). The pipeline is a build script, so updated art just gets re-run.
- **Ship models are high-poly, made for 3D printing**, so the pipeline **simplifies** them (mesh decimation, e.g. Blender's Decimate or
  meshoptimizer's `gltfpack`) to a **polygon budget** (proposed: about 10k triangles per ship, plus a lighter level of detail for iPad and
  zoomed-out views; 8 ships must stay smooth on iPad).
- Print models usually have **no textures or UV maps** and are often one solid piece. The ships will need **painting for the screen**:
  either simple materials per part (hull, sails, flags) or textures baked in Blender. Each player's ship also needs a **player colour**
  (sails or flag) so ships are easy to tell apart.
- **Offline:** v1 works offline once loaded (installable web app).

### 3.7 Steam (M3)
**Electron** (proposed): it bundles Chromium, so WebGL behaves the same on every OS, and **steamworks.js** (Steam achievements, overlay)
supports Electron. Tauri is lighter but uses each OS's own web view, which renders WebGL differently, and Steam integration needs custom Rust.
([Summer Engine: three.js on Steam](https://www.summerengine.com/make-great-games/threejs-game-on-steam), [steamworks.js issue #71](https://www.github.com/ceifa/steamworks.js/issues/71),
[GDevelop forum: Tauri + Steam](https://forum.gdevelop.io/t/implementing-steam-achievements-with-tauri/73202))

### 3.8 Online (M4), not built in v1, designed for
- An authoritative Node server runs the same engine; clients send inputs and receive player views and events over WebSocket.
- Rooms are joined by **invite link**, with no sign-in. AI fills empty seats. Simultaneous programming means no waiting on turn order; async play is possible later.
- Later: **Board Game Arena** port. BGA needs PHP, so the language-neutral **scenario test suite** (§8) is the contract both versions must pass.

---

## 4. UX and UI

### 4.1 Principles
1. **It lives or dies on the interface.** Design it properly and test it before building.
2. **It feels like playing a board game.** Boards look like boards, cards like cards, tokens like tokens, dice like dice, all on a tabletop.
   No video-game terrain or effects that the physical game doesn't have; animation is restrained (pieces slide, cards flip, dice roll).
3. **One screen, no scrolling.** Everything you need is visible; secondary information folds out.
4. **Teach by showing.** Ghost previews, step-by-step replay with captions, and only legal options offered.
5. **Looks like the box.** Same card art, ship board and terms as the physical game.
6. **Mouse and touch equally.** Drag-and-drop *and* tap-to-place; big enough touch targets; no hover-only information.

### 4.2 Screen zones (starting point for the wireframes)
| Zone | Content | Behaviour |
|---|---|---|
| **Board** (most of the screen) | 3D sea, gentle perspective, ships as 3D models, wind arrow, tide state | Pan / zoom / limited rotate; tap a ship to inspect it |
| **Ship board** (bottom) | Your 3 × 3 programming grid | Always visible while programming; collapses during resolution |
| **Hand** (bottom, next to the ship board) | Your command cards (up to 9) | Fans out; drag or tap a card, then a slot |
| **Weather board** (corner) | Current weather and tide + next two | Compact badge, expands on tap |
| **Crew** (side) | Your crew, healthy or wounded | Compact strip, expands |
| **Opponents** (side) | Each rival: crew, damage, treasure, ready status | Collapsed list, expands |
| **Resolution controls** | Play / pause / step / speed, current Part and phase, caption | Shown during resolution |
| **Menu** | Rules help, settings, quit | Fold-out |

### 4.3 Key screens and flows
1. **Start / new game:** choose a scenario, number of AI players and their difficulty, modules, and simple or points-of-sail rules.
2. **Programming:** place cards; the ghost preview draws your ship's expected path for each Part; "Ready" when done.
3. **Resolution:** an animated step-by-step replay of Parts I–III with captions ("Broad reach, Strong wind: Full Sail = 4 hexes"); pauses
   for decisions (damage placement, hold fire, knock loose).
4. **Upkeep:** a summary of refits, wreck finds, new treasure and new weather.
5. **Tutorial:** layered scenarios (online-version.md): sailing → steering and currents → cannons and damage → points of sail → weather → tides.
6. **End of game:** results, replay, and a link to the physical game.

### 4.4 Wireframe process (before any UI build)
1. Generate **3–4 alternative layouts** as wireframes, at desktop 16:9 and iPad 4:3.
2. Evaluate them against **task walkthroughs**: program a turn; understand why your ship ended up where it did; place damage; check the
   weather ahead; see who's carrying treasure. Criteria: number of clicks or taps, nothing hidden that's needed, no scrolling, readability on iPad.
3. Pick one, refine it into **clickable mock-ups**, and **test with real players** (family!) before building.
4. Keep the wireframes in `docs/ui/` with the evaluation notes.

### 4.5 The 3D tabletop
- **The scene is a tabletop.** The sea map is a **flat board** made of the printed tile textures, lying on a table. **Islands, reefs, currents
  and whirlpools are printed art**, not 3D geometry.
- **Ships are 3D miniatures** (the designer's models) standing on the board; they're the only tall objects, so they stand out.
  Other pieces (treasure, wrecks, damage markers, home ports, spawn markers) are **tokens**, flat or slightly raised like card counters.
- The **ship board, cards, crew cards and weather board** also look like their physical versions (the actual art), shown as UI panels around the table.
- **Camera:** gentle tilt (to be tuned in the spike, roughly 30–45° from vertical), a default view that fits the whole map, and limited orbit.
- **Overlays** (arcs, ghost previews, hazards) are drawn like translucent markings on the board, and can be switched off.
- **Animations** stay physical: ships slide hex to hex and turn, are pushed, vanish and reappear at portals, puff smoke for a broadside,
  tip over and sink; dice roll; cards flip. All are **skippable**, with speed control.
- Bonus: a flat textured board is cheap to render, which helps iPad performance.

---

## 5. Data and content
- All game content is **data**: command cards, crew, weather cards, board tiles (hex terrain, currents, edges), scenarios.
- **Validated against schemas** at build time and in tests.
- **Board tile format** to be designed from the designer's tile diagram (each hex: terrain, current arrows, edges with wall reefs and caves, features).

---

## 6. Testing strategy (NFR-4)
| Layer | Tests |
|---|---|
| Hex maths | Unit tests and property-based tests (distances, arcs: exactly 14 hexes per broadside) |
| Rules | A **unit test for every rule in `rules.md`**, each tagged with its section number. Every rule must have at least one test, which gives a traceability report |
| Scenarios | **Language-neutral JSON scenarios** (board + ships + programs → expected positions, damage and events), shared with any future port such as BGA |
| Invariants | Property-based fuzzing over random games: no two ships in one hex, cards are conserved, the hand limit is respected, determinism (replay = same result) |
| AI | AI always submits legal programs; Basic beats Random over N games |
| Simulation | Smoke tests of the CLI; statistics regression to catch accidental rule changes |
| Client | Component tests; **Playwright** end-to-end tests (play a full game against AI headlessly in a browser); visual regression screenshots at desktop and iPad sizes; a no-scrollbars check at every supported size |
| Coverage | **100% line and branch** for engine, hex, rules and AI, gated in CI |

---

## 7. Open questions
- ~~W1~~ → OBJ models (high-poly, for 3D printing; will be simplified) and PNG art. Still: are the models in separate parts (hull, sails)
  or one piece, and do they have colours or textures? Licensing of any third-party assets.
- ~~W2~~ → pass and play plus AI. **Pass-and-play needs a "hand-over" screen** between players while programming, so nobody sees another
  player's hand or program; decisions mid-resolution (damage placement) also need the right player at the device.
- W3. Languages: English only at first?
- W4. Analytics in v1 (anonymous, opt-in) to learn where new players struggle?
- W5. Email list (M5): data protection consent and privacy policy will be needed.
- W6. Rules gaps that block M1: ~~starting state, critical hits, Upkeep order~~ (decided, placeholders where noted); still **the current
  diagram** and **the board tile format**.
