# Mammoth Sea Battles: Rulebook

> **Playtest draft 0.1**, written for players from the design spec ([`rules.md`](rules.md) v0.81).
> Covers the **core game** and **Treasure Hunt**. Add-ons (sea monster, equipment, crew powers) are in the appendix.
> 🛠 boxes mark rules still being decided.

---

## Welcome aboard

The seas are full of treasure, and every pirate crew of mammoths and prehistoric monsters wants it. Program your ship's orders in
secret, then watch everything happen at once: ships collide, currents sweep them off course, the wind shoves them about, and the
cannons roar. Plans go wrong. That's the fun.

**Players:** 2–8 · **Win:** be first to bring **3 treasures** home to your port (2 treasures with 7–8 players).

---

## 1. What's in the box

| Component | Use |
|---|---|
| Hex sea tiles | Build the map |
| 8 ships | One per player |
| 8 ship boards | Where you program your orders |
| 8 home port tokens | Your safe harbour |
| Command cards (one shared deck) | Your orders: Sail / Steer / Action |
| Crew cards | Captains (mammoths) and crew (prehistoric monsters) |
| Weather board + weather cards | Wind, weather and tides |
| Treasure tokens + treasure map deck (1–9) | Where treasure appears |
| Spawn point markers (1–9) | Treasure locations on the map |
| Shipwreck tokens | Searchable wrecks |
| Damage markers | Block slots on your ship board |
| 12-sided damage dice | Damage |

---

## 2. Setting up

1. **Build the sea** from the tiles, as the scenario shows.
2. Each player takes a **ship**, **ship board** and **home port**, and places the port on the **edge of the map**.
3. Place the **9 spawn point markers** and the **shipwreck tokens** as the scenario shows. Spawn points can all be at sea (a quick game),
   all on land (a longer game), or a mix.
4. Shuffle the **treasure map deck**. Turn over cards and place treasure on those spawn points until there are
   **half as many treasures as ships** (rounded down, minimum 1): 1 treasure with 2–3 ships, 2 with 4–5, 3 with 6–7, 4 with 8.
5. Each player takes a **Captain** and **2 random crew**, face up in front of them.
6. Shuffle the **weather cards** onto the weather board. The current card and the **next two** are face up.
7. Ships start **in their home port** with **sail down (No Sail)**, pointing whichever way their player chooses.
8. Each player draws **command cards**: one for each card icon on their crew (§4).

---

## 3. Your ship

### Heading and the hex grid
Your ship always points at one of the **six sides** of her hex. She moves forward through that side.

### Sail
Your ship's sail is set to **No Sail**, **Half Sail** or **Full Sail**. It **stays set** until you change it. You don't need to play a
sail card every time.

### Cannons
Your cannons are on your ship's **sides (broadsides)**. Each side fires into a **60° wedge** out to **4 hexes**. You can't fire straight
ahead or straight behind.

---

## 4. Command cards and your hand

Every command card has **three bands**:

- 🟦 **Sail** (top): No Sail, Half Sail or Full Sail
- 🟨 **Steer** (middle): Ease Port or Ease Starboard (turn 60°), Hard to Port or Hard to Starboard (turn 120°)
- 🟥 **Action** (bottom): Fire Cannons, Repair or Heal

Each card also has an **initiative number** (top right). Higher numbers act first when it matters.

**Your hand:** at the start of each turn, draw **1 card for each card icon on your healthy crew** (a Captain gives 3, most crew give 1).
Keep cards you don't use. **Maximum hand: 9.** Your hand is secret. Used cards go back into the deck.

---

## 5. Playing a turn

Each turn has three stages: **Program → Resolve Parts I, II and III → Upkeep.**

### 5.1 Program (everyone at once, in secret)
Your ship board has **three Parts (I, II, III)**, and each Part has three slots: **Sail, Steer, Action**.

- Place cards face down in any slots, **up to 9 cards**.
- **Only the band matching the slot counts.** The same card could be a Full Sail order, a Hard to Port order, or a Fire Cannons order,
  depending on where you put it.
- **Empty slots are fine:** an empty Sail slot keeps your sail as it is; an empty Steer slot means no turn; an empty Action slot means no action.

When everyone is ready, reveal.

### 5.2 Resolve each Part
Do Parts I, II and III in order. In each Part, **everyone acts at the same time** in these phases:

| | Phase | What happens |
|---|---|---|
| **a** | **Sail** | Set your sail if you played a Sail card. Then sail forward (§6). |
| **b** | **Steer** | Turn as your Steer card says. |
| **c** | **Currents** | Currents carry and turn ships (§7). |
| **d** | **Action** | Fire, Repair or Heal (§8). Then home ports fire. |
| **e** | **Wind drift** | In strong winds, ships drift 1 hex downwind (§6.4). |
| **f** | **End of Part** | Ships in rough water or storms take damage (§7). |

**When ships get in each other's way**, use **initiative**: the higher number goes first, then the other.
- For **movement**, use the number on the card in your **Sail** slot.
- For **firing**, use the number on the card in your **Action** slot.
- An **empty** slot counts as **0**. On a tie, roll off.

### 5.3 Upkeep
🛠 *Playtest order:*
1. **Refit** ships that ended the turn in their home port (§10).
2. **Search wrecks** (§9).
3. **New treasure** appears for each one scored this turn.
4. **Advance the weather board** one space: new wind, new tide. Ships caught by the tide are now stranded (or freed) (§7).
5. **Draw** command cards (§4), knowing the new weather.

*(With the Sea Monster add-on, it moves first.)*

---

## 6. Sailing and the wind

### 6.1 How far you sail
How far you sail depends on your **sail** and the **wind**. Find the wind arrow on the current weather card. **The wind blows the way the arrow
points.** Then look at your ship's heading compared with the wind:

| Your heading | Half Sail | Full Sail |
|---|---|---|
| **Into the wind** | don't move | **1 hex backwards** (taken aback!) |
| **Close hauled** (60° off the wind) | 1 | 2 |
| **Broad reach** (wind behind your side) | **2** | **3**, the fastest |
| **Running** (wind straight behind) | 1 | 2 |

No Sail never moves.

> **Simpler rule** (optional, for first games): ignore the wind direction. Half Sail moves 1, Full Sail moves 2.

### 6.2 Weather changes your speed

| Weather | Effect on sailing | Drift |
|---|---|---|
| **Dead Calm** | Nobody sails | None |
| **Light** | −1 to all sail moves | None |
| **Firm** | Normal | Part III |
| **Strong** | +1 to Full Sail moves | Parts II and III |
| **Gale** | +1 to all sail moves, and **each Full Sail costs 1 damage die** | Parts I, II and III |

Bonuses and penalties change the **number of hexes**, whichever way you're going, but never below 0. Into the wind at Full Sail in a Gale,
you're blown **2 hexes backwards**!

### 6.3 Pushing and ramming
If you sail into another ship, **you push her** ahead of you, hex for hex, as far as you keep moving. She can push the next ship, and so on.
The **first ship you hit takes 1 damage die**. A ship pushed into rocks, reefs or anything else suffers exactly as if she'd sailed there.

Only sailing pushes. **Currents and drift never push**: if they'd carry a ship into another one, she just stays put.

### 6.4 Wind drift
In the Parts shown above, every ship (even at No Sail) drifts **1 hex downwind**, without turning.

---

## 7. The sea

All of these work **however your ship got there**: sailing, pushed, carried by a current or drifting.

| Feature | Effect |
|---|---|
| **Cliffs** (purple rock) | Stop. Take **2 damage dice**. |
| **Beach** (yellow sand) | Stop. |
| **Sandbank** (sand over water) | Like a beach, **except at High tide**, when it's water. |
| **Underwater reef** (green stripes) | Water, **except at Low tide**, when it's like a beach. |
| **Death reef** (skull) | Your ship **sinks**. |
| **Wall reef** (spiky edge between hexes) | Can't cross it. Stop and take **2 damage dice**. |
| **Rough water** | Take **2 damage dice** if you're in it at the end of a Part. |
| **Storm** | Take **3 damage dice** if you're in it at the end of a Part. 🛠 *Provisional.* |
| **Fog** | Ships in fog can't fire or be fired at. You can't fire through fog. |

**Stop** means you stay in the last hex and lose the rest of that move. Currents, pushes and drift can still move you later.

### Currents
Arrows move ships in the Currents phase. **Single arrows move 1 hex, double 2, triple 3**; curved arrows also **turn** you. Circular arrows
**spin** you on the spot. 🛠 *A diagram of every current type is coming.*

Currents move in three steps: first only triple currents move 1 hex, then double and triple currents, then all currents. This way a ship can
be carried from one current onto the next.

### Tides
The weather board shows the tide, which cycles **High → Mid → Mid → Low → Mid → Mid** over six turns. You can always see what's coming.

| Tide | Sandbanks | Underwater reefs |
|---|---|---|
| High | water | water |
| Mid | land | water |
| Low | land | land |

**Stranded!** If the tide turns your hex to land, your ship is **stuck** until the water returns. You can't sail, steer, be pushed or drift,
but you **can still take Actions**. Other ships treat your hex as beach.

### Whirlpools and caves
- **Whirlpools** come in numbered pairs. Sail into one and you **pop out of its partner** with the same heading, carrying on with any movement left.
  If the partner is occupied, you just sail across. Arriving through a whirlpool doesn't send you back.
- **Sea caves** are lettered pairs on island edges. Sail into one and you come out of its partner **facing out of the cave mouth**. If a
  ship is in the way, you push her.
- Cannons can't fire through whirlpools or caves.

---

## 8. Actions and combat

Actions happen in **initiative order** (Action slot number, highest first), and damage takes effect immediately. **A ship sunk before her
turn doesn't get to fire.**

- **Fire Cannons**: both broadsides fire. **Every enemy ship in either arc takes 1 damage die.** You may choose to spare any of them.
  Cannons fire over land, but not into, out of or through fog. No friendly fire.
- **Repair**: remove 1 damage marker.
- **Heal**: flip 1 wounded crew member back to healthy.
- **Home ports** then fire at every rival ship within 2 hexes: 1 damage die each.

### Damage dice
Roll a 12-sided die for each damage die. **You** decide where the damage goes.

| Roll | Ship damage | Crew damage |
|---|---|---|
| 1 | – | – (miss!) |
| 2–3 | 1 | – |
| 4–5 | – | 1 |
| 6–7 | 1 | 1 |
| 8 | 2 | – |
| 9 | – | 2 |
| 10 | 1 | 2 |
| 11 | 2 | 1 |
| 12 | **Critical hit!** Roll this die again **and** one extra die. 🛠 *Critical cards may replace this.* |

- **Ship damage**: put a **damage marker** on any slot of your ship board. Remove any card there. That slot can't be used until repaired.
- **Crew damage**: **wound** a healthy crew member (flip the card) or **kill** a wounded one. Wounded crew don't give you cards.

**Your ship sinks** if a whole row of slots (all Sail, all Steer or all Action) is blocked, or if you have **no healthy crew**.

Damage mostly **slows you down**: fewer slots and fewer cards mean fewer choices.

---

## 9. Sinking and shipwrecks

**If your ship sinks:**
- Any treasure she carried **drops where she sank**.
- She leaves a **shipwreck token** there.
- She **comes back at your home port**, fully repaired, with **3 random crew**. **Your Captain is lost.** You're never out of the game.

**Searching wrecks:** at Upkeep, a ship that ended the turn **on a wreck** (or next to it, if it's on land) searches it, **gains a crew
card**, and removes the wreck. A ship can have **at most 6 crew**: if you're full, you may swap one out.

There's a **Retired Captain** somewhere in the crew deck: the best crew member of all, but she won't serve alongside another Captain.

---

## 10. Home port

- **Start:** you begin the game here.
- **Safe harbour:** your port can't be harmed, and its guns fire at rivals within 2 hexes.
- **Refit:** end a turn in your port to fully repair, fully heal, and recruit back up to 3 crew. You **miss the next turn** (you still draw cards).
- **Score:** sail into your port carrying treasure to score it. It's safe forever.

---

## 11. Treasure Hunt

- **Picking up:** sail **through** a treasure's sea hex to grab it. For treasure **on land**, end a turn **next to it**: you've gone ashore to dig.
- **Carry 1** treasure at a time.
- **Stealing:** when you **hit or ram** a ship carrying treasure, you may give up that damage die and **knock the treasure loose** instead.
  You place it in an empty hex next to her, sea or land.
- **Scoring:** enter your home port with it.
- **New treasure:** at Upkeep, turn over a treasure map card for each treasure scored that turn. If that spawn point already has a treasure,
  draw again. Reshuffle the deck when it runs out.
- **Winning:** first to **3** (2 with 7–8 players). 🛠 *Two-player games may play to 3 out of 5. A timed variant is also being designed.*

---

## 12. Other ways to play 🛠

- **Race:** reach the checkpoints in order. The simplest way to learn.
- **Deathmatch:** usually in teams.
- **Capture the Flag:** teams.
- **Solo / Co-op Adventure:** explore and fight ghost ships and monsters. Coming later.

---

## Appendix: add-ons

Add these once the core game is familiar.

- **Crew powers:** many crew have special skills. For example the **Surgeon** heals one wounded crew member each turn for free.
- **Equipment:** found in wrecks. Single-use cards, kept secret and playable at any time. For example **Explosive cannon balls** add +2 damage
  dice to an attack. There's no limit on how many you hold, and you keep them if you sink.
- **The Sea Monster:**
  - Each turn at Upkeep it moves 1 hex. The player with the most **🐙 influence** chooses where: 🐙 icons on the cards they
    programmed this turn, plus each damage die they hit it with last turn. On a tie, the closest ship decides.
  - After each Action phase it deals 1 damage die to every ship next to it.
  - Any ship that enters its hex, or that it moves onto, **sinks**.
  - It ignores the map, and can be shot but never killed.

## Quick reference

**Each Part:** Sail → Steer → Currents → Action → Drift → End of Part.
**Initiative:** Sail slot for moving, Action slot for firing; higher first; empty = 0; ties roll off.
**Sink when:** a whole row of slots is blocked, or no healthy crew.
