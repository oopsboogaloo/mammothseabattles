# Mammoth Sea Battles — Rules Specification

> Working spec, built up incrementally. This is the precise source of truth for
> the online version; player-facing instructions will be written from it later.
>
> Status: **Draft v0.2**

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
- Players: _TBD_
- Play time: _TBD_
- Age: _TBD_

## 3. Components
_TBD — board, pieces, cards, dice, tokens (with counts)._

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
- Q3. Player count? Teams? (Mammoths vs dinosaurs suggests teams are possible.)

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

**Crew (D8)**
- Q17. How do you get crew, how many can you hold, and are they permanent or single-use? Can crew be lost to damage?

## Change log
- v0.1 — skeleton created.
- v0.2 — overview, list of differences from RoboRally, first batch of open questions.
