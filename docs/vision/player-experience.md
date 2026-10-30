# Vision: Player experience rules and anti-goals

Part of the long-term design target; index and status markers in `docs/VISION.md`.

## Player experience rules (apply to all work)

- **Active vs idle.** The game must be fully progressable with no interaction, but that is **suboptimal**: a player in the seat choosing upgrades and making decisions is always rewarded over one checking in every 5 hours. Both are legitimate. Walls are meant to take long enough that players leave the game running; otherwise they don't feel like walls.
- **Automation.** The Automation tab is where most automation controls live (today a placeholder that automates only sleeve play; it will grow to every phase, and will mostly stop resetting with further sleeve skills). **A player may only automate what they have done manually for a while** in every phase: a new mechanic must be interacted with long enough to understand how it connects to everything else before its automation unlocks.
- **Walls must be legible.** When progress slows, the player should know what they are working towards: seeing purchases that cost more than they can afford now is the established method. They should intuitively understand that re-sleeving is a lever for progress. Use mechanics that scale **per re-sleeve** regardless of anything else, or a baseline boost such as a skill point per re-sleeve. **A prestige that does not make the next pass faster is a design flaw** (a feels-bad moment).
- **Re-sleeve length shape (rough ratios, not numbers).** If the first re-sleeve takes ~5 hours, the second ~3, then ~2, ~1.5, ~1, and so on; overall may be slower. A story reset on the corporation side comes after a week or two of play and its replay should be much faster (maybe 10x). The game must not become a chore, and it must **end**.
- **Rhythm of new things** is not fixed: fast in burst phases, slow to give a wall feeling. Tune with experience.
- **Possible achievement gating.** Gate progress behind achievements to give targets during walls (e.g. "10 more sleeve levels unlocks X, a flat +10% synth production"). OPEN.
- **Meta features.** The Stats page exists and will grow. A **lore news ticker** (theme only, never consequential) is wanted. Settings later. **Scientific notation** for numbers will become necessary at some point.
- **Audience and release.** Hobby project, and a way for the designer to learn Claude coding. Planned as a free web release; maybe a post on an incremental-games subreddit; no marketing planned. Optional donations only. Current audience: friends. Testing and polish still matter. Familiar to fans of Derivative Clicker and CIFI, but it must teach itself.

## Anti-goals

- **No real-money payments of any kind** (no pay-to-skip, no paywall).
- **No random chance as a meaningful progression blocker.** Drops are fine because they will certainly come, but progress must never depend on a very rare drop (e.g. a crisis-level Kompromat at 0.0001%).
- **No hidden information:** every mechanic the player has met must be completely explained to them. The game need not say *how to play*, but nothing needed to work it out may be missing.
- **No permanent soft-locks from suboptimal choices.** Wanted: a **reset sleeve skills** button so a poor path through the trees is never a permanent block on a save. It is **free**, only for **sleeve skills**, and **restarts the current sleeve run without any benefit** (sleeve XP earned is of course kept). It does **not** count as a re-sleeve event.
- **No random events** (see 3b).

- **Rare drops** (Kompromat rarities): not a problem today because nothing needs them to progress; it must stay *possible* to raise drop rates enough for those skills to matter. Balance, not design, will settle it. Kompromat is expected to matter in **both** story branches later, for thematically different but mechanically similar things. Whether items grow into more (crafting, trading up) is OPEN.
