# Card data

One CSV file per card type. Each row is one card; each thing printed on the card has its own column.
The files open and save in Excel (UTF-8 with a byte-order mark, so Excel reads them correctly). Save as **CSV UTF-8**.

Transcribed on 2026-11-18 by reading every card image in `packages/client/public/art/` (and `docs/images/` for the treasure maps).

| File | Cards | Columns |
|---|---|---|
| `command-cards.csv` | 45 | `initiative` (top right), `octopus_icons` (top left, 0–3), `sail_order` (blue band), `steer_order` (yellow band), `action_order` (red band) |
| `weather-cards.csv` | 28 | `name`, `wind_strength`, `wind_direction` (the way the arrow points), `sail_move_modifier` and `modifier_applies_to` (the printed "+1 Full Sail moves" split in two, so Excel doesn't read it as a formula), `text_1`–`text_3` (any other printed lines) |
| `equipment-cards.csv` | 12 | `name`, `text` (as printed) |
| `crew-cards.csv` | 3 finished + 2 from the rules | `name`, `card_icons` (command cards drawn), `power_text`, `status`, `wounded_art_file` |
| `treasure-map-cards.csv` | 9 | `spawn_point_number`, `status` |

## Ideas, not cards yet
`crew-card-ideas.csv` holds 24 **proposed** crew cards for the designer to pick from (proposed 2026-11-18). None has card art and none is a finished card in the rules,
although two powers already appear there: the Surgeon's, and peeking at the treasure map deck (see each row's `notes`).
Put anything in the `use` column to mark the ones to keep; chosen rows then move to `crew-cards.csv`. Its columns are `id`, `name`, `group`,
`creature`, `card_icons`, `power_text`, `use` and `notes`; it has no `copies` or `art_file`, and its ids are not art file names. Three design points the ideas raise:
- **Icons as the price of a power**: a strong power on a 0-icon card makes each recruit a real choice, because it shrinks the hand.
- **Wounded crew**: the rules leave open whether powers work while wounded (Q48). Suggestion: they don't, which gives the Cook a job.
- **Overlap with equipment**: some ideas are permanent versions of an equipment card (noted per row), so each needs balancing against
  that card when it is chosen. As written they are not: a permanent power outlasts a one-shot card (Anchor Hand and Wind Chimes, Carpenter and Repair Kit).

Every card file (not the ideas file) also has `id` (unique; matches the art file name), `copies` (how many of that card are in the deck), `art_file` and `notes`.
Text is in sentence case; the cards print it in capitals.

## Not in these files
- **Wind drift and tides** are not printed on the weather cards; they come from the rules (`docs/rules.md` §3.5, §5.2).
- **Equipment**: the mock-up notes say 26 equipment cards exist; only these 12 have art in the repository.
- **Crew**: the 10 portraits in `art/portraits/` are placeholders with made-up roles, not cards, so they are left out.
- **Treasure map cards**: only cards 1 and 3 have art in the repository.

## Found while transcribing
- Command cards **120, 140 and 680** each show one octopus icon; the mock-up's table had 0 (corrected in `packages/client/src/data/content.ts`).
- Two command cards are numbered **360** (`360` and `360b`).
- The Gale cards are spelled **GAIL** on the art.
- The rules' example equipment "Explosive cannon balls: +2 DD" (§7.10) is "Really Big Cannonballs: +1 DD" on the card.

`test/card-data.test.ts` checks these files whenever the tests run (`npm test`, and in CI on every push): the expected columns, the same
number of fields in every row, unique ids, known values, and whole-number copies.
**The game does not read these files yet.** The mock-up still uses its own copy of the data; the engine will load from here (`docs/engineering-design.md` §7.2).
