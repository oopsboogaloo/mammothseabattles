# Mammoth Sea Battles — Rules Specification

> Working spec, built up incrementally. This is the precise source of truth for
> the online version; player-facing instructions will be written from it later.
>
> Status: **Draft v0.8**

## 1. Overview
A pirate sea battle and race game between crews of **anthropomorphic mammoth and
dinosaur pirates**. Players fight each other, race to grab treasure, or both.

**Core mechanic: programmed movement**, in the RoboRally family (see
[`research/roborally.md`](research/roborally.md)). Players draw movement cards and
program their ship's orders face down. Then the orders are carried out and the ships
interact with each other and with the sea.

### 1.1 Kept from RoboRally
- Draw movement cards and program them face down, then reveal and resolve them.
- Ships **push** each other and **shoot** at each other.
- **The board moves ships**: sea currents work like RoboRally's conveyor belts.
- **Damage affects movement**.

### 1.2 Key differences from RoboRally
| # | Mammoth Sea Battles | RoboRally |
|---|---|---|
| D1 | **Hex** map | Square grid |
| D2 | **3 steps** per turn | 5 registers |
| D3 | Each step programs **sailing, steering and cannon separately** | One card per register |
| D4 | **Tides** change the board during play | Fixed board |
| D5 | **Wind** affects movement | None |
| D6 | Cannons mostly mounted **broadside** | Laser fires forward |
| D7 | Different damage model | Hand-size loss (classic) / damage cards in deck (2016) |
| D8 | **Crew** works a bit like upgrade/option cards | Option or upgrade cards |
| D9 | Two factions: mammoths vs dinosaurs | Generic robots |

## 1.3 Design pillars
- **P1. Simultaneous everything.** Everyone programs at the same time, and then **everyone executes
  each step at the same time**: all players move their own ships together. There is no going round the
  table, ship by ship. This is why the game scales to 8 players: adding players adds almost no waiting time.
- **P2. Trust at the table.** Physical play relies on players moving their own ships honestly and
  sorting out minor collisions in good faith. Rules should stay simple enough to make that easy.
- **P3. Embrace chaos.** Collisions, currents and plans going wrong are the fun. Don't over-engineer
  the rules to remove chaos; a relaxed, slightly anarchic vibe is the goal.
- **P4. The online version enforces what the table trusts.** The digital version needs a deterministic
  conflict rule for when ships interfere (see Q8) that gives the same result simultaneous play would at the table.

## 2. Players & duration
- Players: **2–4 for the first version; the target is up to 8**. Rules, components and the
  online engine should be designed so 8 is possible, even though playtesting starts at 4.
- Play time: _TBD_
- Age: _TBD_

## 3. Components

### 3.1 The board
![Example board](images/example-board.jpg)

- **Modular**: you build the sea by putting several hex **board tiles** together, so scenarios and
  board size can vary (this also helps it scale to 8 players, see Q3c).
- The play area is a **hex grid**. In the example the hexes are pointy-topped, with flat sides on the left and right *(to confirm, Q18)*.
- **Sea currents** are printed as arrows. A current acts on a ship sitting on it, **moving her and/or turning her** (like RoboRally conveyors and gears).

### 3.2 Board features seen in the example board
Interpretations marked ❓ are guesses, to be confirmed by the designer.

| Feature | What it looks like | Interpretation |
|---|---|---|
| Straight current | Single arrow along the hexes | Moves the ship 1 hex in the arrow's direction ❓ |
| Fast current | Double (and triple?) parallel arrows | Moves the ship 2 (3?) hexes, like RoboRally's express belts ❓ |
| Turning current | Curved arrow | Moves the ship and turns her ❓ |
| Eddy | Circular arrows inside one hex, clockwise or anticlockwise | Turns the ship in place (60° per activation?) ❓ |
| Dashed eddy | Same, with a dashed outline | Weaker, or only active at certain tides? ❓ |
| Gyre / loop current | Ring of arrows circling an island, or an oval loop over 2 hexes | Carries ships round the loop ❓ |
| Maelstrom | Large multi-ring spiral (lower right) | Pulls ships inward and turns them; damage or loss at the centre? ❓ |
| Numbered whirlpool ("1") | Two matching whirlpools | Linked pair: enter one, come out of the other ❓ |
| Sea caves A / B | Cave mouths on islands marked A and B, with exit arrows | Tunnels: enter A, exit at the other A, facing the arrow ❓ |
| Island | Land | Impassable; ships hitting it take collision damage? ❓ |
| Reef / rocks | Pink spiky edges round islands; wreck-strewn rocky hexes with a skull | Hazard: damage, grounding, or sinking? ❓ |
| Sandbanks | Yellow patterned areas | Shallows: impassable or slowing, **tide-dependent**? ❓ |
| Striped shallows | Pale green diagonal stripes | Shallow water or kelp, maybe exposed at low tide? ❓ |
| Rough water | Purple churning hex | Hazard, maybe damage or random drift? ❓ |
| Fog bank | White cloud (centre) | Blocks line of sight for cannon? ❓ |
| Storm | Dark cloud with lightning (left edge) | Damage or random wind; does it move? ❓ |
| Port town | Harbour town (bottom) | Repair, recruit crew, deliver treasure, start point? ❓ |
| Small wreck on sandbar | Upper left | Treasure location? ❓ |

### 3.3 Command cards
<img src="images/cards/400-half-sail_ease-port_fire-cannons.png" width="160"> <img src="images/cards/420-half-sail_ease-port_heal.png" width="160"> <img src="images/cards/860-full-sail_hard-to-port_repair.png" width="160"> <img src="images/cards/840-full-sail_hard-to-port_heal.png" width="160">

Each command card is split into **three coloured bands**, one for each kind of order:

| Band | Colour | Order type | Values seen so far |
|---|---|---|---|
| Top | Blue | **Sail** | Half Sail, Full Sail |
| Middle | Yellow | **Steer** | Ease Port (small turn), Hard to Port (large turn) |
| Bottom | Red | **Action** (cannon background) | Fire Cannons, Heal, Repair |

Each card also has an **initiative number** in the top-right corner (e.g. 400, 420, 840, 860), used like
RoboRally's priority numbers (see §5.3). The hundreds digit seems to follow the sail band (4xx = Half Sail,
8xx = Full Sail), so faster cards win initiative. Some cards also have an **octopus icon** in the top-left corner (Q26).

Example cards seen:

| No. | Sail | Steer | Action | Icon |
|---|---|---|---|---|
| 400 | Half Sail | Ease Port | Fire Cannons | 🐙 |
| 420 | Half Sail | Ease Port | Heal | |
| 840 | Full Sail | Hard to Port | Heal | 🐙 |
| 860 | Full Sail | Hard to Port | Repair | |

### 3.4 Ship board
<img src="images/ship-board.webp" width="420">

Each player has a **ship board** with **3 Parts (I, II, III)**, one per step of the turn. Each Part has three card slots, in this order:
**Move (Sail) → Steer → Action**. The slot art highlights the band that counts (blue top / yellow middle / red bottom), so
**a card placed in a slot uses only that slot's band**. The same card can be a Sail, Steer or Action order depending on where you put it.

The board also works as the turn-sequence reminder, printing Currents and Wind drift between the slots (see §5.2).

- **Up to 9 cards** per turn (3 Parts × 3 slots).
- **Empty slots**:
  - Empty **Move** slot → the **sail stays at its current level**. Sail level is a **persistent setting** carried from Part to Part and turn to turn.
  - Empty **Steer** slot → no turn.
  - Empty **Action** slot → no action.

## 4. Setup
_TBD_

## 5. Turn structure
A turn has **3 steps**. Programming happens once per turn and covers all 3 steps.

### 5.1 Programming
1. Draw command cards *(how many? Q7)*.
2. All players at the same time place cards face down into their ship board's 3 × 3 slots (up to 9).
3. Reveal *(all at once, or step by step? Q28)*.

### 5.2 Resolving each Part (I, II, III)
Each sub-step is carried out by **all ships simultaneously** (pillar P1):

1. **Move phase**: apply any Sail card (change sail level), then every ship sails according to her current sail level *(and wind? Q9)*.
   **Ships push** other ships they move into.
2. **Steer phase**: ships turn according to their Steer card.
3. **Currents**: ships on currents are moved and/or turned. **Currents do not push**.
4. **Action phase**: carry out Action cards (Fire Cannons, Repair, Heal, ...).
5. **Wind drift**: depends on wind strength and the Part:

| Part | Wind strengths that drift |
|---|---|
| I | Gale |
| II | Gale, Strong |
| III | Gale, Strong, Firm |

   So in one turn a **Gale drifts ships 3 times, Strong twice, Firm once** (any weaker wind: never?). This works like
   RoboRally's push panels, which only fire in certain registers.

### 5.4 Upkeep and new turn
After Part III: **Upkeep**, then a new turn begins *(contents of upkeep: Q31)*.

### 5.3 Initiative
Cards carry **initiative numbers**, as in RoboRally. Ships still move **simultaneously** (P1); initiative is used to
**settle conflicts**, e.g. two ships trying to enter the same hex *(exact use: Q8, Q32)*.

## 6. Actions
_TBD_

## 7. Combat / conflict resolution
_TBD_

## 8. Winning & game end
_TBD_

## 9. Glossary
| Term | Definition |
|------|------------|

## Open questions
_Ambiguities and edge cases found while writing the spec, to resolve with the designer._

**Game modes and factions**
- Q1. Are battle and race separate modes/scenarios, or is it always both (treasure race with fighting allowed)?
- Q2. Are mammoths and dinosaurs mechanically different (asymmetric), or only cosmetically?
- ~~Q3. Player count?~~ → Answered: start with 4, target up to 8 (see §2).
- Q3a. Teams? Mammoths vs dinosaurs suggests teams are possible (e.g. 4v4 at 8 players).
- Q3b. What's the minimum? Does 2 players work, or 3?
- Q3c. Scaling to 8: how much does the board grow? (Downtime isn't a concern; see pillar P1.)

**Programming (D2, D3)**
- ~~Q4~~ → Answered: one shared deck of 3-band cards; a 3 × 3 ship board, one slot per order type per step (§3.4).
- ~~Q5~~ → Partly answered: movement → currents → wind drift (§5.2). Action timing is Q29.
- Q6. Sail is a persistent level (answered). What levels exist (e.g. Furled / Half / Full) and how many hexes does each move per Move phase? How does wind affect this? What is the starting sail level?
- Q6a. Steering happens **after** sailing, as a separate phase (answered). Is Ease 60° (one hex side) and Hard 120°? Are there starboard versions of every port card?
- Q6b. Pushing: how far is a ship pushed (1 hex, or as far as the pusher keeps moving)? Can a pushed ship push others in a chain? What happens when a ship is pushed into land, a reef or the board edge?
- Q7. Hand size: how many cards are drawn per turn? Is it a personal deck (2016 style) or dealt from a shared deck (classic)?
- Q8. Execution is simultaneous (P1). When two ships' moves conflict in the same step (both entering one hex, ramming head-on, swapping hexes), what happens at the table? For example: both stop, both take damage, the bigger or faster ship wins, or the players agree on the spot. The online version needs a written rule.

**Wind (D5)**
- Q9. How does wind modify sailing? For example, sailing distance depends on heading relative to wind (into the wind / close-hauled / beam reach / running), as in sail-and-wind games.
- Q10. Wind strengths so far: Gale / Strong / Firm (drift 3 / 2 / 1 times per turn). Are there weaker levels (Light, Calm)? How far does one drift move a ship (1 hex downwind?), and does drift push? Is wind global or does it vary by area? How do wind direction and strength change (die, card, track, at upkeep)?

**Tides & currents (D4)**
- Q11. What do tides change: shallows/sandbars/rocks appearing and disappearing, current direction, or both? Is it on a fixed cycle or random?
- Q12. Currents: distances and order of activation (like fast/slow conveyors)? Do they rotate ships?

**Combat & damage (D6, D7)**
- Q13. Firing arcs on a hex: which hex sides count as port and starboard? Range? Line of sight?
- Q14. Is cannon fire programmed per step, per side (port/starboard/both/hold)? Is there limited ammo or reloading?
- Q15. Damage model: hit locations (hull, mast/rigging, rudder, crew)? How does each one affect sailing and steering?
- Q16. What happens at zero hull (sunk, respawn, out of the game)? Is there ramming damage?

**Board (§3)**
- Q18. Hex orientation and tiles: what shape and size is one board tile (e.g. 7-hex "flowers", or larger)? Are there rules for joining tiles, such as edges having to match?
- Q19. Confirm or correct every ❓ in §3.2.
- Q20. Currents act after ship movement in **every step** (§5.2). Still open: do all current types act at once, or in an order (e.g. fast currents first)?
- Q21. Is a current's turn absolute (the ship ends facing the arrow) or relative (turn 60° clockwise)?
- ~~Q22~~ → Answered: currents do not push (§5.2). Still open: does the ship just stay put, and what about a current carrying her into an island or reef?
- Q23. Which features are changed by **tides**? Are the sandbanks and shallows the tidal parts?
- Q24. Board edge: what happens to a ship that sails or drifts off the map?

**Command cards (§3.3–3.4)**
- ~~Q25~~ → Answered: only the slot's band counts (ship board art).
- ~~Q26a~~ → Answered: the numbers are initiative, as in RoboRally.
- Q26. What does the **octopus icon** mean?
- Q32. Initiative details:
  - Which card's number counts in a given Part: the one in the Move slot, or the highest of the three? What if the Move slot is empty?
  - Does higher go first, as in classic RoboRally?
  - Is it used **only to settle conflicts** (keeping simultaneous play), or does it set a strict movement order at the table?
  - Does it also decide the order of Action-phase firing?
- ~~Q27~~ → Answered: sail stays the same, no steer, no action.
- Q28. Are all 9 cards revealed at once, or column by column as each step resolves?
- Q29. Actions happen after currents and before wind drift (answered). Does Fire Cannons fire both broadsides? Are all actions in a Part simultaneous (can two ships sink each other at once)? What's the difference between **Heal** (crew?) and **Repair** (ship?)?
- Q31. What happens in **Upkeep**: discard and draw, wind change, tide change, crew, treasure?
- Q30. Full list of band values in the deck (all sail, steer and action types) and the deck's makeup and size.

**Crew (D8)**
- Q17. How do you get crew, how many can you hold, and are they permanent or single-use? Can crew be lost to damage?

## Change log
- v0.1 — skeleton created.
- v0.8 — card numbers are initiative.
- v0.7 — ship board layout (Parts I–III); order is Move → Steer → Currents → Action → Wind drift; wind strength sets drift count; empty slots defined; sail level persists.
- v0.6 — command cards (3 bands), 3 × 3 ship board, step order: movement → currents → wind. Currents don't push.
- v0.5 — design pillars: simultaneous execution, trust, embrace chaos. Removed my wrong claim that RoboRally scales poorly.
- v0.4 — board: modular hex tiles, currents, list of observed features from the example board.
- v0.3 — player count: 4 to start, target up to 8.
- v0.2 — overview, list of differences from RoboRally, first batch of open questions.
