# Reference games

**DRAFT, mostly TO CONFIRM.** The assistant knows some of these well and others only vaguely; entries are marked. The user is to correct, delete or fill in. Each entry should end with what Cybersleeve borrows or rejects.

## Cookie Clicker (Orteil)  [confident]
- Buildings with geometric cost growth (about 1.15 per copy) and milestone doublings; upgrades that name exactly what they scale; achievements as soft goals; prestige by "ascension" into permanent heavenly upgrades; minigames layered on top of the base economy over a very long arc; timed bonuses (golden cookies).
- Strength: the "one more upgrade" loop and the very long, layered progression.
- User note: Cybersleeve wants to avoid the clicking.
- Borrow: named multipliers, milestone ladders, prestige currency with permanent upgrades. Reject: clicking as a main input.

## Derivative Clicker  [from `ARCHITECTURE_DerivativeClicker.md`]
- Seven tiers of buildings, each producing the tier below; prestige (resets of tiers) producing reset currency that gives small permanent multipliers; an overflow-to-Infinity second prestige; numbers at 1e300 scale.
- Borrow: tiered production chains, infinity as a layer, the idea that scale itself is the progression. Reject: its implementation (see the architecture doc's lessons).

## Revolution Idle (Steam)  [partial, TO CONFIRM]
- Math-heavy: the player advances "theories" whose production is a visible formula, buys variables in it, and unlocks new terms; a publication/prestige-like system converts progress to a currency that boosts theories; strategy is in choosing which variable to buy and when to publish.
- Strength: the economy is legible because the formula is on screen; decisions are numeric and real.
- Borrow (TO CONFIRM with the user): showing the player the structure of what they are scaling.

## Unnamed Space Idle (Steam)  [from the community wiki, read 2026-10-29; Fleet/Titan/Galaxy pages not read]
- Wiki: https://spaceidle.game-vault.net/wiki/Main_Page (numbers may be outdated).
- Core loop: push through numbered sectors of enemy waves; spend salvage on weapons, shields and utility; passive side systems (Compute, Research, Synth, Reactor) raise power until the next sector falls.
- Prestige is layered, and each reset keeps a different list:
  - Prestige (sector 4): resets equipment, compute, resources, crew; keeps skins, achievements, research, synth points, base slots.
  - Bases (sector 13): a building grid whose components give a permanent prestige multiplier.
  - Challenges (sector 18): a run with a fixed loadout that pays a permanent boost to one system; up to 5 completions with rising targets, then an unrewarded endless mode.
  - Reinforce (sector 80): resets almost everything to sector 1; keeps achievements, automation, finalized bases, upgrade trees. Milestones at sectors 80/90/100, then repeatable at will.
  - Phases (Standard, Capital, Fleet, Titan) are gated by a Task List of seven explicit requirements.
- Each system adds one decision: which milestone to level, which bars to fill, which power boosts to run on a limited budget, which warp location to push, which crew stat to focus. A capped passive bar becomes a permanent bonus at a threshold and then disappears.
- Automation is bought with a currency that survives the big reset, in a recommended order. Attention pulls: clickable salvage and a timed boost every 2-3 minutes, plus Task List and reinforce prompts.
- Offline: 1 day cap (4 with an upgrade), combat averaged rather than simulated.
- Pacing: gated by sector count; each gate unlocks a new system ("unfolding"); each reinforce replays the climb faster.
- Best decision: which system to invest in right now ("focus on one thing at a time").
- Pitfalls: stat divisors that waste points, resources wasted if unused, loadout swaps that reset levels, many stub pages.
- Borrow (TO CONFIRM): unlock systems at progress gates; an explicit requirements checklist gating a later phase (check `docs/REVEAL_RULES.md` first); challenge runs with a fixed loadout that pay a permanent boost; a staircase of resets that each keep a different list (fits the re-sleeve positive list); a capped bar that converts to a permanent bonus and then retires.
- Reject: clickable bonus pickups as the main reward for attention. Watch out: many parallel systems; introduce Cybersleeve's one at a time.

## CIFI: Cell: Idle Factory Incremental  [from the community wiki, read 2026-10-29; wiki quality uneven]
- Wiki: https://cifi.game-vault.net/wiki/Main_Page (many tables unfinished, marked "?"; the user has not played it).
- Core loop: ticks produce Cells; Cells buy Generators (MK1-MK8) and ship upgrades; filling Loops earns Mod Points at a Loop Reset, which buy permanent Loop Mods.
- Structure: a series of unlockable "ships", each a named system with its own screen that ranks up from one kind of activity (generators, tech upgrades, loop resets, shard mining, automation hub, research, a space academy of personnel on missions, and a late gem layer). Auto-combat hunters feed several side exchanges.
- Prestige: a Loop Reset pays Mod Points for filled Loops, spent on persistent Loop Mods; everything else resets. The minimum Loops per reset rises with reset count. Shards, research points and Cells reset, so the wiki repeatedly says to spend them before resetting.
- Decisions: generators vs ship upgrades vs tech; which Loop Mods; when to reset (short runs for Mod Points, long runs for shards and research); the order of ship unlocks; manual buying vs automation loadouts.
- Automation: the hub buys generators and tech every tick and silently fails when unaffordable; operations, studies, missions and hunters run on their own.
- Best decision (judgement, not a wiki claim): when to reset, and which ship to unlock first.
- Pitfalls: costs reach 1e2000, silent automation failure, many side currencies, and reliance on external spreadsheets and optimizers.
- Borrow (TO CONFIRM): a named screen per system that ranks up from its own activity; a visible "spend before you reset" prompt; reset timing (short vs long runs) as the central skill; reset requirements that grow with reset count.
- Reject: a spreadsheet-dependent economy; silent automation failure (show why a purchase did not happen); side-economies fed by one source.

## Across both wikis
- Both unlock systems in sequence and give each its own decision; neither relies on clicking.
- Both use resets that keep different things rather than one big reset.
- Both have a long opaque tail that outside spreadsheets try to fix; keep Cybersleeve's late game legible.
- Neither wiki states session lengths, so pacing notes come from structure, not measurement.

## ISEPS  [TO CONFIRM]
- A web search describes it as a mobile game ("ISEPS Idle Particle Simulator", Android listing) about earning cash with exotic particles, no Steam page found. Nothing more is verified.
- *User to fill in:* what it does well and what Cybersleeve borrows.

## Underworld Idle (Steam)  [from the user]
- Niche. Its main characteristics are shared by the other games here: exponential scaling growth, like Derivative Clicker. Treat it as another example of "scale is the progression", not as a source of distinct mechanics.

## Increlution  [from the user; very little public information]
- The inspiration for Cybersleeve's progress bars: actions are bars that fill over time, with the player choosing what to run, not repeatedly clicking.
- *User to fill in:* how actions, levels/XP and resets work there, and what Cybersleeve borrows or rejects.

## Template for each entry
- Core loop in one sentence.
- Prestige structure (what resets, what persists, what the player gains).
- The single best decision the game gives the player.
- Pacing feel (walls, bursts, session length).
- What to borrow. What to reject.
