# Mammoth Sea Battles — Rules Specification

> Working spec, built up incrementally. This is the precise source of truth for
> the online version; player-facing instructions will be written from it later.
>
> Status: **Draft v0.4**

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

## 4. Setup
_TBD_

## 5. Turn structure
_TBD — phases/steps of a turn, turn order._

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
- Q3c. Scaling to 8: does the board grow (modular sea tiles?), and how do we keep downtime and chaos down? At 8, RoboRally gets long and swingy.

**Programming (D2, D3)**
- Q4. Does each of the 3 steps get one sail card, one steer card and one cannon card? Are they separate decks or one shared hand?
- Q5. Within a step, what order do steering, sailing and cannon resolve in? (For example: steer → sail → board → fire.)
- Q6. Is "sail" a distance (move N hexes forward) and "steer" a heading change (60° turns)?
- Q7. Hand size: how many cards are drawn per turn? Is it a personal deck (2016 style) or dealt from a shared deck (classic)?
- Q8. Who moves first when ships interfere with each other: priority numbers, a token, initiative, or truly simultaneous?

**Wind (D5)**
- Q9. How does wind modify sailing? For example, sailing distance depends on heading relative to wind (into the wind / close-hauled / beam reach / running), as in sail-and-wind games.
- Q10. Does wind direction or strength change during the game, and how (die, card, track)?

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
- Q20. Currents: do they act **after every step** (like RoboRally after every register) or once per turn? In what order do the different types act (fast before slow, then turning)?
- Q21. Is a current's turn absolute (the ship ends facing the arrow) or relative (turn 60° clockwise)?
- Q22. If a current pushes a ship into another ship, does it push her or just stop (RoboRally: board movement doesn't push)? If it pushes her into an island?
- Q23. Which features are changed by **tides**? Are the sandbanks and shallows the tidal parts?
- Q24. Board edge: what happens to a ship that sails or drifts off the map?

**Crew (D8)**
- Q17. How do you get crew, how many can you hold, and are they permanent or single-use? Can crew be lost to damage?

## Change log
- v0.1 — skeleton created.
- v0.4 — board: modular hex tiles, currents, list of observed features from the example board.
- v0.3 — player count: 4 to start, target up to 8.
- v0.2 — overview, list of differences from RoboRally, first batch of open questions.
