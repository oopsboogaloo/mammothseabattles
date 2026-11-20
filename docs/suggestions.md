# Suggestions list

Ideas proposed for the designer to consider. **Nothing here is a rule** until the designer adopts it; adopted items move into
[`rules.md`](rules.md) and the card data in `data/cards/`.

## Equipment cards

Equipment is single-use, kept in a hidden hand and played "at any time" (rules §7.10). The 12 cards already in
`data/cards/equipment-cards.csv` cover armour, cannon range and damage, grape shot, +1 sail, healing, repair, a 180° turn, ignoring
currents, ignoring drift and rearranging the weather. These suggestions use the other parts of the game.

"When to play" names a fixed window relative to a game event: the game pauses there, and the card takes effect straight away. That keeps
them workable online (web-spec §4, `online-version.md`).

| Name | Effect | When to play | Hooks into | Notes |
|---|---|---|---|---|
| **Sea Anchor** | Your ship doesn't move at all this Part: no sailing, currents, drift or pushing (like the Anchor order, rules §6.1). | **Any time**, e.g. after the Part's cards are revealed | Currents, pushing, drift | ✅ *Designer: keep it.* Same effect as the Anchor order, but the order must be programmed in advance, while this card is played **when you need it**: a last-moment way to stop a current, drift or push carrying her onto rocks or off the map. |
| **Sweeps (oars)** | Move 1 hex in any direction this Move phase, whatever the wind. | Move phase | Dead Calm, heading into the wind | ⚠ Overlaps the **Row** order on the command cards. |
| **Tide Tables** | This turn, your ship treats **sandbanks and underwater reefs as water**: a stranded ship floats free, and you can cross them. | Start of a Part, or at Upkeep when the tide changes | Stranding, tides (§6.4, §6.7) | |
| **Smoke Pots** | Your hex counts as fog until the end of the turn. | Before an Action phase | Fog (§7.1) | |
| **Floating Mine** | Put a mine token in an empty sea hex next to you. The first ship to enter it takes 2 DD; then remove it. | Action phase | Area denial | Needs a mine token. |
| **Iron Prow** | Your next ram this turn deals 3 DD instead of 1. | Move phase | Ramming (§6.5) | |
| **Grappling Hooks** | Take the treasure from an adjacent enemy ship. **Only if your ship isn't carrying treasure** (limit 1, §8.2.2). | Your Action-slot turn in the Action phase | Treasure Hunt (§8.2) | |
| **False Bottom** | Your treasure can't be knocked loose this turn. | Start of a Part (before any ship moves) | Treasure Hunt (§8.2.3) | |
| **Message in a Bottle** | Look at the top 3 treasure map cards and put them back in any order. | Upkeep, before treasure spawns | Treasure spawning, hidden information (§8.2.1) | |
| **Spyglass** | Look at one rival's programmed cards for the next Part. | Before a Part resolves | Hidden programming | Online: show the cards to that player only. |
| **Signal Flags** | Add +500 to one of your cards' initiative this Part. | Before a Part resolves | Initiative (§5.3) | |
| **Pilot's Chart** | Choose whether each whirlpool or cave you enter this turn triggers. | Start of a Part (it then applies for the rest of the turn) | Portals and caves (§3.2.1–3.2.2) | |
| **Rum Ration** | Heal all wounded crew, but your next Sail slot is ignored (the crew are drunk). | Upkeep, before cards are drawn | Crew (§7.4) | A fun drawback, like Fireworks. |
| **Lucky Fossil** | Re-roll one damage die, one you rolled or one rolled against you. | After a damage die is rolled, before its damage is applied | Damage dice (§7.2) | Reacts to another player's attack: online needs a window "after damage is rolled, before it's applied". |
| **Monster Bait** *(sea monster add-on)* | +3 influence over the sea monster this Upkeep. | Upkeep, before the monster moves | Sea monster (§9.1) | |

**Design notes**
- Most suggestions are played on your **own ship at a fixed moment**, which suits the online version. Cards that react to someone else's
  attack (Lucky Fossil, and the existing Armour Plating) need a defined window.
- More cards with a **fun drawback** (Rum Ration, the existing Fireworks) would suit the chaotic, Chance-card feel the designer wants.

## Flotsam: how it spawns

Options considered for making equipment more plentiful (rules §7.11). **Designer's choice: options 3 and 4 together** (battle debris
astern of a damaged ship, plus weather cards).

1. **Drifts in on the wind:** at Upkeep, place flotsam on the upwind map edge; currents and drift carry it like a ship at No Sail.
2. **Treasure map deck:** at Upkeep, draw a treasure map card and place flotsam at that spawn point.
3. ✅ **Battle debris:** a damaged ship drops flotsam in the hex directly astern. More fighting means more equipment.
4. ✅ **Weather cards:** some weather cards bring flotsam. Predictable, because the next card is visible.

Suggested additions: a cap (one flotsam per two ships), and pickup only by sailing through it, so collecting it is a choice.

## The Derelict (drifting abandoned ship)

A drifting prize that the wind and currents control. ✅ **Adopted into `rules.md` §7.12 (v0.97).** Kept here for the design history.

| | Rule | Reuses |
|---|---|---|
| **Appears** | A weather card ("Derelict sighted!") places it on the **upwind map edge**. At most one on the board at a time. | Weather board: visible a turn ahead |
| **Moves** | Like a ship at **No Sail**: currents carry it and wind drift pushes it. It never sails or steers. | Movement rules |
| **Obstacle** | It's a ship: sailing into it pushes it, with no DD. Currents and drift don't push it. | Pushing (§6.5) |
| **Boarding** | **End a turn next to it** to board and loot it. | The land-treasure rule (§8.2.2) |
| **Loot** ✅ | **2 equipment cards + 1 treasure** (the treasure only if your ship isn't already carrying one). | Equipment, treasure |
| **Contested** | Several ships boarding on the same turn take loot one item at a time, in Sail initiative order. | Initiative (§5.3) |
| **Shot and sunk** ✅ | It can be shot and sunk, which denies the prize to a rival. It leaves **flotsam** when it sinks. | Cannon fire, flotsam (§7.11) |
| **After looting** ✅ | **Removed** from the board. | |
| **Lost** | Drifts off the map or onto a death reef: gone. | Board edge, death reefs |

**Why it works:** its path is predictable but has to be read from the wind and currents; it draws everyone to one spot; a ship boarding it is a
sitting target for a whole turn; and it's a trial run for the ghost ships of the future solo and co-op mode.

**Decided (v0.97–0.98):** announced by **Dead Calm**, arriving with the next weather card that has wind, on its upwind edge; sinks after **4 damage**; its treasure **counts** towards the treasures in play.
All details are now settled in `rules.md` §7.12.

## Map building: fairer placement and other ideas

Ideas from the designer (v0.109) for later; the current rule is "agree, or take turns".
- **Spawn points:** make the number of spawn points a multiple of the number of players, and have each player place their share.
  (Note: the treasure map deck currently has 9 cards, so the deck would need to match.)
- **Wrecks:** don't place a wreck too near another player's port (distance to decide).
- **Independent ports:** the town printed on a main board could become a neutral port where anyone can repair.
- **One-piece boards:** e.g. a large rectangular board with ports printed on it, used on its own instead of modular 37-hex boards.

## Weather ideas *(designer, 2026-11-19; future ideas, not rules)*

**The two storm cards in the art** (left out of the deck for now, rules §3.5), with their intended text:
- **Hurricane**: *(storm surge)* the tide is as if **High tide** for this turn; *(turbulence)* draw a **fresh weather card for each Part**
  to set that Part's wind direction and strength; **all ships take 1 DD at Upkeep**.
- **Lightning Storm**: *(turbulence)* draw a **fresh weather card for each Part** to set that Part's wind direction and strength;
  **all ships take 2 DD at Upkeep**.

**More weather ideas:**
- **Blessed wind**: each player chooses the wind strength and direction for themselves.
- **Cursed wind**: each player chooses the wind strength and direction (at most Strong) for the player on their left.
- **Healing calm**: no wind (as Dead Calm); heal all wounded crew.
- **Rainbow**: place an extra treasure.
- **Hail**: all ships take 2 Ship damage at Upkeep.
- **Blistering heat**: all ships take 2 Crew damage at Upkeep.
- **Mist**: cannon range reduced by 1.
- **Fog**: cannon range reduced to 1.

**Concept:** a smaller **extreme weather deck**, with a pair of **extreme weather cards** in the main weather deck that call a card from it.
Needs thought.

## Making the game easier to play without simplifying it *(designer, 2026-11-20)*
From the designer's first solo play-tests of the digital prototype: **the game is too hard**, but its complexity is what makes it
unique, so the rules stay as they are for now. The first answer is to **show players what is going on and why**; the same will apply to
the physical boards (clearer printed currents, features that explain themselves).

Done in the digital prototype (2026-11-20):
- Decisions appear in a **small panel on the board**, next to the ship they're about, with the **cause** shown: an animated arcing arrow
  from the shooter (or rammer, or port) to the target, and the dice rolled. Ship damage is chosen on a miniature of the ship board.
- **Mouse-over** on PC: the hex under the pointer is outlined, and pausing shows what's there (terrain and its effect at the current tide,
  currents, eddies, rotors, whirlpools, caves, wall reefs, spawn points, ports, treasure, wrecks, ships).
- **Clearer current arrows**: broad ribbons coloured by strength (pale blue, cyan, gold) with one chevron per hex moved, and a badge for turns.
- During play-back: a large caption of what's happening, arrows for cannon fire and rams, dice results floating over the ship.
- Cards can be **dragged** onto the ship board as well as tapped.
- **Points of sail** (the hardest part): the weather card, shown bigger, carries the Half / Full move on each edge, coloured by point of
  sail, and rings the edge the player's ship faces. Designer decision for the physical cards too (rules v0.144, §3.5).

Further ideas to try:
- A **preview** while programming: the ghost of where the ship will end each Part (the layout A mock-up has one).
- Broadside arcs shown for each Fire card placed.
- A guided first game (tutorial) on a Category 1 board, with the Safe edge option.

## Graphical polish (future) *(designer, 2026-11-20)*
- **Wind on the board**: a gentle wind blowing across the board in the wind's direction, and when the weather changes, the wind
  **softly turning to the new direction and strength**. Mainly to **communicate the weather change**; it shouldn't blow all the time,
  or if it does, only **very subtly** (e.g. faint streaks or ripples drifting across the sea, stronger and faster for stronger winds,
  easing round over a second or two at Upkeep).
