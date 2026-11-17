# Online version: goals & product spec

> Draft. Captures the designer's goals. Technical spec and roadmap: [`web-spec.md`](web-spec.md). **v1 is local play against AI**; online play, sign-in and Steam follow.

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

## Decisions made during resolution
Some rules need a player decision **in the middle of resolution**:
- holding fire on a target (rules §7.1)
- knocking treasure loose instead of dealing a DD, and where to place it (rules §8.2.3)
- **the damaged player choosing** which slot gets a damage marker and which crew member is wounded or killed (rules §7.3–7.4). This will be the most common prompt.

**Decision: prompt only when it matters.**
- Resolution runs automatically and **pauses only when a player has a real choice**: an enemy is actually in their arc, or a treasure
  carrier was actually hit or rammed by them.
- The prompt has a **1-minute timer** and a **default** if the player doesn't answer (defaults to be decided: e.g. fire at all
  targets; take the DD rather than knock treasure loose; for damage, block the least valuable slot and wound before killing).
- **Equipment played "at any time"** (rules §7.10) is the hardest case online. Plan: define fixed **windows** (e.g. after programming,
  after a hit is declared, before the damage roll). Trade-off to solve:
  - Pausing only for players who **hold a playable card** keeps games fast but **leaks hidden information** (a pause means "I've got something").
  - Pausing for **everyone** at every window is fair but far too slow.
  - Preferred direction: **pre-set triggers** chosen while programming (e.g. "use Explosive cannon balls on my next hit"), plus a small number
    of always-open windows where every player gets the same short pause.

- Possible improvement: let players set **damage preferences** in advance (e.g. "block Action slots first") so most damage needs no prompt.
- Engine requirement: the rules core must be able to **suspend resolution, ask a specific player a question, and resume**
  deterministically. In BGA terms, that's a short single- or multi-active state in the middle of resolution.

## Open questions
- O1. Platforms: browser only, or mobile apps too?
- O2. Accounts: needed at all? (Guest play with invite links is the lowest-friction option.)
- O3. Bots / single player: needed at launch for teaching?
- O4. Should optional modules (sea monster etc.) be online at launch, or kept as a reason to buy the box?
- O5. Real-time (everyone online, a timer to program) vs asynchronous (play-by-notification over hours or days), or both?

## Platform: Board Game Arena (BGA)
The designer also wants the game on [Board Game Arena](https://boardgamearena.com). Research notes (from BGA docs, via search;
not yet checked against the live pages):

**How games get onto BGA**
- Games are built in **BGA Studio** by registered developers using BGA's framework
  ([Steps to create a BGA game](https://id.doc.boardgamearena.com/Steps_to_create_a_BGA_game), [Studio FAQ](https://en.boardgamearena.com/doc/Studio_FAQ)).
- Almost all BGA games are adaptations of **commercial** games, and the **copyright owner must grant a licence**
  ([BGA Game licences](https://be.doc.boardgamearena.com/BGA_Game_licences)). As the designer, we can grant our own licence.
- BGA **advises against developing your own game** and says **prototypes are unlikely to find an audience**; publication is
  at BGA admins' discretion, followed by a 2–5 day "silent launch" ([BGA Game licences](https://be.doc.boardgamearena.com/BGA_Game_licences),
  [BGA game lifecycle](https://ko.boardgamearena.com/doc/BGA_game_Lifecycle)).
  → **Realistic path:** get the physical game published (or crowdfunded) first, then approach BGA, ideally as or through a publisher.
  Our own site is the teaching and playtest platform until then.
- A developer's own game code may be released under any licence (with a required notice), but **the BGA framework itself
  may not be published** ([Studio FAQ](https://en.boardgamearena.com/doc/Studio_FAQ)).

**Technical fit**
- BGA games are a **server-authoritative state machine** (`states.inc.php`) in **PHP**, with a **JavaScript client (Dojo-based)**
  ([Studio file reference](https://be.doc.boardgamearena.com/Studio_file_reference),
  [Game state machine](https://ar.doc.boardgamearena.com/Your_game_state_machine:_states.inc.php)).
- BGA has a **`multipleactiveplayer`** state type, where all players act at once. That's a direct fit for simultaneous programming;
  resolution then runs in a `game` state.
- Framework versions were last documented as Dojo 1.15 / PHP 7.2 (2020), so check what's current before starting.

**Implications for our engine (aim 3)**
- BGA requires the rules to run **in PHP on BGA's servers**, so our own engine can't simply be dropped in.
- Proposed approach: keep the **rules core pure and deterministic** (state + programs → events), separate from UI and networking,
  so it's easy to port. Back it with a shared **language-neutral test suite** (JSON scenarios: board + ships + cards → expected
  positions and damage) that both our engine and a BGA PHP port must pass. The rules spec, those test scenarios and the BGA port
  then stay in step.

**Open questions**
- O6. Publisher situation: self-publishing, crowdfunding, or pitching to a publisher? This affects the BGA route and timing.
- O8. Defaults for prompts during resolution (timer decided: 1 minute). In async games, should the timer be longer?
- O7. Build the BGA version ourselves (become BGA developers) or license it to a volunteer BGA developer?
