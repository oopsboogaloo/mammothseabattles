# Mammoth Sea Battles — Rules Specification

> Working spec, built up incrementally. This is the precise source of truth for
> the online version; player-facing instructions will be written from it later.
>
> Status: **Draft v0.144**

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
| D9 | Crews of anthropomorphic **prehistoric monsters**; every Captain is a **mammoth**. **No factions** | Generic robots |

### 1.3 Design pillars
- **P0. Priority: the core must be as fun as RoboRally at its chaotic best.** The core is **programmed movement + damage**
  (sailing, wind, currents, pushing, cannons, damage). Everything else is an add-on, and only matters once the core sings.
- **P1. Simultaneous everything.** Everyone programs at the same time, and then **everyone executes
  each step at the same time**: all players move their own ships together. There is no going round the
  table, ship by ship. This is why the game scales to 8 players: adding players adds almost no waiting time.
- **P2. Trust at the table.** Physical play relies on players moving their own ships honestly and
  sorting out minor collisions in good faith. Rules should stay simple enough to make that easy.
- **P3. Embrace chaos.** Collisions, currents and plans going wrong are the fun. Don't over-engineer
  the rules to remove chaos; a relaxed, slightly anarchic vibe is the goal.
- **P5. Damage mostly slows you down.** Damage takes away options (blocked slots, fewer cards) rather than knocking you
  out quickly. Sinking needs heavy, focused damage, so ships stay in the game and the race stays live.
- **P7. Players, not ships.** A player may command **more than one ship** (Fleets variant, §8.7), so rules always say which they mean:
  "ship" for anything on the sea or a ship board, "player" for hands of equipment, decisions, scoring and winning.
- **P6. No player elimination.** A sunk ship comes back at her home port (§7.8). Nobody sits out.
- **P4. The online version enforces what the table trusts.** The digital version needs a deterministic
  conflict rule for when ships interfere (see Q8) that gives the same result simultaneous play would at the table.

## 2. Players & duration
- Players: **minimum 2**; **2–4 for the first version; the target is up to 8**. **1 player**: the Solo Challenge (§8.8); a fuller single-player version is wanted eventually (see M5).
- Rules, components and the online engine should be designed so 8 is possible, even though playtesting starts at 4.
- Play time: _TBD_
- Age: _TBD_

## 3. Components

### 3.1 The board
![Example board](images/example-board.jpg)

- **Modular**: you build the sea by putting several hex **board tiles** together, so scenarios and
  board size can vary (§3.1.1).
- The play area is a **hex grid** of **flat-topped** hexes (§3.5 compass; cannon diagram).
### 3.1.1 Building the map *(designer, v0.108)*
<img src="images/board-layout-example.jpg" width="420">

> **All board art so far is prototype examples** (for showing the rules), not final, balanced boards. Real board design is still to do.

- **Main boards** are large **hexagonal boards** of **37 hexes** (3 hexes from centre to edge). **Port tiles** are small **4-hex** pieces,
  one per player (or team).
- 37-hex boards are the standard, not a rule: other formats may come later (e.g. one large rectangular board with the ports printed on it,
  used on its own).
- **The players choose the layout together**: the host decides, or players take turns placing boards. The rulebook will offer some
  **suggested layouts** to get people started, but choosing your own is more fun.
- **How many main boards**: usually **at least 2**; **2–4** is a normal game. **More ships → more boards.**
  - **Fewer boards** → a tighter, more intense, more interactive game (more combat).
  - **More boards** → more racing and navigation, less combat.
- **Board categories** *(designer, v0.121)*: main boards are graded like hurricanes, **Category 1, 2 and 3**. The rulebook advises
  new players to **start with Category 1**.
  - **Category 1**: forgiving. The simplest board features and currents, plenty of open sea, and islands edged mostly with **sand
    (beaches)** rather than cliffs.
  - **Category 3**: as dense as the example boards: complex currents, rotors, eddies, reefs and cliffs. Mentally demanding, which
    experienced players enjoy.
  - Category 2 sits in between.
  - It's a **broad guide, not a strict rule**: it helps players choose boards that suit their experience and the kind of game they want
    (fewer currents make for a more open battle). There's no rule on what a category may contain, and nothing stops players mixing
    categories. Details wait until the real boards are designed.
- **Joining boards**: no fixed rule. Players agree how the boards fit together, as long as it makes an interesting map.
- **Computer version:** the map is **generated automatically** from a few settings (number of boards, density); players don't design it
  (web-spec §5.1). Rules here that say "players agree" apply to the physical game only.
- **Spawn points and wrecks**: placed as part of designing the map, by **mutual agreement** or **taking turns** (see `suggestions.md` for
  fairer methods under consideration).
- **Ports** are attached to the **outer edge** of the map:
  - A port tile can face any way round (upside down is fine).
  - Its **sea hex** (the only sea hex on the tile) **must join a sea hex** on a main board. The rest of the tile is land.
  - **No two ports on the same side** of a main board, so ports are spread out.
- The example shows 2 main boards and 2 ports: a 2-player layout.

- **Board edge**: a ship that would leave the map (sailing, pushed, current or drift) **sinks in the hex she was about to leave** (§7.8).
  - **Optional rule: Safe edge** *(designer, v0.130; for an easier game)*: the map edge acts as a **beach**. A ship that would leave the map
    **stops** in the hex she was about to leave, with no damage, instead of sinking.
- **Sea currents** are printed as arrows. A current acts on a ship sitting on it, **moving her and/or turning her** (like RoboRally conveyors and gears).

### 3.2 Board features seen in the example board
Interpretations marked ❓ are guesses, to be confirmed by the designer.

| Feature | What it looks like | Interpretation |
|---|---|---|
| Current | Single arrow | **Confirmed** (§6.6): moves the ship 1 hex |
| Fast current | Double / triple arrows | **Confirmed** (§6.6): moves the ship 2 / 3 hexes |
| Turning current | Curved arrow | **Confirmed** (§6.6): moves the ship and turns her |
| Eddy | Circular arrows inside one hex, clockwise or anticlockwise | Turns the ship in place, in the arrows' direction, by **1, 2 or 3 hex sides (60°, 120° or 180°)** depending on the eddy; she doesn't move (§6.6 examples 6–7) |
| Dashed eddy | Same, with a dashed outline | Weaker, or only active at certain tides? ❓ |
| Gyre / loop current | Ring of arrows circling an island, or an oval loop over 2 hexes | Carries ships round the loop ❓ |
| Maelstrom | Large multi-ring spiral (lower right) | Pulls ships inward and turns them; damage or loss at the centre? ❓ |
| **Whirlpool portal** (numbered, e.g. "1") | Two matching whirlpools | **Core feature.** Paired portals; see §3.6. |
| **Sea cave** (lettered, e.g. A, B) | Cave mouths on island edges, marked with letters and arrows | **Core feature.** Paired edge portals that change heading; see §3.2.2. |
| Island | Land | **Confirmed** (§3.2.0): cliff land (2 DD) or beach land (stop) |
| Wall reef | Pink spiky edges round islands | **Confirmed** (§3.2.0): blocks the edge, 2 DD |
| Death reef | Rocky hex with a wrecked ship and a skull | **Confirmed** (§3.2.0): kills ships that enter |
| Sandbanks | Yellow patterned areas | **Confirmed** (§3.2.0): land except at High tide |
| Underwater reef | Pale green diagonal stripes | **Confirmed** (§3.2.0): water except at Low tide |
| Rough water | Red/purple churning hex | **Confirmed** (§3.2.0): 2 DD if you're in it at the end of a Part |
| Fog bank | White cloud (centre) | **Confirmed** (§7.1): prevents aiming; no other effect |
| Storm | Dark cloud with lightning (left edge) | **Provisional** (§3.2.0): 3 DD if you're in it at the end of a Part |
| Port town | Harbour town printed on a main board | **Scenery** (land) for now; home ports are separate port tiles (§3.1.1) |
| Small wreck on sandbar | Upper left | **Confirmed**: a **starting shipwreck** (§7.9) |

### 3.2.0 Terrain *(confirmed)*
"Stops you" means the ship **doesn't enter** the hex (or cross the edge): she stays in the last hex she was in, and the rest of
**that movement** is lost. She **can still be moved later** in the turn by currents, pushing or wind drift.
**However a ship gets there**, the effect is the same: sailing, being pushed, currents and drift all take cliff and wall-reef damage,
and **death reefs sink any ship that enters them, however she got there**.

| Terrain | Looks like | Effect |
|---|---|---|
| **Cliff land** | Land with purple cliffs | **Stops you + 2 DD** |
| **Beach land** | Land with yellow sand | **Stops you** (no damage) |
| **Sandbank** | Yellow sand patterns over water | **As beach land**, except at **High tide**, when it's **water** |
| **Underwater reef** | Pale green stripes | **Water**, except at **Low tide**, when it's **as beach land** (sand) |
| **Death reef** | Rocky hex with a **skull** icon | **Kills any ship that enters it** (sinks) |
| **Wall reef** | Spiky reef along a **hex edge** | **Blocks** movement across that edge; trying to cross = **stopped + 2 DD**. Does **not** block cannon fire |
| **Storm** *(provisional)* | Dark cloud with lightning | **3 DD** to a ship in it at the **end of a Part**. Something bad; may change |
| **Rough water** | Red/purple churning water | Passable; **2 DD** to a ship that is in it at the **end of a Part** (after wind drift) |

**Tide summary** (Full Metal Planète-style staggered thresholds, §6.4):

| Tide | Sandbank | Underwater reef |
|---|---|---|
| High | water | water |
| Mid | land (beach) | water |
| Low | land (beach) | land (beach) |

### 3.2.1 Whirlpool portals *(core rule)*
Portals are a **core** feature, not optional; they're a big part of the fun (as in RoboRally).
- Whirlpools come in **pairs, matched by number**.
- **Entering** a whirlpool hex teleports the ship **immediately** to the partner whirlpool.
- She **keeps her heading** and **carries on with any remaining movement** from the partner hex.
- **Any movement triggers it**: sailing, being pushed, currents, wind drift.
- **Blocked**: if the partner whirlpool is occupied, the ship **does not travel** through the portal. She treats the whirlpool
  as a normal hex and **carries on** with any remaining movement.
- **Simultaneous entry** (two ships entering the two whirlpools of a pair at once): resolved by **initiative**. The ship with
  priority goes through first, and the other then resolves against the new situation (e.g. her exit is now occupied, so she's blocked
  and carries on as normal).
- **Only moving onto a whirlpool triggers it** (sailing, drifting or currents, being pushed). **Arriving through the portal does not
  trigger it again**, and a ship that starts on a whirlpool and moves off it doesn't trigger it either.

### 3.2.2 Sea caves *(core rule)*
Caves work like whirlpool portals (§3.2.1) with these differences:
- They're paired by **letter** (A↔A, B↔B), not number.
- A cave is on a **hex edge** (the cave mouth, on the side of an island hex), not a whole hex.
- A ship enters a cave by **moving across the cave-mouth edge** into the island. She comes out of the partner cave's mouth
  into the **sea hex in front of it**.
- She **changes orientation**: she leaves **facing out of the partner cave mouth** (as the printed arrow shows), not keeping her old heading.
- Like whirlpools, she **continues any remaining movement** after coming out, and **any movement** (sailing, current, drift, push) triggers it.
- A ship can enter a cave **backwards or sideways** (drift, push); she still comes out **facing the arrow**.
- **Caves are not a special case** *(designer, v0.140, Q69)*: a cave **joins two sea hexes** that would not otherwise be joined (the hex
  at the cave mouth and the hex in front of the partner's mouth). They're joined **for movement only, not for cannon fire**, and **all the
  normal movement rules apply**:
  - ships can be **pushed into** a cave, and a ship moving through a cave **pushes** (and rams) like any ship movement (§6.5);
  - **currents and drift don't push** through a cave either: if the exit hex is occupied, she **stays where she was**;
  - a ship that can't come out (blocked) **stays where she was** before entering, as with any blocked move.

### 3.3 Command cards
<img src="images/cards/400-half-sail_ease-port_fire-cannons.png" width="160"> <img src="images/cards/420-half-sail_ease-port_heal.png" width="160"> <img src="images/cards/860-full-sail_hard-to-port_repair.png" width="160"> <img src="images/cards/840-full-sail_hard-to-port_heal.png" width="160">

Each command card is split into **three coloured bands**, one for each kind of order:

| Band | Colour | Order type | Values seen so far |
|---|---|---|---|
| Top | Blue | **Sail** | Half Sail, Full Sail, **Anchor**, Row Ahead 1, Row Back 1 (there is **no No Sail card**: No Sail is the default, §3.4) |
| Middle | Yellow | **Steer** | Ease Port / Ease Starboard (60°), Hard to Port / Hard to Starboard (120°), **Hard About (180°)** |
| Bottom | Red | **Action** (cannon background) | Fire Cannons, Heal, Repair |

Each card also has an **initiative number** in the top-right corner (e.g. 400, 420, 840, 860), used like
RoboRally's priority numbers (see §5.3). The hundreds digit seems to follow the sail band (4xx = Half Sail,
8xx = Full Sail), so faster cards win initiative. Some cards also have an **octopus icon 🐙** in the top-left corner. It is used to **move the sea monster**, an
**optional role/module** to be specified later (see §9).

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
  - Empty **Move** slot → **No Sail** for that Part. *(Designer, v0.129: sail level is **not** carried over. Every Part starts at No Sail,
    and a Sail card in that Part's Move slot sets Half or Full Sail for that Part only.)*
  - Empty **Steer** slot → no turn.
  - Empty **Action** slot → no action.

### 3.5 Weather cards and weather circuit
<img src="images/weather/dead-calm.png" width="130"> <img src="images/weather/light-north.png" width="130"> <img src="images/weather/firm-north.png" width="130"> <img src="images/weather/firm-se.png" width="130"> <img src="images/weather/strong-ne.png" width="130"> <img src="images/weather/gale-nw.png" width="130"> <img src="images/weather/new-weather-front.png" width="130">

- **Wind blows in the direction the card's arrow points.** A "North Wind" card blows **towards the north**, so downwind = north
  and drift moves ships north. ⚠ Sailors name winds by where they come **from**, so a real "north wind" blows south. Consider
  renaming the cards (e.g. "Wind to the North" / "Northward", or just the arrow) to avoid arguments at the table.
- Weather cards are **hex-shaped**. Each shows a **wind strength** and a **wind direction** on a 6-point compass
  (**N, NE, SE, S, SW, NW**). These are the 6 directions of flat-topped hex sides, so the wind always runs along a hex direction.
- **Points-of-Sail player aid** *(designer, v0.144)*: each weather card is printed **bigger** and shows, **on each of its six edges**, the
  **Half Sail / Full Sail move for a ship heading that way**, with the card's own sail modifier already counted (§6.2, §6.3). A player
  finds the edge her ship faces and reads the move: no rotating and no sums. Edges are coloured by point of sail (windward, close
  hauled, broad reach, running). The weather card must lie **north-up**, like the board. Values (Half / Full; ← = backwards):

  | Heading vs wind | Dead Calm | Light | Firm | Strong | Gale |
  |---|---|---|---|---|---|
  | Running (downwind edge) | 0 / 0 | 0 / 1 | 1 / 2 | 1 / 3 | 2 / 3 |
  | Broad reach (2 edges) | 0 / 0 | 1 / 2 | 2 / 3 | 2 / 4 | 3 / 4 |
  | Close hauled (2 edges) | 0 / 0 | 0 / 1 | 1 / 2 | 1 / 3 | 2 / 3 |
  | Windward (upwind edge) | 0 / 0 | 0 / 0 | 0 / ←1 | 0 / ←2 | ←1 / ←2 |

  The digital version draws the same card. *(Card art: designer to-do.)*
- **Weather is predictable**: cards are drawn and placed on a **weather circuit** that shows the current weather and the **next
  card face up**. The circuit also **marks the tides** (§6.4).

**Weather board**

<img src="images/weather-board.jpg" width="380">

- A ring of **6 hex spaces** for weather cards, advancing **clockwise**.
- Each space is also a **tide state**: High → Mid → Mid → Low → Mid → Mid → (back to High).
  That is a **6-step tide cycle** with 3 levels (High / Mid / Low), so the sea is at Mid tide half the time.
  - Top space = **High**.
  - Two right-hand spaces = **Mid** (ebbing).
  - Bottom space = **Low**.
  - Two left-hand spaces = **Mid** (flooding).
- The weather board **advances one space per turn**, so the tide cycle is **6 turns**. Everyone can see the **current and next turn's weather**.
- **All 6 spaces hold a weather card**; **2 are face up: the current card and the next one**.
- **"Now" is marked by a rotating arrow** in the middle of the board *(designer to-do; a pencil for now)*.
- **Starting tide: random.**
- **New Weather Front** replaces the face-up cards too.
- **Refilling** *(v0.137)*: when the board advances, the card leaving "now" goes to a **weather discard pile**, and the empty space gets
  the **top card of the weather deck**. When the deck runs out, shuffle the discards to make a new deck.

| Card | Strength | Sail modifier (printed) | Wind drift per turn (§5.2) |
|---|---|---|---|
| Dead Calm | — | **No sail move** | 0 |
| Light (e.g. North) | Light | **−1 all sail moves** | 0 |
| Firm (e.g. North, SE) | Firm | none | 1 (Part III) |
| Strong (e.g. NE) | Strong | **+1 Full Sail moves** | 2 (Parts II, III) |
| Gale (e.g. NW) | Gale | **+1 all sail moves; 1 DD for each Part sailed at Full Sail** (up to 3 a turn), taken **at Upkeep** *(designer to add the timing to the card)* | 3 (Parts I–III) |
| New Weather Front | — | **Reshuffle the weather deck and place new cards, including this one** | — |

**Lightning Storm** and **Hurricane** cards exist in the art but are **left out of the weather deck for now** *(designer, v0.136)*; their intended text and more weather ideas are in [`suggestions.md`](suggestions.md).

Notes: the Gale card is spelled "GAIL" on the current artwork. **DD = Damage Die**, taken when damage occurs (§7.2).

### 3.6 Crew cards
<img src="images/crew/pirate.png" width="150"> <img src="images/crew/captain-mammoth.png" width="150">

- **All crew are prehistoric monsters** (dinosaurs and other prehistoric creatures). **All Captains are mammoths.**
  There are **no factions**: any crew member can serve on any ship.
- Each ship has a crew of **crew cards** (round). Each has a **name** (e.g. *Pirate*, *Captain Mammoth*), artwork, and
  **command-card icons** (small 3-band card symbols): *Pirate* has 1, *Captain Mammoth* has 3.
- **Card icons = command cards drawn per turn** from that crew member (§5.1).
- **Some crew have special powers** (printed in the white panel), like RoboRally's upgrade cards. Known examples:

| Crew | Power |
|---|---|
| Captain (e.g. *Captain Mammoth*) | Draws 3 command cards; the most powerful crew |
| Pirate | Draws 1 command card; no special power (basic crew) |
| Surgeon | **Automatically heals 1 wounded crew member per turn** (no Action needed) *(when: at Upkeep? ❓)* |
| *(some crew or equipment)* | Peek at the treasure map deck (§8.2.1) |
- Crew cards have a **healthy** side and a **wounded** side (flip to wound, §7.4).
- **8 Captain cards**, one per ship, currently **identical** in powers (they may differ later).
- The **crew deck** contains **a Retired Captain**: the **strongest crew card** in the game. **She won't serve alongside a Captain.**
  A ship that already has a Captain and recruits her must **swap** (one of the two leaves). For a ship that has lost her Captain,
  she's a lucky find.
- **All ships are identical**; the only differences between ships come from their crew and damage.
- **Crew cap: 6** per ship. A ship at the cap that gains crew (e.g. from a wreck) may **swap** one of her crew for the new one.
- **Every ship starts the game with a Captain + 2 crew** (3 in total; the 2 **drawn at random**).
- **Wounded crew** give **no card icons** and their **powers stop** until healed. **Captains can be wounded and killed** like any crew.
- The **crew deck** will have **at least 50 cards**, and **most crew have a skill** that helps. Captains are the most powerful crew; losing yours (killed, or ship sunk) is a big setback.

## 4. Setup
1. Build the map together (§3.1.1): main boards, then one **port tile** per player or team on the outer edge. Place spawn points and wreck tokens (scenario).
2. Spawn the starting treasures (§8.2.1).
3. Each player: ship board, Captain + 2 random crew, ship **in her home port** with **sail down (No Sail)**, **heading of her choice**.
4. Weather board filled; current card and the next one face up.
5. Draw command cards (§5.1).

## 5. Turn structure
A turn has **3 steps**. Programming happens once per turn and covers all 3 steps.

### 5.1 Programming
1. **Draw command cards**: one per command-card icon on your **healthy** crew (§3.6).
   You **keep unplayed cards** from turn to turn. **Hand limit 9**: draw, program, then **discard down to 9** if needed.
2. All players at the same time place cards face down into their ship board's 3 × 3 slots (up to 9).
3. **Reveal one Part at a time**, as each Part resolves.
4. **Used cards** are gathered, **roughly shuffled**, and put on the **bottom of the deck** (online: shuffle them, then place them under the deck).

There is **one shared command deck** for all players (like classic RoboRally), not a deck per ship. It covers **every combination
of Sail × Steer × Action bands, or a good sample**, and will be large enough for 8 players.

### 5.2 Resolving each Part (I, II, III)
All ships act **at the same time** in each phase (pillar P1). When they interfere, **initiative** decides the order (§5.3).

1. **Move phase**: each ship's sail level for this Part is set by her Sail card (**No Sail if the slot is empty**; **Anchor**: see §6.1).
   Then every ship sails according to her sail level, the **points of sail**
   and the **weather** (§6.1–6.3). **Ships push** ships they move into (§6.5). Terrain (§3.2.0), portals and caves (§3.2.1–3.2.2) apply.
   Conflicts: Sail-slot initiative.
2. **Steer phase**: ships turn according to their Steer card (Ease 60°, Hard 120°, Hard About 180°).
3. **Currents**: in three 1-hex sub-steps (triple → double + triple → all), moving and/or turning ships. Eddies spin ships.
   **Currents don't push** (§6.6). Conflicts: Sail-slot initiative.
4. **Action phase**: Fire Cannons, Repair, Heal, in **Action-slot initiative order**, with damage **applied immediately** (§5.3, §7).
   Then home port guns fire, and the **sea monster** attacks if in play (§9.1).
5. **Wind drift**: each drifting ship moves **1 hex downwind** (heading unchanged). **Drift doesn't push**: a ship drifting into an
   occupied hex stays put. Terrain, portals and caves still apply. Which winds drift depends on the Part:

   | Part | Wind strengths that drift |
   |---|---|
   | I | Gale |
   | II | Gale, Strong |
   | III | Gale, Strong, Firm |

   So in one turn a **Gale drifts ships 3 times, Strong twice, Firm once**; **Light and Dead Calm never drift**.
   This works like RoboRally's push panels, which only fire in certain registers.
6. **End of Part**: ships in **rough water** take 2 DD; ships in a **storm** take 3 DD (§3.2.0).

**Stuck** ships (§6.7) skip steps 1–3 and 5 but still act in step 4.

### 5.3 Initiative
Cards carry **initiative numbers**, as in RoboRally. Ships still move **simultaneously** (P1); initiative is used to
**settle conflicts**: when two ships' movements interfere, the ship with initiative resolves first, then the other.
**Which number counts** depends on the phase:

| Phase | Initiative from |
|---|---|
| Move phase (sailing conflicts, e.g. simultaneous whirlpool entry, §3.2.1) | the card in the **Move (Sail)** slot |
| Action phase (cannon fire order) | the card in the **Action** slot |

**Empty slot = initiative 0**, so that ship goes last in that phase.

**Higher number goes first.** Because Full Sail cards are numbered 8xx and Half Sail 4xx, faster ships generally win movement conflicts.

So the same physical card can have a different effect on priority depending on where you place it, which is one more thing to weigh when programming.
**Movement conflicts** (two ships entering the same hex, meeting head-on, swapping hexes) are resolved by **initiative**: the higher
moves first, then the other moves against the new situation, pushing as normal.

**Cannon fire** is resolved **in initiative order, and damage is applied immediately**: a ship sunk by a higher-initiative broadside
**doesn't fire**.

**Tie-break: roll off.** If ships have equal initiative (in practice, both have an empty slot = 0), the tied players **roll a die**;
the highest roll goes first (re-roll ties). Ties should be rare. *(Online: rolls come from the game's seeded random-number generator,
so replays and tests can be reproduced.)*

*(Other conflicts: Q8.)*

### 5.4 Upkeep and new turn
After Part III: **Upkeep**, then a new turn begins. Order *(proposed by Claude, to playtest)*:

1. **Sea monster moves** *(add-on, §9.1)*: first, because its influence comes from the cards programmed in the turn just played.
2. **Sunk ships come back** at their home port (§7.8) *(placement in the order proposed in v0.107)*.
3. **Refit** ships that ended the turn in their home port (§7.7).
4. **Search wrecks** (§7.9). After refit, so crew gained from a wreck isn't wiped out by the refit's "recruit up to 3".
5. **Spawn treasure** for each one scored this turn (§8.2.1).
6. **Gale damage**: 1 DD for each Part a ship sailed at Full Sail in a Gale (§3.5) *(placement proposed in v0.107)*.
7. **Advance the weather board** one space: new wind and **new tide**. **Check stranding now**: ships on hexes that have become land are
   **stuck**, and stuck ships on hexes that are water again are **freed** (§6.7).
8. **Draw command cards** (§5.1). Last, so players draw knowing the new weather and can plan the next turn with it.

## 6. Movement & actions

### 6.1 Sailing: basic rule
Without the Points of Sail rule (§6.2), wind direction doesn't affect sailing:

| Sail level | Move phase |
|---|---|
| No Sail (empty Move slot) | 0 (the ship is still moved by currents and wind drift) |
| Half Sail | 1 hex forward |
| Full Sail | 2 hexes forward |

**Row Ahead 1 / Row Back 1** *(designer, v0.131)*: Sail-band orders. The ship moves **1 hex straight ahead or straight astern,
whatever the wind** (Dead Calm included, and no weather modifiers). She has no sail set, so she's at **No Sail** for that Part.
- Rowing is ship movement like sailing: it **pushes** ships in the way and **rams** (1 DD to the first ship hit). ✅ *Designer (Q68): "ask the Vikings".*

**Anchor** *(designer, v0.129)*: a Sail-band order. For that Part the ship is at **No Sail** and **can't be moved at all**: no sailing,
no **pushing**, no **wind drift** and no **currents**. She **can still turn** with her Steer card, and still act in the Action phase.
- A ship that sails or rows into an anchored ship is **stopped**, and the anchored ship takes the **1 DD** for being rammed; a push chain
  stops at her. ✅ *Designer (Q67a, v0.133).*
- **Eddies don't turn an anchored ship** (nor do curved currents or rotors): **only her Steer card turns her**. ✅ *Designer (Q67b, v0.134).*
- Anchor lasts **only for the Part it's played in**. ✅ *Designer (Q67c, v0.135).*

### 6.2 Points of Sail *(optional rule, intended as the standard)*
<img src="images/points-of-sail.jpg" width="420">

This is a real sailing effect, and it's what makes the game unique. The point of sail is judged from the ship's heading at the **start of
the Move phase**. How far a ship sails in the Move phase depends on her
**sail level** and her **heading relative to the wind**. With flat-topped hexes a ship faces one of 6 hex sides,
so there are 4 points of sail (mirrored port and starboard):

| Point of sail | Heading vs wind | No Sail | Half Sail | Full Sail |
|---|---|---|---|---|
| **Windward** (in irons) | Straight into the wind (0°) | 0 | **0** (can't sail into the wind) | **1 hex backwards** (taken aback) |
| **Close Hauled** | 60° off the wind | 0 | 1 forward | 2 forward |
| **Broad Reach** | 120° off the wind | 0 | 2 forward | **3 forward** (fastest) |
| **Running** | Straight downwind (180°) | 0 | 1 forward | 2 forward |

- The fastest sailing is with the wind to your side and behind you (broad reach).
- Sailing movement is ship movement, so ships **push** (§5.2 step 1).
- This is separate from **wind drift** (§5.2 step 5), which the weather may also apply on top.

### 6.3 Weather modifiers
The current weather card changes sailing moves (§3.5): Dead Calm = no sail move; Light −1 all; Strong +1 Full Sail;
Gale +1 all, plus DD for each Full Sail. These apply on top of the points of sail.

**Combining rule:** weather modifiers change the **size** of the sail move (number of hexes), whatever its direction,
with a **minimum of 0**. Examples, Full Sail into the wind (normally 1 hex backwards):
- Light (−1) → **0**.
- Gale (+1) → **2 hexes backwards**.

Half Sail into the wind (normally 0):
- Gale (+1) → **1 hex backwards**.

So modifiers apply to any ship with sail **set** (Half or Full), even if its base move is 0. **No Sail is never
modified**, because there's no sail for the wind to act on; only currents and drift move that ship.

**Windward lookup** (heading straight into the wind; − = backwards):

| Weather | No Sail | Half Sail | Full Sail |
|---|---|---|---|
| Dead Calm | 0 | 0 | 0 |
| Light (−1 all) | 0 | 0 | 0 |
| Firm | 0 | 0 | −1 |
| Strong (+1 Full) | 0 | 0 | −2 |
| Gale (+1 all) | 0 | −1 | −2 |

**Full sail-move table** (Points of Sail + weather; Half / Full, in hexes; − = backwards; No Sail is always 0).
Worked out from the rules above; the windward row is confirmed by the designer, the other rows follow from the same rules.

| Weather | Windward | Close Hauled | Broad Reach | Running |
|---|---|---|---|---|
| Dead Calm | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Light (−1 all) | 0 / 0 | 0 / 1 | 1 / 2 | 0 / 1 |
| Firm | 0 / −1 | 1 / 2 | 2 / 3 | 1 / 2 |
| Strong (+1 Full) | 0 / −2 | 1 / 3 | 2 / 4 | 1 / 3 |
| Gale (+1 all) | −1 / −2 | 2 / 3 | 3 / 4 | 2 / 3 |

Without Points of Sail (basic rule, §6.1): Dead Calm 0/0, Light 0/1, Firm 1/2, Strong 1/3, Gale 2/3.

Remember: Gale also gives **1 DD for each Part sailed at Full Sail**, taken at Upkeep (§3.5).

### 6.4 Tides *(inspired by Full Metal Planète, see [`research/full-metal-planete.md`](research/full-metal-planete.md))*
- **3 tide levels: High, Mid, Low**, cycling High, Mid, Mid, Low, Mid, Mid on the weather board (§3.5). Like Full Metal Planète's Low/Normal/High.
- Tides **change the board**: **sandbanks** are water only at High tide, and **underwater reefs** are land only at Low tide (§3.2.0).
- *What happens to a ship on a hex when it becomes land: Q40.*

### 6.5 Pushing
- Ship movement (sailing, and coming out of a cave) **pushes** any ship in the way. Currents and wind drift do **not** push (§5.2).
- **Pushes chain**: a pushed ship pushes the next ship in line, and so on.
- **Distance**: a pushed ship moves **as far as the pushing movement continues**, hex for hex.
- **Pushed into an obstacle** (land, reef, board edge, other features) has **the same effect as moving into it** (terrain effects: §3.2.0).
- **Ramming**: the **first ship hit** takes **1 DD**; ships further along a push chain take none (§7.2).

### 6.6 Currents
- Arrows show current movement. A ship on a current is moved in the Currents phase (§5.2). *A players' diagram showing every
  current type is coming from the designer.*

| Arrow | Effect |
|---|---|
| Single | Move 1 hex |
| Double | Move 2 hexes |
| Triple | Move 3 hexes |
| Turning (curved) | Move **and turn** as the arrow turns |

- Currents **don't push** other ships (§5.2), but a ship carried into a **cliff** or **wall reef** takes the damage (§3.2.0), and into a
  **death reef** sinks.
**Which ships a current moves:** a ship is affected by a current when **an arrow starts in her hex** and goes somewhere.

**Current examples** *(from the designer; more to come)*

1. **Straight current, single arrow:** a ship that ends her movement on a hex with an arrow is moved **1 hex** across the hex side the arrow
   points to. Her **heading doesn't change**: arrows with no turn in them don't turn the ship (the ship in the example faces south, bow
   pointing down, before and after). A line of arrows is a "river" of current, but
   a single-arrow hex still moves her only 1 hex per Currents phase.
   - **River:** in a line of single arrows she moves only from her own hex to the next one, keeping her heading (second picture).
   - **Whatever her heading:** the current carries her the way the arrow points, even sideways. In the third picture a ship facing
     south-west is carried 1 hex south-east and still faces south-west.

   <img src="images/currents/example-1-straight.jpg" width="320"> <img src="images/currents/example-1-river.jpg" width="300">
   <img src="images/currents/example-1-sideways.jpg" width="300">

2. **Curved current:** a curved arrow moves the ship **1 hex** along the arrow **and turns her one hex side (60°) in the direction the arrow
   curves**. The turn is **relative** to her own heading. In the example a ship facing south, on a curved arrow bending clockwise, is moved
   1 hex and turned clockwise to face south-west. A ring of curved arrows round an island (a gyre) is a chain of these.

   <img src="images/currents/example-2-curved.jpg" width="320">

3. **Curved current, anticlockwise** *(designer's 4th example, listed here with the other curves)*: the arrow starting in the ship's hex bends
   anticlockwise, so she is carried 1 hex along it and turned **one hex side anticlockwise** (facing north-west → south-west in the example).

   <img src="images/currents/example-4-curved-anticlockwise.jpg" width="300">

4. **Small ring around a hex corner (a 3-hex rotor)**: a ring of arrows around the corner where 3 hexes meet. Like the 4-hex rotor
   (example 5), it turns everything around that corner: a ship is carried to the next of the 3 hexes in the arrows' direction (1 hex) and
   turned **two hex sides (120°)** the same way. In the example the ring is clockwise: a ship facing **north** is carried to the next hex
   and ends facing **south-east**. ✅ **Designer (Q62, v0.122): 120°.** (The earlier picture showing 60° was a mistake in the art, which
   shows how easy these are to misread.) The art will get small markers ("bobbles") on the arrows showing how many hex sides to turn.

   <img src="images/currents/example-5-three-hex-ring.jpg" width="300">

5. **Rotor current (a "turntable"):** a ring of arrows rotating around a **point between hexes**, not around one hex's centre. Each
   activation turns everything in the rotor around that point, like a secret library door turning in place: **ships move to the hex the
   rotation carries them to, and turn by the same angle**. The example rotor turns **180°**: a ship on one side is carried across to the
   opposite hex and **ends facing the opposite way** (east → west in the first picture, south-east → north-west in the second). A ship on
   the opposite hex is carried the other way at the same moment, so **ships swap places**.
   - The example rotor covers the **4 hexes around its centre point**: each has an arrow starting in it, so a ship on any of them is carried.
   - It's a **single-arrow** current, so it acts in the **single-arrow sub-step**.
   - **Blocked:** as with every current, if the hex she'd be carried to is still occupied (rare, because the ship there is usually being
     carried too), she **stays put**.
   - Inspired by RoboRally's rotating board elements: confusing at first, but exceptional play.
   - **More sizes are planned**, covering different numbers of hexes (and so different rotation angles).

   <img src="images/currents/example-3-rotor-a.jpg" width="300"> <img src="images/currents/example-3-rotor-b.jpg" width="300">

6. **Eddy (turn only):** a ring of arrows inside one hex. The ship **stays in her hex** and is turned **one hex side (60°)** in the
   direction the arrows go. In the example the arrows run clockwise: a ship facing south turns to face south-west.
   - It's a **single-arrow** current, so it acts in the **single-arrow sub-step** ❓.
   - Nothing moves, so an eddy is never blocked.

   <img src="images/currents/example-6-eddy-a.jpg" width="300"> <img src="images/currents/example-6-eddy-b.jpg" width="300">

7. **Eddy drawn with 3 arrows** (next to whirlpools 2 and 7): clockwise. In the pictures a ship facing **south** ends facing
   **north-west**, which is **two hex sides (120°)** clockwise. She stays in her hex. ✅ *Designer (Q63, v0.123).* The **longer arrows**
   show a **stronger spin**.
   - **Eddy strengths:** eddies turn a ship **60°, 120° or 180°** (a 180° eddy exists but isn't drawn yet). The art will mark the
     amount with notches or bobbles on the arrows.

   <img src="images/currents/example-7-eddy-a.jpg" width="300"> <img src="images/currents/example-7-eddy-b.jpg" width="300">

8. **Current to a non-adjacent hex** *(designer, v0.124; no picture yet, the draft art had the ship colours swapped)*: an arrow can
   carry a ship to a hex that **isn't next to hers**, e.g. straight across the **corner between two hexes** to the hex beyond. Nothing
   forbids it, and it's useful: it can take a ship somewhere she couldn't otherwise reach. In the designer's example a ship facing
   south-west is carried across the corner between whirlpools 5 and 6, past a line of reefs, into the hex beyond, still facing south-west.
   - She goes **straight to the arrow's end hex**: she **doesn't enter the hexes in between** (here she doesn't fall into either
     whirlpool), so nothing on the way affects her: whirlpools, reefs or ships.
   - It counts as **one current step** (a single arrow acts in the single-arrow sub-step); if the end hex is occupied she **stays put**,
     as with any blocked current. ✅ *Designer (Q65, v0.126).*

9. **2-hex rotor** *(designer, v0.125)*: an oval ring of arrows around the **middle of the edge between two hexes**. It turns everything
   **180°** around that point: a ship is carried into the other hex and **ends facing the opposite way** (north-east ↔ south-west in the
   picture). Ships on both hexes **swap places**, as with the 4-hex rotor (example 5).

   <img src="images/currents/example-9-two-hex-rotor.jpg" width="300">

**Rotors in general** (examples 4, 5 and 9): a ring of arrows round a point turns every ship on it around that point; she moves to the
hex the rotation takes her to and turns by the same angle. The 2-hex rotor (round an edge) turns 180°, the 3-hex ring (round a corner)
120°, and the 4-hex rotor 180°. The art will mark the angle with notches or bobbles.

**Designer's principle:** the turning amounts only need to be **consistent and predictable**; players learn them quickly. The art will mark
the number of hex sides wherever it isn't obvious. The **digital version** stores the exact move and turn for every arrow in the map data,
so it never has to read the art.

- **Eddies** (circular arrows within a hex) **spin** the ship in place by 60°, 120° or 180° per Currents phase, depending on the eddy (examples 6–7).
- **Order of activation** (like RoboRally's express conveyor belts): currents move in **three sub-steps**, 1 hex each:
  1. **Triple** currents move 1 hex.
  2. **Double and triple** currents move 1 hex.
  3. **All** currents (single, double, triple) move 1 hex.

  So triple currents move 3, double 2 and single 1, all finishing together, and a ship can be carried from one current onto another
  between sub-steps. Conflicts within a sub-step are resolved in **Sail (Move-slot) initiative order**.
- *Dashed eddies, gyres and the maelstrom: designer's diagram (Q20).*

### 6.7 Stranded by the tide
- A ship on a sandbank or underwater reef when the tide turns it into land is **stuck** (stranded) until the tide makes it water again.
- While stuck she **can't sail or steer**, and **can't be moved or turned** by anything (currents, pushing, drift), but **can still use
  her Action slots** (fire, repair, heal).
- A stuck ship is **on land** (the dried-out hex), so for other ships her hex is **beach land**: it stops them, and she **can't be pushed**.
- **Haul her out** (adopted): spend a **whole turn** to move the ship **1 hex**, hopefully
  into water.

### 6.8 Teaching aids for sailing *(design goal: make wind easy)*
Ideas to playtest:
- Print the chart on every ship board, or on a **wind-rose card** that sits beside the board pointing downwind.
- A **ship token or base with sail numbers printed round its edge**: set it against the wind arrow and read off the move.
- The online version shows each ship's move distance (and a ghost preview) while programming.



## 7. Combat / conflict resolution

### 7.1 Cannon fire
<img src="images/cannon-fire-arcs.png" width="420">

- **Fire Cannons** (Action phase) fires **both broadsides** at once.
- **Range: 4 hexes.**
- **Arc** (from the diagram, with flat-topped hexes and the ship's bow pointing at a hex side): each broadside covers the
  **60° wedge abeam**, bounded by the forward-quarter and aft-quarter hex directions on that side, **including the
  hexes on those two boundary lines**. That's 2 + 3 + 4 + 5 = **14 hexes per side, 28 in total**.
  No fire forward or aft; the hexes directly ahead and astern are always safe.
- Engine note: in cube coordinates, a broadside arc is the set of hexes within distance 1–4 that lie in the sextant
  between the two neighbour directions on that side of the ship.
- **Each target hit takes 1 DD** (§7.2).
- **Targets: every enemy ship in both arcs is hit**, so one Fire Cannons order can hit several ships.
  - **No friendly fire**: teammates are never hit.
  - **Holding fire**: the firing player may choose **not to fire at any particular target** (e.g. to spare a temporary ally in free-for-all,
    or to avoid a ship they'd rather not provoke). Everything else in the arcs is hit.
- **Other ships don't block** cannon fire: every enemy in the arc is hit.
- **Other weapons** (forward, aft, special) come only from **crew and equipment**; there's no ammunition or reload limit.
- **Cannon fire does not pass through whirlpool portals or sea caves.**
- Cannons **fire over land and cliffs** (they don't block line of sight).
- **Fog**: a ship **in fog can't fire** (can't aim) and **can't be hit**, and **cannon fire can't pass through fog**. Fog has no other effect.
  The mechanic may be reused: **fog tokens** could be placed for various reasons (scenarios, weather, equipment).
- *Line of sight, damage per hit and timing: Q33.*

### 7.2 Damage dice (DD)
- Damage is dealt as **Damage Dice (DD)**: whenever damage occurs, the ship **takes DD**, i.e. a **12-sided damage die is rolled** for each DD.
- There are **two types of damage**: **Ship** (hull/rigging) and **Crew**. One roll deals **0–2 of each**, or a **Critical hit**.
- **Sources of DD:**

| Source | DD |
|---|---|
| Cannon hit (each enemy ship in the arcs) | **1 DD** |
| Ramming | **1 DD** to the **rammed** ship (in a push chain, only the first ship hit) |
| Gale, per Full Sail | **1 DD** (§3.5) |

**Damage die (d12)**, provisional, will be playtested:

| Roll | Ship | Crew | |
|---|---|---|---|
| 1 | 0 | 0 | Miss |
| 2–3 | 1 | 0 | |
| 4–5 | 0 | 1 | |
| 6–7 | 1 | 1 | |
| 8 | 2 | 0 | |
| 9 | 0 | 2 | |
| 10 | 1 | 2 | |
| 11 | 2 | 1 | |
| 12 | — | — | **Critical hit**: *for now* **roll this DD again, plus 1 extra DD** (a critical damage card deck may replace this later) |

Odds per d12 roll: **1 in 12** misses; **1 in 12** is critical; **3 in 12** deal 3 total damage. Ship and Crew are symmetrical. Including the
extra dice criticals add, each DD averages about **0.9 Ship + 0.9 Crew**.
A critical rolled while resolving a critical adds further dice (chains are possible but rare: 1 in 12 per die).
For the physical game this could be a **custom d12 with icons**; online it's a lookup table.

### 7.3 Ship damage
- A marker on a slot whose Part has **already resolved** this turn simply blocks it **from next turn**.
- For each point of **Ship damage**, the player places a **damage marker** on one of the **9 slots** of their ship board
  (Sail, Steer or Action in Parts I–III). **The damaged player chooses which.**
  - Any card in that slot is **removed**.
  - That slot **can't be used** until repaired. So a blocked Sail slot means **No Sail** that Part (§3.4); a blocked Steer slot means no turn; a blocked Action slot means no action.
- **Sinking**: if a ship has **no usable Sail slots, no usable Steer slots, or no usable Action slots** (any whole row blocked),
  she **sinks**.
- So a ship can survive at most **6 Ship damage** (2 per row), and the next one sinks her. But even **2–3 damage is crippling**:
  each marker takes away a choice.

### 7.4 Crew damage
- For each point of **Crew damage**: **wound** a healthy crew member (flip the card) or **kill** a wounded one (remove it).
  **The damaged player chooses which.**
- Losing crew means **drawing fewer command cards** (§5.1), so crew damage starves your options over time.
- **Sinking**: a ship with **no healthy crew** sinks.

### 7.5 Damage summary
| | Ship damage | Crew damage |
|---|---|---|
| Effect | Blocks programming slots | Fewer cards drawn |
| Death spiral? | Yes: fewer slots, fewer choices | Yes: fewer cards, fewer choices |
| Sinks when | Any whole row (Sail/Steer/Action) is blocked | No healthy crew |
| Fixed by | **Repair** action; full refit at home port (§7.7) | **Heal** action; full refit at home port (§7.7) |

### 7.6 Repair and Heal (Action phase)
- **Repair**: fixes Ship damage, i.e. removes a damage marker from **any slot**, including one in the current Part *(**1 per action**).
- **Heal**: fixes Crew damage, i.e. flips **1** wounded crew member back to healthy (it can't revive dead crew).
- Both are **Action-band** orders, so they compete with **Fire Cannons** for the Action slots. Repair can only be programmed while at least
  one Action slot is usable.

### 7.7 Refit at home port
- A ship that **ends a turn at her home port** can **refit**:
  - **Fully repair**: remove all damage markers.
  - **Fully heal**: flip all wounded crew to healthy.
  - **Recruit** back up to **3 crew**, drawn **at random** from the crew deck.
  - A ship may do **only part** of a refit (e.g. just recruit), but it **still costs the next turn**.
- **Cost: the next turn**: she spends the following turn in port and **can't do anything** (no sailing, steering or actions).
  She **still draws cards** as normal.
- The home port's guns (§8.2.4) protect her while she refits.

### 7.8 Sinking and coming back
- A ship sinks when any whole row of slots is blocked (§7.3) or she has no healthy crew (§7.4).
- **Board edge**: leaving the map sinks a ship in the hex she was about to leave (§3.1).
- **On return** her player chooses her **heading**; her **sail is down**. If the port hex is occupied, she comes back in the **nearest free hex** (sea, never a death reef; her player chooses between equally near ones) (Q71).
- **She comes back at Upkeep** (not straight away) and plays the **next turn as normal** (she doesn't miss it).
- She **discards her hand** of command cards and **draws a new hand** from her new crew.
- **She comes back at her home port**, **fully repaired** with **3 healthy crew, drawn at random** (her old crew, **including her
  Captain, are lost**). No player elimination (P6).
- **That's the penalty for sinking**: the **Captain** is the most powerful crew card (e.g. *Captain Mammoth* draws 3 command cards,
  a *Pirate* draws 1), so a ship rebuilt with 3 random crew is much weaker than one with her Captain.
- Any **treasure she carried drops in the hex where she sank**, ready for anyone to pick up.
- She leaves a **shipwreck** where she sank (§7.9).

### 7.9 Shipwrecks
- **Number at setup = number of ships**, placed by mutual agreement or in turns, as part of designing the map (§3.1.1).
- **Shipwreck tokens** are placed on the map at setup, and **every ship that sinks leaves a new shipwreck token** where she sank.
- **Searching** happens during **Upkeep**: a ship that **ends the turn on** a wreck (sea), or **next to** it if the wreck is on land,
  searches it and draws a **wreck card**.
- The wreck token is **removed once searched**.
- **Core game / prototype:** searching a wreck gives **a crew card** (from the crew deck). A meaningful reward.
- **With the equipment add-on:** a wreck gives at random either a crew card or an equipment card.
- **Wreck deck (eventually):** like Monopoly's Chance cards, **mostly good, lots of variety**: e.g. repair, heal, crew, equipment,
  treasure, "choose another player: they take 1 DD", and the occasional bad result. **Variety is part of the fun.**

### 7.10 Equipment
- **Equipment cards** are mostly **single-use**, and can be **played at any time** *(exact timing windows: Q50)*.
- Example: **Explosive cannon balls**: +2 DD to any attack.
- Design contrast: **crew = permanent benefit; equipment = one-shot burst**.
- **Information:** **crew are open** (face up, everyone can see them); **equipment** and **command cards** are **hidden hands**.
- **No limit** on equipment held.
- Equipment is **kept when a ship sinks** (it isn't lost or dropped).

*Critical hits (d12 = 12): for now, roll that DD again plus 1 extra DD (§7.2). A critical damage card deck may replace this (Q56).*

### 7.11 Flotsam *(equipment add-on, designer's choice in v0.95)*
Equipment is single-use, so it needs to be more plentiful. **Flotsam tokens** float on the sea; a ship that **moves over** one (any
movement) removes it and draws an **equipment card**. Flotsam **doesn't drift**: currents and wind leave it where it is.

Flotsam appears in two ways:
- **Battle debris:** when a ship takes **Ship damage** (not Crew damage), place a flotsam token in the hex **directly astern** of her
  (behind her). If that hex is **blocked** (land, a ship, treasure or flotsam), **no flotsam** is placed. Chasing a damaged ship pays off.
  **One token per damage event** (a second token couldn't be placed anyway: the hex astern would already be blocked). Ship damage from
  any source counts: attacks or hazards like cliffs, wall reefs, rough water and storms.
- **Weather:** a weather card marked with a **flotsam icon** brings **one** flotsam token when it comes into play *(designer to mark the cards)*. The **player in last place** places it in an
  **empty sea hex more than 5 hexes from every ship**. If there's no such hex, **no flotsam** is placed.

**Pool:** a fixed pool of flotsam tokens; flotsam is only placed while tokens are left in the pool, and picked-up tokens return to it.
The pool size will vary with **map size and player count** (set by the scenario); **5 for now**, to playtest.

### 7.12 The Derelict *(add-on, adopted v0.97)*
An abandoned ship drifting with valuable cargo: a moving prize that the wind and currents control.
- **Appears:** a **Dead Calm** weather card announces it; the Derelict arrives when the **next weather card with wind** comes into play,
  on that wind's **upwind map edge**. (If the next card is another Dead Calm, it waits for the first card with wind.) Because the weather
  board shows the current and next card, players can see it coming. At most one Derelict on the board at a time.
- **Placement:** the **player in last place** (lowest score: fewest treasures scored in Treasure Hunt) places it in any **empty sea hex on
  that upwind edge**. Ties are rolled off. A gentle catch-up rule: the player who most needs the prize aims it.
- **Moves:** like a ship at **No Sail**: currents carry it and wind drift pushes it. It never sails or steers.
- **Obstacle:** sailing into it pushes it, with no DD. Currents and drift don't push it.
- **Boarding:** a ship that **ends a turn next to it** boards and loots it: **2 equipment cards + 1 treasure** (the treasure only if her
  ship isn't already carrying one). Several ships boarding on the same turn take the loot one item at a time, in Sail initiative order.
  The Derelict is then **removed**.
- **Sinking it:** it can be shot (it's a valid target in the broadside arcs). It sinks after taking **4 DD** in total (count the dice dealt to it; they aren't rolled, since it has no crew or ship board)
  and leaves **flotsam** (§7.11).
- **Lost:** if it drifts off the map or onto a death reef, it's gone.
- **Treasure counts:** its treasure **counts towards the treasures in play** (§8.2.1). If the maximum are already in play, the Derelict
  carries **only the 2 equipment cards**.

## 8. Game modes & winning
The **core rules (§3–7) are the same in every mode**. A mode only adds an **objective**, any **mode components**
(checkpoints, treasure, flags) and **win/end conditions**. That way new modes are cheap to add, and in the engine each
mode is a plug-in objective module on top of a shared rules core.

| # | Mode | Players | Objective (summary) | Status |
|---|---|---|---|---|
| M1 | **Race** | Free-for-all | Reach the **checkpoints in order**; first to finish wins. The simplest mode, and the one to teach with. | Defined below |
| M2 | **Treasure Hunt** | Free-for-all | **Core game.** Pick up treasure and **return it to port**; first to **3 or 5** treasure wins. Treasure **spawns randomly** and **can be stolen**. | Defined below |
| M3 | **Deathmatch** | Usually teams | Fight. | Outline |
| M4 | **Capture the Flag** | Teams | Take the enemy flag back to base. | Outline |
| M6 | **Solo Challenge** | 1 vs the board | Bring home as much treasure as possible in **14 turns**; the treasure is the score. | Defined below (v0.143) |
| M5 | **Solo / Co-op Adventure** | 1+ vs the game | Explore, fight **ghost ships and monsters**. | **Deferred** until the core game is finished. Hardest mode (needs AI-controlled enemies). |

### 8.1 M1 Race
- Checkpoints are **placed by agreement at setup** and must be reached **in order**, by **passing through** them. The first ship (or team,
  §8.6) to reach the last checkpoint wins.
- A sunk ship comes back at her **last checkpoint reached** (instead of her home port).

### 8.2 M2 Treasure Hunt (core game)

**Setup**
- Each player has a **home port** (§8.2.4). *(Placement: Q44.)*
- The map has **N treasure spawn points**.

**8.2.1 Spawning**
- Treasure appears at **one of the N numbered spawn points, chosen at random** using the **treasure map deck**:

  <img src="images/treasure-map-1.png" width="120"> <img src="images/treasure-map-3.png" width="120">

  - **N = 9 spawn points** (for now), placed as tokens by mutual agreement or in turns, as part of designing the map (§3.1.1).
  - A small deck of hex-shaped **treasure map cards**, numbered 1…9 (one per spawn point).
  - *Naming:* spawn points may get **non-numeric symbols** to avoid confusion with the numbered whirlpool portals.
    The spec uses numbers for now.
  - To spawn a treasure, **turn over the top card**: the treasure appears at that numbered spawn point.
  - The deck is drawn from the top **on purpose**, so that **crew or equipment can let a player peek** at the next card
    for an information advantage (§3.6).
  - When the deck runs out, **reshuffle** it.
  - If the spawn point is **occupied by a ship**, that's fine: the treasure appears there and **can be claimed immediately**.
  - **Only one treasure per spawn point**: if the drawn point already has a treasure, **draw again**. If **every** spawn point already has
    treasure, **skip** the spawn.
- **Treasures in play at once = (number of ships − 1) / 2, rounded up**:

| Ships | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| Treasures | 1 | 1 | 2 | 2 | 3 | 3 | 4 |

  (The same as **half the number of ships, rounded down**.)
- Treasure **being carried or knocked loose still counts** as in play. A **new treasure spawns only when one is scored**,
  and it appears during the next **Upkeep** (§5.4).
- At setup, the starting treasures are spawned the same way, with the treasure map deck.

**8.2.2 Picking up**
- **Treasure in a water hex**: picked up by **passing through** the hex (you don't need to end your move there).
- **Treasure on land**: picked up by **ending a turn adjacent** to that land hex (end of Part III), which represents going ashore and digging.
- **Game-length dial**: spawn points can be set up as **all sea** (fast game), **all land** (slower), or a **mix**.
- **A ship can carry only 1 treasure.** *(Does a full ship sail through a treasure hex without picking it up? Assumed yes.)*

**8.2.3 Stealing / knocking loose**
- When a ship carrying treasure is **rammed** or **hit by cannon**, the attacker may **give up a damage die (DD)** they would
  deal and **knock the treasure loose** instead.
- The **attacker** places the treasure in a hex **adjacent to the victim**, sea or land (including reefs and sandbanks), as they choose. The
  hex **must not already hold treasure** but **may hold a ship**.
- Anyone can then pick it up as normal (§8.2.2). In practice the attacker places it where they can grab it, or where a rival can't.

**8.2.4 Home port & scoring**
- Each player (or team) has a **home port**: a **4-hex port tile** attached to the edge of the map at setup (§3.1.1). It is **indestructible** and **has guns**
  with **range 2 hexes** dealing **1 DD**, so other ships keep their distance. They fire **every Action phase**, in **all directions**,
  at **every rival ship** within range, **after all ships have fired**. Fog hides a ship from them.
- A ship must **enter** the port hex to be in port (to score treasure, refit or come back after sinking). The **port hex** is the tile's
  **only sea hex** (marked ✗ in the example); it's the only hex of the tile a ship can enter.
- **Shelter from the weather:** **no weather effects or consequences of any kind occur while a ship is in her port**, from the moment she
  enters the port hex: no wind drift, no storm damage, no Gale damage. "Any port in a storm."
- **Leaving port** follows the same rule, even when it seems odd: while she's still in port the weather doesn't affect her, so she always
  gets out; the moment she's on the hex outside the port, the weather applies as normal (in a Dead Calm she goes no further).
  *My working of this for the engine ❓:* she always moves **1 hex out of port**, ignoring wind and weather; the **rest of her sail move**
  is then worked out normally from that hex (points of sail and the weather card), less the hex already used.
- Treasure is **scored, and safe, once it reaches the carrier's (team's) home port**; it **can't be scored at anyone else's port**. It can't be stolen after that.

**8.2.5 Winning**
- The first player to score the **target** wins. The default is **3**; adjust for game length and player count:

| Players | Suggested target |
|---|---|
| 2 | "Best of 5", i.e. **first to 3** |
| 3–6 | 3 |
| 7–8 | 2 |

**8.2.6 Variant: Timed game**
- Play to a **timer** (a fixed time, e.g. 2 hours; the designer's choice over a turn limit). When time runs out, the player who has **scored the most treasure wins**.
- When time is up: finish the current turn (all 3 Parts) so everyone gets the same number of turns.
- **Tie-breaks** (proposed, to playtest; pick one or chain them in order):
  1. A player **carrying** treasure beats one who isn't.
  2. The carrier **nearest their home port**.
  3. **Sudden death**: play on until a tied player scores.
- **Turn-limit option** (proposed): end after a fixed number of turns instead of wall-clock time. The weather board's
  6-turn tide cycle gives natural lengths: **2 tide cycles = 12 turns** for a short game, **3 = 18** for a long one. A turn limit
  is predictable, needs no timer, and suits the online version, especially asynchronous play.

### 8.3 M3 Deathmatch
- Ship combat, usually in teams. *Open: Q43.*

### 8.4 M4 Capture the Flag
- Teams. *Open: Q43.*

### 8.6 Teams
Ships can be on **teams**: either **players on a team** (e.g. 4 players in 2 teams of 2) or **one player commanding two ships** (Fleets, §8.7).
The same rules apply either way. **Teammates**:
- **share one home port** (refit, scoring, coming back after sinking);
- **talk openly**: teammates may discuss plans and show each other their hands and programs;
- **share goals**: treasure scored by any teammate counts for the team; in **Race**, a checkpoint only needs to be reached **once per team**;
- **never hit each other** (no friendly fire, §7.1);
- **can push each other**, but ramming a teammate deals **no DD**;
- **can pass treasure**: **ram your teammate** and knock her treasure loose **without the DD**, placing it in a hex next to her that holds no treasure
  (the normal knock-loose rule, §8.2.3); then pick it up as usual.
- Treasure Hunt **target is 3 per team**, as for a single player (§8.2.5).

Counts that depend on ships use the **number of ships**, not players or teams (e.g. treasures in play, §8.2.1).

### 8.7 Variant: Fleets (two ships per player): the **expert** version
For experienced players: **each player commands 2 ships**, which form a team (§8.6). Inspired by the designer's way of playing RoboRally with
two robots each, which makes 2-player games full and rich (it gets heavy beyond 3–4 players). **Firmly the extreme version**; not for everyone.
- **Recommended for 2 players** (4 ships on the sea); possible with 3–4 players (6–8 ships). Maximum 8 ships in total.
- Each ship is a full ship: her own **ship board, crew (Captain + 2 at the start), hand of command cards, damage, sail level, programming
  and initiative**.
- *Later variant to explore:* **combined hand**: the player draws one hand for both ships and splits it between the two ship boards.

### 8.5 M5 Solo / Co-op Adventure *(deferred)*
- Exploration plus AI-controlled ghost ships and monsters. Overlaps with the optional sea monster (§9.1). Not to be designed until the core game is finished.

### 8.8 M6 Solo Challenge
One player against the board, for a score, like the solo modes of many board games (designer, v0.143). A first version, to be made more
elaborate later.
- **Setup** as Treasure Hunt (§8.2) with **one ship**.
- **Treasure Hunt rules apply**, except that there is **no target**: the game lasts **14 turns** (`soloTurns`), and ends after **Part III of
  the 14th turn** (no Upkeep).
- **Score** = treasure brought home to her port. Players compare scores between games.
- ❓ **1 treasure** on the map at a time (half of one ship rounds down to none); a new one spawns at Upkeep after each one scored (§8.2.1).
- ❓ One starting wreck (§7.9), as for each ship in other games.

## 9. Optional modules
**Core game** = §3–8 minus the modules below. Crew in the core game are **basic crew** (card icons only, no powers), plus Captains.

| Module | Section | Status |
|---|---|---|
| Sea monster | §9.1 | Add-on |
| Equipment cards | §7.10 | Add-on |
| Crew special powers (Surgeon, Retired Captain, peeking, 🐙 crew...) | §3.6 | Add-on |
| Wreck deck variety (Chance-style) | §7.9 | Add-on. **Core game: searching a wreck gives a crew card** |
| Points of Sail | §6.2 | Optional rule, **intended as standard** |
| Safe edge (map edge acts as a beach) | §3.1 | Optional rule, for an easier game |


### 9.1 Sea monster *(optional module)*
- **Setup**: placed as the scenario's setup says.
- **Influence**: a player's influence over the monster = the **🐙 icons on the command cards they programmed this turn**, plus the
  occasional crew member with a 🐙 icon, plus **every DD they hit the monster with last turn** (see Shooting below).
- **Movement**: during **Upkeep**, the monster moves **1 hex**; the player with the **most influence** chooses the direction. **Tie**: the tied player whose ship is
  **closest to the monster** decides *(still tied: roll off ❓)*.
  It **ignores all board elements**: it isn't blocked by land and isn't affected by currents, wind, tides, terrain, portals or caves.
- **Attack**: each Part, **after the Action phase**, it deals **1 DD to every ship next to it**.
- **Deadly hex**: a ship that **enters the monster's hex sinks**, however she gets there (sailing, drift, current or push), and if the monster **moves onto a ship**, that ship **sinks**.
- **Shooting it**: the monster **can be shot** like a ship: it must be **in your broadside arc**, and **fog hides it**. It **can't be killed**, but each DD that hits it is
  **added to the shooter's influence next turn**. Hurting it lets you steer it.
- It **can't be pushed**.
- **Design intent** (unplaytested):
  - Influence comes **mostly from programmed command cards**, so it's spread round the table and rarely concentrated in one player.
  - 🐙 crew are **rare** and give only **+1**.
  - The monster moves only **1 hex per turn**, so it's **area denial** more than an assassin.
  - **Playtest watch-list**: one player steering it onto a leader repeatedly; shooting it to gain influence becoming a dominant strategy.

## 10. Glossary
| Term | Definition |
|------|------------|
| Crew card | A crew member; healthy or wounded; its command-card icons set how many cards you draw (§3.6, §7.4). |
| Influence | A player's control over the sea monster: programmed 🐙 icons + DD dealt to it last turn (§9.1). |
| Shipwreck | A token; start-of-game wrecks plus one per sunk ship; searched at Upkeep for a wreck card (§7.9). |
| Equipment | Mostly single-use cards, playable any time, e.g. Explosive cannon balls (+2 DD) (§7.10). |
| Damage marker | Blocks one of the 9 ship-board slots (§7.3). |
| DD | Damage Die: a d12 rolled for each point of damage taken; gives Ship and/or Crew damage or a Critical hit (§7.2). |

## Designer to-do
_Things the designer has said they'll do or supply._
- **Current-types diagram** (turning amounts, eddies, gyres, maelstrom) for players and for this spec (Q19/Q20).
- **Gale card**: add "1 DD for each Part sailed at Full Sail, taken at Upkeep" to the card text (§3.5).
- **Suggested layouts** for the rulebook (§3.1.1).
- **Real board design**: the current boards are prototype examples. Design the real boards, and grade each one Category 1, 2 or 3 (§3.1.1).
- **Weather board**: add a **rotating arrow** to mark "now" (a pencil for now) (§3.5).
- **Check the derived rows** of the full sail-move table (§6.3).
- **Weather cards**: mark the cards that bring **flotsam** with an icon (§7.11).
- **Current art**: consider **colouring double and triple arrows** (e.g. orange and red) so speeds stand out.
- **Current art**: make the **rotation amount explicit** on turning arrows (an icon or marking for 60°, 180°, etc.), especially on rotors and eddies (eddies come in 60°, 120° and 180°; draw the 180° eddy),
  where the 180° turn isn't yet clear from the arrows, and show when a curve turns only one hex side (§6.6, examples 2–4).
  *Designer's plan: little bobbles on the arrow, one per hex side turned.*
- **Weather cards, Points-of-Sail aid**: make the weather cards bigger and print the Half / Full move on each edge, coloured by point of sail (§3.5, table there).
- **Command deck list** (band combinations, unique initiative numbers) and **crew deck list** (≥ 50 cards).
- **Fix the duplicate 360 card**: *Row Ahead 1 / Hard About / Repair* should be **380** (the other, *Row Back 1 / Hard About / Heal*, stays 360). Correct the card art and `data/cards/command-cards.csv`.

## Open questions
_Rewritten in v0.90, updated v0.93. Only unanswered questions are listed; answers are in the rule sections and
the change log. ❓ in a rule section marks my reading of an answer, to confirm. Old Q-numbers are kept._

### A. Needed for the prototype
_None: all prototype questions are answered (apart from the designer's diagrams and card lists, see Designer to-do)._

### B. Needed for a full game
1. **Q43 Deathmatch / Capture the Flag**: scoring, end condition, flag rules. *(Designer: TBD.)*
- ~~Q50 wreck placement; Q18 / Q3c board construction~~ → answered (§3.1.1, §8.2.4): 37-hex main boards, joined however players agree; the port
  hex is the port tile's only sea hex and shelters ships from the weather; the printed town is scenery; spawn points and wrecks placed by
  agreement or in turns.
- **Q60 Leaving port** (answered: weather doesn't apply in port, applies from the first hex outside). Confirm the engine working in §8.2.4 (1 hex out free, then the rest of the move normally).

### C. Detail
- ~~Q63 Eddy turning amount~~ → the 3-arrow eddy turns 120°; eddies come in 60°, 120° and 180° (v0.123).
- ~~Q66 Refilling the weather board~~ → the card leaving "now" is discarded, the space gets the top card of the weather deck, and the
  discards are reshuffled when the deck runs out (designer approved, v0.137).
- ~~Q71 Nowhere to come back~~ → if her port is occupied she comes back at the **nearest free hex** (designer, v0.142). "Nearest"
  counts hexes in a straight line, ignoring land in between (designer). ❓ Equally near hexes: her player chooses.
- ~~Q70 Blocked curved current~~ → a blocked current neither moves nor turns her (designer agreed, v0.140).
- ~~Q69 Caves, edge cases~~ → caves just join two hexes for movement; normal pushing and blocking rules apply (v0.140).
- ~~Q68 Rowing~~ → pushes and rams like sailing (v0.132).
- ~~Q67 Anchor details~~ → ramming her stops the mover and she takes the 1 DD; only Steer turns her; lasts for its own Part (v0.133–v0.135).
- ~~Q65 Currents to a non-adjacent hex~~ → straight to the end hex, in-between hexes ignored; one step; occupied end hex = stay put (v0.126).
- ~~Q64 Board categories~~ → a broad guide only, not strict; details when the real boards are designed (v0.127).
- ~~Q62 Ring round a hex corner~~ → two hex sides (120°), like a 3-hex rotor (v0.122; corrects v0.120); bobbles on the art planned.
- ~~Q61 Rotors~~ → 4 hexes around the centre, all carried; single-arrow step; blocked = stay put (answered).
- **Unconfirmed assumptions** still marked ❓ in the sections (confirm or correct):
  - Dashed eddy, gyre and maelstrom readings in §3.2 (to be replaced by the current diagram); eddies act in the single-arrow sub-step (§6.6 example 6).
2. **Q56 Critical hits**: keep the placeholder (re-roll + 1 DD) or design a critical damage deck? *(Designer: not yet.)*

### D. Add-ons
3. **Q48 Crew deck**: Retired Captain's card icons and power; on a swap, where does the leaving card go; can a ship decline her? Surgeon: when
    does she heal (Upkeep?), and can she heal herself?
4. **Q50 Equipment**: exact play windows ("any time"), especially during other players' attacks; can "+2 DD to any attack" boost a rival's
    attack? Wreck deck contents beyond crew and equipment, including bad results.
5. **Sea monster**: equal-distance influence tie (roll off?).

## Change log
- v0.1 — skeleton created.
- v0.144 — §3.5 Points-of-Sail player aid: bigger weather cards with the Half / Full move printed on each edge (designer).
- v0.143 — §8.8 Solo Challenge (M6): one ship, 14 turns, score = treasure brought home (designer).
- v0.142 — Q71 answered: a returning ship whose port is occupied comes back at the nearest free hex.
- v0.141 — §7.3 corrected (a blocked Sail slot means No Sail); Q71 a sunk ship with nowhere to come back (engine assumption from step P5).
- v0.140 — Q69: caves join two hexes for movement (not cannon fire); normal pushing and blocking apply. Q70 agreed: a blocked current doesn't turn the ship.
- v0.139 — Q70 blocked curved currents (engine assumption from step P4).
- v0.138 — Q69 cave edge cases (engine assumptions from step P3).
- v0.137 — Q66 answered: weather board refill (discard the old card, refill from the deck, reshuffle discards when empty).
- v0.136 — Lightning Storm and Hurricane weather cards left out for now.
- v0.135 — Q67c: Anchor lasts only for its own Part. Q67 closed.
- v0.134 — Q67b: currents (eddies included) don't turn an anchored ship; only her Steer card does.
- v0.133 — Q67a: anchored ships stop movers and take the ram damage.
- v0.132 — Q68: rowing pushes and rams.
- v0.131 — Row Ahead 1 / Row Back 1 = 1 hex ahead or astern whatever the wind (Q68: pushing?); Hard About = 180°; the second 360 card is 380 (designer to fix the art).
- v0.130 — optional rule **Safe edge**: the map edge acts as a beach (ships stop instead of sinking).
- v0.129 — **sail level is no longer persistent**: every Part starts at No Sail; a Sail card sets the level for its Part only. **Anchor** = No Sail and no movement of any kind (sailing, pushing, drift, currents) but turning allowed (Q67 for details). No No Sail card exists.
- v0.128 — §6.5 tidied (ramming DD and pushed-into-obstacle effects were already answered); Q66 weather board refill.
- v0.127 — board categories are a loose guide (Q64); all board art so far is prototype examples.
- v0.126 — Q65 confirmed: non-adjacent current jumps ignore in-between hexes, count as one step, blocked = stay put.
- v0.125 — current example: 2-hex rotor round an edge, 180° swap.
- v0.124 — currents may carry a ship to a non-adjacent hex (e.g. across a hex corner); in-between hexes ignored ❓ (Q65).
- v0.123 — Q63: eddies turn 60°, 120° or 180° (longer arrows = stronger spin; 180° eddy not drawn yet).
- v0.122 — Q62 corrected: the ring round a hex corner turns ships 120° (a 3-hex rotor); example picture replaced.
- v0.121 — board categories 1–3 (like hurricanes): Category 1 forgiving and open for beginners, Category 3 dense (Q64).
- v0.120 — current examples: river and sideways straight currents; Q62 answered (corner ring turns 60°); 3-arrow eddy example (Q63: 120°?); turning amounts need only be consistent.
- v0.119 — current example: eddy turns the ship 60° in place, no movement (resolves the eddy ❓ in §3.2).
- v0.118 — current example: small ring around a hex corner (Q62: 60° or 120°?).
- v0.117 — current example: anticlockwise curved current (60°).
- v0.116 — currents act on ships whose hex has an arrow starting in it; rotor details confirmed.
- v0.115 — current example 3: rotors turn ships around a point between hexes (example: 180°, ships swap and reverse). Designer to-do: show rotation amounts on the art.
- v0.114 — current example 2: curved arrows move 1 hex and turn the ship 60° in the curve's direction.
- v0.113 — confirmed: straight currents don't turn the ship.
- v0.112 — current example 1: a straight single arrow moves the ship 1 hex, heading unchanged.
- v0.111 — leaving port: weather doesn't apply until the ship is outside the port hex.
- v0.110 — port shelter: no weather effects or consequences of any kind in port (Gale damage included).
- v0.109 — 37-hex boards standard; boards joined by agreement; port hex = the tile's only sea hex, sheltered from weather; printed town is scenery; spawn points and wrecks placed by agreement or in turns.
- v0.108 — building the map (§3.1.1): main boards and 4-hex port tiles; players choose the layout; 2–4 boards normal; port placement rules.
- v0.107 — Upkeep order: sunk ships return (step 2) and Gale damage (step 6) placed, as proposals. Rulebook updated to playtest draft 0.2.
- v0.106 — any Ship damage drops flotsam; flotsam fully specified (Q58 closed). Restored three add-on questions (crew deck, equipment timing, sea monster tie) accidentally dropped in v0.102.
- v0.105 — weather flotsam placed by the player in last place, more than 5 hexes from any ship.
- v0.104 — flotsam-icon weather cards bring one token.
- v0.103 — flotsam: one token per damage event.
- v0.102 — flotsam details: Ship damage only, blocked hex = none, weather icon, pool 5, no drift, picked up by any movement.
- v0.101 — the Derelict carries only equipment when the maximum treasures are in play; Q59 closed.
- v0.100 — the Derelict sinks after 4 DD.
- v0.99 — the Derelict is placed on the upwind edge by the player in last place.
- v0.98 — the Derelict arrives with the next weather card that has wind, on its upwind edge.
- v0.97 — the Derelict adopted (§7.12): brought by Dead Calm, sinks after 4 damage, its treasure counts.
- v0.96 — flotsam capped by a fixed pool of N tokens.
- v0.95 — flotsam (§7.11): battle debris astern of damaged ships plus weather cards; gives equipment cards. Details in Q58.
- v0.94 — confirmed: random starting crew; starting treasures via the treasure map deck; 2-player target first to 3; sandbar wreck is a starting wreck.
- v0.93 — Repair/Heal fix 1 each; a sunk ship doesn't miss a turn and draws a new hand; no scoring at other ports.
- v0.92 — used cards roughly shuffled onto the bottom of the deck; sunk ships come back at Upkeep; spawn points are scenario tokens; Gale 1 DD per Part at Full Sail.
- v0.91 — confirmed: knock-loose hex rule, weather board shows current + next, caves push on exit however entered, partial refit.
- v0.90 — designer answered the v0.89 list: board edge sinks; unique initiative; discard down to 9; ships don't block fire; damage timing; wounded crew; partial refit; return heading and blocked port; spawn and knock-loose hexes; Gale DD at Upkeep; weather board; caves; port town is a home port; Race checkpoints; timer; wreck count; haul her out; other weapons from crew and equipment; reveal one Part at a time; minimum 2 players. Added a designer to-do list.
- v0.89 — open-questions review fixes: restored spawn marking, Repair/Heal amount, respawn timing and hand; critical-hit text made consistent; new Q56, Q57.
- v0.88 — open questions rewritten: only unanswered ones, numbered and prioritised.
- v0.87 — teams pass treasure by ramming (no DD); team target 3.
- v0.86 — teams share one home port and may talk openly and show cards.
- v0.85 — Teams (§8.6) generalised: player teams and Fleets share teammate rules; Fleets moved to §8.7.
- v0.84 — Fleets: expert variant; one port per player; one hand per ship; shared goals; teammates push without DD.
- v0.83 — Fleets variant: two ships per player; pillar P7 (players vs ships).
- v0.82 — setup (start in port, sail down, choose heading); critical = reroll + 1 extra DD (placeholder); Upkeep order proposed; stranding checked when the tide changes.
- v0.81 — at the crew cap, swap.
- v0.80 — crew cap 6.
- v0.79 — core game: searching a wreck gives a crew card.
- v0.78 — pillar P0 (core must match RoboRally's fun); core vs add-on modules table.
- v0.77 — monster hex sinks however you arrive; port guns fire every Action phase at all rivals within 2.
- v0.76 — sea monster: influence tie = closest ship; its hex sinks ships; must be in arc; fog hides it.
- v0.75 — sea monster rules (influence, movement, attack, shooting); port guns 1 DD; one treasure per spawn point; refit turn still draws.
- v0.74 — sea monster basics; ramming DD to the first ship only; refit turn = no actions; home port on map edge, guns range 2, must enter.
- v0.73 — treasure deck reshuffle; occupied spawn ok; land treasure at end of turn; rammed ship takes the DD; refit costs the next turn; weather board one space per turn; storm 3 DD (provisional).
- v0.72 — wind blows the way the arrow points.
- v0.71 — wind drift: 1 hex downwind, no pushing.
- v0.70 — a stuck ship's hex counts as land.
- v0.69 — rough water checked at the end of each Part; End of Part step added.
- v0.68 — rough water (2 DD); stuck ships immovable; wall reefs don't block cannon.
- v0.67 — fog rules; current sub-steps; eddies spin; stuck ships can still act.
- v0.66 — currents 1/2/3 and turning; terrain applies however a ship arrives; cannons fire over land; fog prevents aiming; tide stranding.
- v0.65 — terrain: cliffs, beaches, sandbanks, underwater reefs, death reefs, wall reefs; tide effects.
- v0.64 — push distance and obstacles; starboard steering; deck coverage; initiative for conflicts; cannon damage applied immediately; start Captain + 2; crew deck ≥ 50.
- v0.63 — command hand hidden; no equipment limit; equipment kept when sunk.
- v0.62 — crew open, equipment hidden.
- v0.61 — wreck searching at Upkeep; wreck deck; equipment cards.
- v0.60 — shipwrecks and the wreck deck.
- v0.59 — Retired Captain: strongest crew, won't serve with a Captain (swap).
- v0.58 — 8 identical Captains; Retired Captain in the crew deck; all ships identical.
- v0.57 — no factions: crew are prehistoric monsters, all Captains are mammoths.
- v0.56 — Surgeon heals 1 wounded crew per turn automatically.
- v0.55 — crew special powers (e.g. Surgeon heals).
- v0.54 — everyone starts with a Captain; sinking loses the Captain (respawn with 3 random crew).
- v0.53 — on return: fully repaired, 3 crew; treasure drops where she sank.
- v0.52 — sunk ships come back at home port; pillar P6: no player elimination.
- v0.51 — one shared command deck.
- v0.50 — home port refit: full repair, heal, recruit to 3 crew; costs a turn.
- v0.49 — the damaged player chooses slots and crew.
- v0.48 — design pillar P5: damage mostly slows you down.
- v0.47 — Repair and Heal actions.
- v0.46 — damage model: Ship damage blocks slots, Crew damage wounds or kills crew; sinking rules; crew cards set cards drawn; hand max 9.
- v0.45 — cannon hit = 1 DD; ramming = 1 DD.
- v0.44 — damage die (d12 table). Restored priority-A open questions accidentally deleted in v0.24.
- v0.43 — initiative ties: roll off.
- v0.42 — empty slot = initiative 0; tie-break options.
- v0.41 — higher initiative goes first.
- v0.40 — no friendly fire; firer may spare any target.
- v0.39 — initiative: Move slot card for movement, Action slot card for cannon.
- v0.38 — cannons hit all enemy ships in both arcs.
- v0.37 — simultaneous whirlpool entry resolved by initiative.
- v0.36 — cannons don't fire through portals or caves.
- v0.35 — pushes chain; new §6.5 Pushing.
- v0.34 — arriving through a portal doesn't trigger it.
- v0.33 — blocked cave exit: the emerging ship pushes.
- v0.32 — blocked whirlpool: the ship carries on.
- v0.31 — sea caves: lettered edge portals that set the exit heading.
- v0.30 — whirlpool portal rules (core).
- v0.29 — 9 spawn points; whirlpools confirmed as paired portals.
- v0.28 — treasure map deck chooses spawn points; peeking is a possible crew ability.
- v0.27 — treasure respawns at Upkeep only after one is scored; rounding up confirmed.
- v0.26 — treasures in play = (ships − 1) / 2.
- v0.25 — Treasure Hunt timed variant, with proposed tie-breaks and turn-limit option.
- v0.24 — Treasure Hunt: spawn points, pickup, 1-treasure limit, knock-loose instead of DD, home ports, targets.
- v0.23 — game modes: Race, Treasure Hunt (core), Deathmatch, Capture the Flag, Solo/Co-op (deferred).
- v0.22 — open questions cleaned up and prioritised.
- v0.21 — windward cases confirmed; full sail-move table.
- v0.20 — Gale on Half Sail windward = 1; windward lookup table.
- v0.19 — Gale on Full Sail windward = 2 hexes backwards.
- v0.18 — weather modifiers change move size, minimum 0.
- v0.17 — DD = damage die.
- v0.16 — weather board: 6-space circuit with High/Mid/Mid/Low/Mid/Mid tides.
- v0.15 — weather cards, weather circuit, weather sail modifiers, tides (Full Metal Planète style).
- v0.14 — No Sail confirmed as a card band.
- v0.13 — No Sail level (no sailing move; currents and drift still apply).
- v0.12 — basic sailing: Half 1, Full 2.
- v0.11 — points of sail chart (optional, intended as standard).
- v0.10 — 🐙 icon = sea monster movement (optional module, deferred).
- v0.9 — cannon fire: both broadsides, 60° arcs, range 4.
- v0.8 — card numbers are initiative.
- v0.7 — ship board layout (Parts I–III); order is Move → Steer → Currents → Action → Wind drift; wind strength sets drift count; empty slots defined; sail level persists.
- v0.6 — command cards (3 bands), 3 × 3 ship board, step order: movement → currents → wind. Currents don't push.
- v0.5 — design pillars: simultaneous execution, trust, embrace chaos. Removed my wrong claim that RoboRally scales poorly.
- v0.4 — board: modular hex tiles, currents, list of observed features from the example board.
- v0.3 — player count: 4 to start, target up to 8.
- v0.2 — overview, list of differences from RoboRally, first batch of open questions.
