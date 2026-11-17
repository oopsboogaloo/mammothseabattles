# Mammoth Sea Battles: Core Rules on One Page

> Draft summary of the **core game** (no sea monster, equipment or crew powers), written from [`rules.md`](rules.md) v0.81.
> **TBD** marks rules not decided yet. Section numbers point to the full spec.

**Goal (Treasure Hunt).** Be the first to bring **3 treasures** home to your port (2 with 7–8 players).

**Setup.** Build the sea from hex tiles. Each player puts a **home port** on the map edge. Place **wreck tokens** and the
**9 treasure spawn points**, then spawn **(ships − 1) ÷ 2, rounded up** treasures using the treasure map deck. Each ship starts in
port *(TBD)* with a **Captain + 2 random crew** (face up) and an empty ship board. Set up the **weather board**: the current card
and the **next two** are face up. Starting sail level *(TBD)*.

**Your hand.** Each turn, draw **1 command card per card icon** on your healthy crew (Captain 3, ordinary crew 1). Keep unplayed
cards; **hand limit 9**. One shared deck; used cards go back into it.

**1. Program (everyone at once, in secret).** Your ship board has **3 Parts × 3 slots: Sail, Steer, Action**. Each command card has
three bands; **only the band of the slot it's placed in counts**. Fill up to 9 slots. **Empty slot**: sail stays as set / no turn / no action.

**2. Resolve Parts I, II and III.** All ships act together; when they clash, **initiative** decides (higher first; empty slot = 0;
ties roll off). Movement uses the **Sail card's** number, firing uses the **Action card's** number.

| Phase | What happens |
|---|---|
| **a. Sail** | Set sail (**No / Half / Full**; it stays set), then sail forward (table below). Moving into a ship **pushes** it (chains allowed); the **first ship rammed takes 1 DD**. |
| **b. Steer** | Turn **60°** (Ease) or **120°** (Hard), port or starboard. |
| **c. Currents** | Arrows move ships 1/2/3 hexes (single/double/triple arrows, in 3 sub-steps), turning on curves; eddies spin ships. **No pushing.** |
| **d. Action** | In initiative order, damage applied at once: **Fire Cannons** = both broadsides, 60° arcs, **range 4**, **1 DD to every enemy** in arc (you may spare any). **Repair** = remove 1 damage marker. **Heal** = flip 1 wounded crew. Then **home ports** fire 1 DD at every rival within 2 hexes. |
| **e. Wind drift** | Every ship drifts **1 hex downwind**: **Gale** in every Part, **Strong** in II–III, **Firm** in III only. No pushing. |
| **f. End of Part** | **Rough water** 2 DD; **storm** 3 DD to ships in them. |

**Sail moves** (hexes, Half / Full; − = backwards) by the wind's direction relative to the ship (*points of sail*) and weather:

| | Into wind | Close hauled (60°) | Broad reach (120°) | Running (downwind) |
|---|---|---|---|---|
| **Firm** (normal) | 0 / −1 | 1 / 2 | 2 / 3 | 1 / 2 |
| **Light** −1 · **Strong** +1 Full only · **Gale** +1 all (+1 DD per Full Sail) · **Dead Calm** no sailing | | | | |

**3. Upkeep.** *(Order TBD)* Ships that **ended the turn in their home port** refit: full repair, full heal, recruit up to 3 crew, and
**miss next turn**. Ships that ended **on a wreck** (or next to it, if on land) search it: **gain a crew card** (cap 6, swap if full), and remove the wreck.
Spawn new treasure for any scored. **Advance the weather board** (new wind and tide). Draw cards.

**The sea.** **Cliffs**: stop + 2 DD. **Beach**: stop. **Sandbank**: land, except at High tide. **Underwater reef**: water, except at Low tide.
**Death reef** (skull): sinks you. **Wall reef** (hex edge): stop + 2 DD. **Fog**: can't fire into, out of or through. Caught on a hex when
the tide dries it: **stuck** (actions only) until it floods. **Whirlpools** (paired numbers): enter one, pop out of its partner with the same
heading and any movement left (if the partner is occupied, sail on). **Caves** (paired letters, on edges): exit facing the arrow; push any ship there.
All of these apply however you got there.

**Damage.** Roll a **d12 per DD**: 1 miss · 2–3 Ship 1 · 4–5 Crew 1 · 6–7 both 1 · 8 Ship 2 · 9 Crew 2 · 10 Ship 1 + Crew 2 · 11 Ship 2 + Crew 1 ·
12 **critical** *(TBD)*. You choose where damage goes. **Ship damage**: put a marker on any slot; it can't be used. **Crew damage**: wound
(flip) a healthy crew member or kill a wounded one. **You sink** if a whole row (Sail, Steer or Action) is blocked, or no crew are healthy.

**Sinking.** Drop any treasure where you sank and leave a wreck there. Come back at your home port, fully repaired, with **3 random crew**,
**without your Captain**. Nobody is ever eliminated.

**Treasure.** Pick it up by **sailing through** its sea hex, or by **ending a turn next to it** on land. You can carry **1**. When you **hit or ram
a carrier**, you may give up that DD and **knock the treasure loose** into an empty hex next to them (your choice). It's scored, and safe, when
the carrier **enters her home port**.
