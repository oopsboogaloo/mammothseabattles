# Simulator results

Games played by the Basic AI in every seat on the 91-hex test map (`npm run sim`, engineering design §10). Each variant plays the **same
deals** (seeds), so differences come from the rule, not the luck of the draw.

**Read with care:** the AI isn't a human (it always fires, plans one turn ahead, and the simulator runs it at a narrower search than in
the game); 10–30 games per variant is a small sample (seat win rates in particular can swing by 20% by chance). The numbers show
**direction and size**, not exact values.

## How to run more
`npm run sim -- --players 2 --games 20 --variants base,safe-edge,target-2` (variants: `base`, `safe-edge`, `target-2`, `target-4`,
`no-points-of-sail`; `--beam`, `--max-turns`, `--seed`, `--out file.md`). Games stop at 60 turns if no one has won.

## Findings (2026-11-20)
1. **Games are long.** Two players: about **40 turns** on average, and a quarter of games had no winner after 60. Four players: about
   **50 turns**, half unfinished at 60. At a few minutes a turn at the table, a target of 3 treasures is too much for this map, or the
   treasure changes hands too easily. **Target 2** cut two-player games to **25 turns**.
2. **Treasure changes hands a lot.** Two players pick up treasure about 8 times a game but bring it home about 3 times; it's knocked
   loose 3.5 times. With four players: 31 pick-ups, 23.5 knocked loose, about 4 brought home. Knocking loose may be too easy (any ram or
   cannon hit on a carrier) once several ships crowd the treasure.
3. **Four players is a bloodbath.** About 20 ships sunk by crew loss and 5 by damaged rows per game, and over 100 cannon hits that dealt damage.
   (The AI fires at everything, which exaggerates this.)
4. **Safe edge works as intended:** edge sinkings go to zero (1.8 a game with two players, 6.2 with four), games finish more often, and
   the Solo Challenge score rises from **1.4 to 2.0**.
5. **No seat advantage** shows with two players (53% / 47%). Four players: too few games to tell.
6. **Solo Challenge:** the AI scores 1.4 treasure on average (0–3) in 14 turns; 2 with Safe edge. A human target of 3+ looks like a
   good "expert" score.

### Solo Challenge, 30 games per variant, AI beam 2, seeds 1–30

| | base | safe-edge |
|---|---|---|
| Games | 30 | 30 |
| Finished before the turn limit | 100% | 100% |
| Turns per game, mean (min–max) | 14 (14–14) | 14 (14–14) |
| Solo score (treasure in the turn limit) | 1.4 (0–3) | 2 (0–4) |
| Sinkings per game: crew | 0 | 0 |
| Sinkings per game: edge | 0.2 | 0 |
| Sinkings per game: row | 0 | 0 |
| Times damaged per game: gale | 0 | 0.3 |
| Times damaged per game: roughWater | 0 | 0 |
| Times damaged per game: storm | 0 | 0.1 |
| Times damaged per game: wallReef | 0 | 0.1 |
| cannonHits per game | 0 | 0 |
| rams per game | 0 | 0 |
| treasuresPickedUp per game | 2 | 2.4 |
| treasuresKnockedLoose per game | 0 | 0 |
| whirlpools per game | 0.8 | 1.2 |
| caves per game | 0.1 | 0 |
| strandings per game | 0 | 0 |

### 2 players, 20 games per variant, AI beam 2, seeds 1–20

| | base | safe-edge | target-2 |
|---|---|---|---|
| Games | 20 | 20 | 20 |
| Finished before the turn limit | 75% | 90% | 90% |
| Turns per game, mean (min–max) | 39.8 (13–60) | 36.1 (18–60) | 25 (9–60) |
| Treasure home per ship | 1.7 (0–3) | 1.9 (0–3) | 1.2 (0–2) |
| Wins, seat 1 | 53% | 50% | 56% |
| Wins, seat 2 | 47% | 50% | 44% |
| Sinkings per game: crew | 2.7 | 3.1 | 1.8 |
| Sinkings per game: deathReef | 0.3 | 0.1 | 0.2 |
| Sinkings per game: edge | 1.8 | 0 | 1.1 |
| Sinkings per game: row | 0.8 | 0.8 | 0.6 |
| Times damaged per game: cannon | 18.1 | 21.9 | 11.1 |
| Times damaged per game: cliff | 0.4 | 0.4 | 0.4 |
| Times damaged per game: gale | 1.8 | 1.5 | 1.2 |
| Times damaged per game: portGuns | 3.7 | 2.5 | 2.9 |
| Times damaged per game: ram | 1.1 | 2.3 | 0.6 |
| Times damaged per game: roughWater | 0.5 | 0.3 | 0.2 |
| Times damaged per game: storm | 0.9 | 0.4 | 0.6 |
| Times damaged per game: wallReef | 0.3 | 0.4 | 0.2 |
| cannonHits per game | 20.8 | 26 | 12.9 |
| rams per game | 1.8 | 2.9 | 1 |
| treasuresPickedUp per game | 8 | 8.7 | 5.2 |
| treasuresKnockedLoose per game | 3.5 | 4.7 | 2.2 |
| whirlpools per game | 3.4 | 3.1 | 2.2 |
| caves per game | 0.3 | 1.4 | 0.2 |
| strandings per game | 0.1 | 0.1 | 0 |

### 4 players, 10 games per variant, AI beam 2, seeds 1–10

| | base | safe-edge |
|---|---|---|
| Games | 10 | 10 |
| Finished before the turn limit | 50% | 70% |
| Turns per game, mean (min–max) | 50.6 (24–60) | 46.7 (23–60) |
| Treasure home per ship | 1.1 (0–3) | 1.2 (0–3) |
| Wins, seat 1 | 20% | 0% |
| Wins, seat 2 | 40% | 43% |
| Wins, seat 3 | 40% | 29% |
| Wins, seat 4 | 0% | 29% |
| Sinkings per game: crew | 19.3 | 20.9 |
| Sinkings per game: deathReef | 0.8 | 0.5 |
| Sinkings per game: edge | 6.2 | 0 |
| Sinkings per game: row | 5.3 | 5 |
| Times damaged per game: cannon | 109.6 | 105.5 |
| Times damaged per game: cliff | 2.4 | 1.8 |
| Times damaged per game: gale | 4.7 | 4.5 |
| Times damaged per game: portGuns | 28.4 | 31.4 |
| Times damaged per game: ram | 8 | 8.1 |
| Times damaged per game: roughWater | 2.3 | 1 |
| Times damaged per game: storm | 0.6 | 1 |
| Times damaged per game: wallReef | 1.2 | 0.6 |
| cannonHits per game | 130.1 | 126.1 |
| rams per game | 11 | 11.3 |
| treasuresPickedUp per game | 31 | 31.5 |
| treasuresKnockedLoose per game | 23.5 | 23.8 |
| whirlpools per game | 7.9 | 6.7 |
| caves per game | 6.1 | 4 |
| strandings per game | 0.1 | 0.7 |
