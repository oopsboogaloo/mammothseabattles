# Online version: goals & product spec

> Draft. Captures the designer's goals. Implementation decisions come later.

## Purpose
- The online version is **free**. Its job is to **drive sales of the physical game**.
- Its main challenge is **teaching the game**. The rules have many interacting systems (programming, sail and
  wind, currents, drift, tides, broadsides, damage, crew), and the online version should make players
  understand them and want to play them at the table.

## Implications
1. **Teaching beats completeness.** Every screen should help a new player understand *why* their ship did what it did.
2. **Matches the physical game.** Same card names, artwork, ship board layout and terms as the box, so online
   players can sit down at a real table and already know the game. The rules spec (`rules.md`) is the single source of truth for both.
3. **Low friction.** Plays in the browser; ideally no install, and an invite link is enough to start a game with friends.
4. **A clear route to buy.** The game should link to the physical game naturally (e.g. after a game, or after the tutorial),
   without nagging.

## Teaching ideas (to evaluate)
- **Build up the rules in layers.** The spec already separates the layers. Tutorial scenarios add one system at a time:
  1. Programming and sailing (basic rule, no wind) → 2. Steering and currents → 3. Cannon and damage →
  4. Points of Sail → 5. Weather and wind drift → 6. Tides → 7. Crew → 8. Sea monster.
- **Ghost preview while programming.** Show where the ship *would* end up after each Part, if nothing interferes:
  sail move from the points of sail and weather table, then steering, then currents, then drift. Teaches the
  wind table without the player having to read it.
- **Replay with explanations.** Resolution is animated step by step (Move → Steer → Currents → Action → Drift), with a
  short caption for each effect ("Broad reach in a Strong wind: Full Sail = 4 hexes", "Current: 1 hex NE", "Pushed by *Woolly Revenge*").
- **Show the wind and arcs.** A wind rose showing each heading's speed around the selected ship; broadside arcs shown on hover.
- **Show what's coming.** The weather board shows the next two weather cards and tides, as in the physical game.
- **Practice against bots** so you can learn alone, before or without friends.

## Open questions
- O1. Platforms: browser only, or mobile apps too?
- O2. Accounts: needed at all? (Guest play with invite links is the lowest-friction option.)
- O3. Bots / single player: needed at launch for teaching?
- O4. Should optional modules (sea monster etc.) be online at launch, or kept as a reason to buy the box?
- O5. Real-time (everyone online, a timer to program) vs asynchronous (play-by-notification over hours or days), or both?
