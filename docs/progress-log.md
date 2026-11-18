# Progress log

One entry per week. Newest first. The current state and next steps are in [`HANDOVER.md`](HANDOVER.md).

## Week 1 (from 17 November 2026)

**Designer's verdict (18 Nov):** the user interface is "looking fantastic"; loves the mock-up screenshots; excited by it.

Done:
- **Rules spec** to v0.87: core game fully specified, with Teams and the Fleets variant ([`rules.md`](rules.md)).
- **Player rulebook** playtest draft and a one-page core rules summary.
- **Digital spec**: roadmap, requirements, architecture outline, testing ([`web-spec.md`](web-spec.md)); product goals ([`online-version.md`](online-version.md)).
- **Four UI wireframes** evaluated; **layout A (bottom dock) chosen** ([`ui/wireframe-evaluation.md`](ui/wireframe-evaluation.md)).
- **Engine skeleton**: seeded RNG, decisions, hex maths, first rules, 100% coverage gate and CI.
- **Layout A mock-up with the real art** (PR #1, merged 18 Nov): all 45 command cards, 28 weather cards, the weather board, three sea maps and
  the 3D ship model; passes the layout checks at 1920×1080 and 1024×768 ([`ui/mockup/README.md`](ui/mockup/README.md)).
- **Ship model pipeline**: Blender to web model ([`../tools/ship-pipeline/`](../tools/ship-pipeline/README.md)).

Opened at the end of the week:
- What v1 still needs, including the art list ([`v1-gaps.md`](v1-gaps.md)).
- Engineering design, draft for review ([`engineering-design.md`](engineering-design.md)). The implementation plan follows it.
