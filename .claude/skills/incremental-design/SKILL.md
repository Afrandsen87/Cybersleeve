---
name: incremental-design
description: Genre knowledge for Cybersleeve, an idle/incremental game. Load BEFORE proposing or reviewing any mechanic, economy, prestige/re-sleeve, progression, unlock, skill, buyable, pacing or balance change, or any new content. Stops generic game-design suggestions and anchors ideas in how incremental games actually work and in what Cybersleeve has already decided.
---

**DRAFT for the user's review.** Sections marked `TO CONFIRM` are the assistant's recollection or guess and must be corrected by the user before agents rely on them.

You are designing for an **idle/incremental game**, not a generic game. Read this page, then the reference file that matches the task. Then read the `DESIGN.md` section and `docs/DECISIONS.md` entry for the mechanic you touch.

## What the genre is about

1. **The player's real job is choosing what to improve next.** Numbers going up is the surface; the fun is deciding between several things that all make numbers go up, and seeing the result compound. A suggestion that adds a number without adding a decision is weak.
2. **Growth is a race between cost and output.** Costs grow geometrically per copy bought; output grows linearly per copy, multiplied by milestones and upgrades. The player is always slightly behind the next wall. Before proposing anything, say what it does to that race.
3. **Prestige is the central design problem, not a feature.** A reset must (a) be wanted (the next run is visibly faster), (b) cost something real (what is lost), and (c) change how the player plays the early game, not only its speed. A new layer needs its own currency, its own decisions, and a reason to exist that the layer below cannot supply.
4. **Attention shifts upward over time.** First the player does things by hand, then automation does them, then the player manages automation, then manages systems of automation. Each new layer should remove a chore and introduce a decision. Idle games die when they add chores at the same layer.
5. **Nothing is shown before it matters** (Cybersleeve already enforces this). Discovery is a reward: a new thing appearing should feel like an event, and its name should not leak before then.
6. **Walls and bursts.** Good pacing is progress that slows to a crawl (a wall), then a purchase, skill or reset produces a burst. Flat, constant progress is boring; a wall with no visible way past it is a quit moment.
7. **Offline and idle are first-class,** but Cybersleeve has no offline progress for now. Do not design around absence.

## Cybersleeve differs from the average incremental game (do not propose these)

- **No life clock, no timers forcing a reset.** The player chooses when to re-sleeve.
- **No global multiplier.** Every multiplier names exactly what it scales (`REWARDS`, `EFFECT_TRAITS`). "Multiply all production by X" is always wrong here.
- **Actions are gated by access level only,** no unlock rules.
- **Active clicking is avoided.** Runs are bars that fill; the player's input is choosing and configuring, not repeating.
- **The derivative scaling is copies:** later layers are copies of earlier lifetimes (sleeves, companies, cities...), not just bigger multipliers.
- **Numbers reach Infinity (1e308) and that triggers a prestige.** Design for astronomical scale, with closed-form batching.

## Balance (decided 2026-10-28)

Balance matters now that players are on the live game, but being corrected later is fine. For new or changed content: state the intended pacing (time to afford, time to pay back, what it unlocks next), check it against the nearest existing prices, income and reveal thresholds (`reveal.buyableOrders`), and report the numbers. Do not rebalance existing tuning unless asked; flag a problem with numbers instead. See `references/economy-and-pacing.md`.

## Review every new mechanic against these references

Before proposing or approving a mechanic, read the reference that matches and answer in the proposal:
1. `references/anti-patterns.md`: which pattern could this be? (fake choice, dead upgrade, flat buff, layer-as-multiplier, chore at the same layer.)
2. `references/economy-and-pacing.md`: price against its neighbours, time to afford, payback, which wall it moves.
3. `references/prestige-and-layers.md`: for any reset or layer, the four questions; gain must grow sub-linearly with run progress.
4. `references/automation-and-attention.md`: which chore it removes, which decision replaces it.
5. Impact spread: list the sibling options and state, with the formula, that none is dead, always-dominant or fixed-outcome.
6. Layer-readiness: what happens with N sleeves and several corporations.
7. Context: which bounded context owns it, and which existing service it reuses.

## Quick checklist before suggesting anything

- Which **decision** does this add or change? Is any option strictly dominant (fake choice)?
- What does it **scale, exactly**? (No global multipliers.)
- When can the player **first know** the concepts it mentions? (Reveal checklist in `CLAUDE.md`.)
- What does **re-sleeving** do to it (positive list)?
- What is the **chore** it removes, and what **new decision** replaces it?
- Where is the **wall** it helps the player past, and where does it create the next one?
- Does it survive **astronomical numbers** (closed form, no per-run iteration)?
- Which existing service does this reuse, so the rule has one code path?

## Reference files (read only the one you need)

- `references/economy-and-pacing.md`: cost curves, multiplier stacking, milestones, walls and bursts, how to sanity-check a price.
- `references/prestige-and-layers.md`: reset design, persistence, layer-on-layer structure, the derivative/copies scaling.
- `references/automation-and-attention.md`: automation, choice vs chore, QoL ladders.
- `references/reference-games.md`: what each inspiration game does well and what Cybersleeve borrows or rejects (partly `TO CONFIRM`).
- `references/anti-patterns.md`: concrete things to reject.
