# Reference: RoboRally (Richard Garfield, 1994 →)

Reference notes on the game Mammoth Sea Battles builds on. These summarise the
rules and do not copy any rulebook text. Editions differ a lot, so each point says
which edition it applies to.

Sources used: [Wikipedia](https://en.wikipedia.org/wiki/RoboRally),
[UltraBoardGames rules](https://ultraboardgames.com/robo-rally/game-rules.php) /
[cards](https://www.ultraboardgames.com/robo-rally/cards.php),
[Dized 2023 rules](https://rules.dized.com/game/-35QGfadQpKOT0xvvgNZnQ/_JLhzYwfRk2UB2WUXvv84A/2-the-programming-phase),
[RulesPal 2023](https://rulespal.com/robo-rally-2023/rulebook),
[Renegade product page](https://renegadegamestudios.com/robo-rally),
[SOB player aid](http://sob-zine.org/PlayerAids/Robo_Rally_Player_Aid.html),
[BGG: edition changes](https://boardgamegeek.com/thread/3041431/changes-from-the-earlier-versons),
[BGG: damage counts](https://boardgamegeek.com/thread/2205476/thoughts-on-virus-type-damage-counts-scaling-damag).
Not yet checked against the official PDFs, because the publishers' hosts are blocked in this session.

## Core loop (all editions)
1. Everyone **programs at the same time**, face down, choosing from a hand of cards
   and placing them into **5 numbered registers**.
2. **Activation** goes one register at a time. In register *n*, every robot carries out
   its card *n*, then the **board elements** activate, then **lasers** fire, then
   checkpoints are scored.
3. The fun comes from robots **colliding, pushing each other and being carried by the board**
   in ways their owners didn't plan for.

## Movement
- Cards: Move 1/2/3, Back Up, Rotate L/R (90°), U-Turn. 2016+ adds Power Up and Again (repeat the previous register).
- **Pushing**: a robot moving into an occupied square pushes the other robot. Pushes chain. A wall stops the whole chain.
- **Board movement does not push**: if a conveyor would carry a robot into an occupied square, it doesn't move.
- Moving off the board or into a pit destroys the robot (classic) or reboots it (2016+).

## Order of resolution
- **Classic**: robots move in **card priority number order**, highest first. Priority also decides
  which robot gets a square when two try to enter it. Board elements then go in this order: express conveyors move 1 → all
  conveyors move 1 (rotating belts turn the robot) → pushers (in the registers printed on them) → gears 90°
  → crushers. Then board lasers and robot lasers → flags/repair.
- **2016**: robots move in the order of their distance to the **priority antenna** on the board (ties broken clockwise).
  Board elements: blue belts (2) → green belts (1) → push panels → gears → board lasers → robot lasers
  → energy spaces → checkpoints. Sources disagree on whether gears come before or after push panels.
- **2023**: priority is a **token passed round the table** instead of the antenna.

## Shooting
- Each robot fires one laser **straight ahead** in every register, automatically.
  Line of sight is blocked by walls and other robots. A hit does 1 damage.

## Damage models (very different between editions)
- **Classic: hand-size attrition.** You're dealt 9 cards minus 1 per damage point. At 5 or more damage,
  registers **lock** (starting from register 5 and working back), and the locked cards stay in place every turn.
  10 damage destroys the robot, and you have a limited number of lives. Sources disagree on whether locking starts at 4 or 5 damage.
  *Power down*: miss a turn to clear all your damage.
- **2016+: deck pollution.** Each player has their own 20-card programming deck. Damage cards (SPAM, Trojan Horse,
  Worm, Virus) are **shuffled into your deck** and dilute your hand. You get rid of one by programming it.
  Rebooting costs 2 SPAM and the rest of the round.

## Upgrades
- Classic: **Option cards**, which are permanent modules (extra weapons, Dual Processor, shields and so on).
  You get one from wrench squares, and you can discard one to ignore a damage point.
- 2016+: **Upgrades** are bought with **energy** gained from energy spaces and Power Up cards. Some are permanent, some are one-use.

## Known pain points (worth designing around)
- **Death spiral**: in classic, damage makes you play worse, which leads to more damage.
- **Scaling (designer's view)**: it scales *very well* to 8 **when each register is executed simultaneously**.
  The official resolution order (priority or antenna) means going ship by ship, which is the
  slow way. Many groups play it simultaneously, trusting each other and accepting the chaos. That's the vibe
  Mammoth Sea Battles wants.
- **Kingmaking / runaway leader** in race games.
- Classic **priority numbers** create a hidden-information tiebreak that feels random to players.
