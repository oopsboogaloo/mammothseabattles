# What v1 still needs

> v1 = local play in the browser, 2–4 ships, humans (pass and play) and AI, core rules + Treasure Hunt ([`web-spec.md`](web-spec.md) §1, M2).
> Core rules exclude equipment, crew powers and the sea monster ([`rules.md`](rules.md) §9).
> Written 2026-11-18 from what is in this repository. The master art folder was not visible when this was written, so items marked
> **check** may already exist there.

## 1. Artwork

### Needed for v1
| Item | Why | Have today |
|---|---|---|
| **Treasure token** | Treasure on the board and carried by a ship (rules §8.2) | Nothing |
| **Shipwreck token** | Starting wrecks and one per sunk ship (§7.9) | Nothing |
| **Damage marker** | Blocks a ship-board slot (§7.3). The mock-up draws a cross | Nothing |
| **Home port marker**, one per player colour | Ports are placed on the map edge at setup (§8.2.4) | Nothing |
| **Treasure spawn point markers**, 1–9 (or symbols, §8.2.1) | Unless they are already printed on the maps: **check** | Unknown |
| **Treasure map cards 1–9 and a back** | Spawning treasure (§8.2.1) | Cards 1 and 3 in `docs/images/`; **check** the rest |
| **Damage die faces**: icons for Ship damage, Crew damage, miss, critical | Showing DD rolls as a die (§7.2; web-spec §4.1 "dice like dice") | Nothing |
| **Title or logo, and an app icon** | Start screen; installable web app (web-spec §3.6) | Nothing |
| **Box or product image** | End-of-game link to the physical game (web-spec §4.3) | Nothing |

### Have, but with a question attached
| Item | State | Question |
|---|---|---|
| Command cards | All 45, real | Two cards numbered 360; Anchor, Row and Hard About are not in the rules; no "No Sail" card (mock-up README questions 1–2) |
| Weather cards and board | All 28 and the board, real | Lightning Storm and Hurricane have no rules yet. Gale is spelled "GAIL" on the art (rules §3.5) |
| Sea maps | 3 of the printed maps, real | The art is there; the **rules content of each hex is not** (see §2) |
| Crew cards | Captain Mammoth, two Pirates, a wounded side | Enough for a core game of Captains and Pirates. If the core crew deck has other basic crew (Q48), each needs a round card |
| Ship model | Real, two detail levels | None |
| Ship board, card backs, player guides | Real | None |

### Not needed for v1
| Item | Why not |
|---|---|
| Finished round crew cards for the other portraits (the mock-up crops 10 of the 47 portraits as placeholders) | Crew powers are an add-on (§9) |
| Equipment cards (13 of 26 are in the client) | Add-on (§7.10) |
| Sea monster miniature or token | Add-on (§9.1) |
| Critical damage cards | Placeholder rule: re-roll plus one die (§7.2) |
| Race checkpoints, flags | Other modes (§8.1, §8.4) |
| Table surface | The plain wooden table is acceptable; replace if wanted |

## 2. Design inputs from the designer (not art)
| Input | Blocks |
|---|---|
| **Current-types diagram** (Q20/Q19): turning amounts, eddies, gyres, maelstrom | The Currents phase and the map data |
| **Board tile diagram** or a pass over each map: terrain, wall reefs, caves, portals, spawn points, home ports | Playing on the real maps |
| Answers to the six questions the art raised | Card and weather data ([`ui/mockup/README.md`](ui/mockup/README.md)) |
| Core crew deck list; starting wrecks; board edge; and the other gaps in [`engineering-design.md`](engineering-design.md) §14 | Individual rules; each has a working assumption so none stops the build |
| Feedback from the family test of the mock-up, including on a real iPad | The v1 client |

## 3. Engineering
| Area | State |
|---|---|
| Engineering design | **Draft for review**: [`engineering-design.md`](engineering-design.md), with decisions D1–D7 |
| Implementation plan | **Not written.** Follows the design review |
| Engine kernel (game definition, action log, replay, views, events) | RNG and decision type only |
| Rules | Sailing, drift, damage die, initiative, slots, crew damage and arcs exist as separate functions. Missing: game state and setup, turn loop, pushing, terrain and tides, portals and caves, currents, repair, sinking and return, port guns and refit, wrecks, Treasure Hunt, Upkeep, views, legal actions |
| Content data (`msb-data`) | Cards and weather transcribed inside the mock-up; no maps, crew deck or scenarios |
| AI and simulation | Not started. The mock-up's rivals pick random programs |
| Client | Mock-up only. Missing for v1: real engine underneath, tokens, start screen, pass-and-play hand-over, all decisions, Upkeep and end screens, saving, offline, tutorial |
| Device test | Not yet run on a real iPad or the Galaxy Note |
