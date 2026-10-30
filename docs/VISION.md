# Cybersleeve – Vision (long-term design target)

Where the game is going, as told by the designer in interview sessions (branch `design-interview`). `DESIGN.md` describes the game **as it is now**; the vision files describe the **target** and the intent behind it. When they differ, DESIGN.md is what is built, the vision is what to build towards. **Do not implement anything from the vision without a task that says so.** Names are placeholders unless stated. Where the vision conflicts with `CLAUDE.md` or `DESIGN.md`, the current rules still apply until the designer decides otherwise (see Known conflicts).

Status markers: **OPEN** = undecided. **TODO-RENAME** = designer wants a better name.

## The game in one paragraph

A down-on-their-luck nobody buys an experimental, cheap, risky procedure that splits their mind from their body (the *sleeve*), and hacks their way up. They re-sleeve into new bodies, then outgrow bodies entirely and build a corporation whose tiers each produce the tier below, down to *synths* (algorithm copies of the player's latest life) that earn the credits. They take over a neighbourhood, city, region, planet, via the underworld or political route; each route ends at a wall and a total reset with kept boosts; the third pass combines both. Then planet seeding and a singularity ending. Tone: Cyberpunk 2077 meets Altered Carbon, neon-punk noir.

## Read only what the task needs

| File | Read when working on |
|---|---|
| `vision/story.md` | lore texts, poster messages, tone, the sixth action, origin story |
| `vision/layers.md` | prestige, re-sleeve, story resets, routes, the corporation, synths, tiers |
| `vision/heat.md` | heat, ICE Rating, Burn leads, their renames and corporate version |
| `vision/numbers.md` | big-number type, display notation, offline/boost time |
| `vision/player-experience.md` | pacing, walls, automation rules, UI/meta features, anti-goals (read before ANY new mechanic) |

## Known conflicts with the current docs

- **1e308 is not a hard cap** in the vision; `CLAUDE.md` and `DESIGN.md` section 9 clamp everything at it. Treat the clamp as a stop-gap; do not extend it into new designs. A decision is needed in `docs/DECISIONS.md` before changing it.
- Heat is currently a tax on node income and ICE lowers it; the vision leans towards ICE making heat cool faster. Not final.
- No reset button for sleeve skills exists yet (wanted, see player-experience).

## Open questions (running list)

- Exact form of the story-reset "wall" (a research that lets you redo the run?) and what is kept.
- Mechanics of the underworld and political routes; the corporate heat stat; conquest model.
- Tier count/names of the corporation chain; the super currency.
- Tag name and effects of the cybernetic re-sleeve upgrades; whether to preview them.
- Achievement gating; offline boost-time details; new names for Heat and Burn leads.
- Singularity: ending only, or play on?
