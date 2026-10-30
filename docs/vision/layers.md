# Vision: Layers, resets and the corporation phase

Part of the long-term design target; index and status markers in `docs/VISION.md`.

## Layer ladder (target)

1. **Sleeve gameplay**: actions, skills, buyables, heat (current game).
2. **Re-sleeving** (first prestige): sleeve XP carries over; synthetic sleeves are copies of earlier lives.
3. **Corporation**: the player has outgrown their body. They take over their neighbourhood, own more and more of its commerce, and push the proceeds into upgrading the sleeve and expanding. The player **stops re-sleeving**; the sleeve loop continues to improve the "synth template" while expansion happens on the corporation side.
4. **Expansion tiers**: neighbourhood, then city, then region/country, then planet.
5. **Planet seeding**: seeding new planets for profit until an end state is reached.
6. **Singularity** (end state, "of your own making"). Whether play continues after it is **OPEN**; it may simply be the end of the game.

### Story resets (branching loops)
Several resets loop the player through the story from different angles:
- **Route A: criminal underworld** takeover of the city. The story ends with the player **progression-locked**, then resetting to the very start (sleeve level 1), but keeping extra mechanics and boosts ("knowing how it ends").
- **Route B: political** takeover. Same wall, same kind of reset, with the opposite choice.
- **Route C: both at once**, combining the two into a full planetary takeover.
- Then the **planet-expansion phase**, then the singularity.
- **The wall:** must be clearly communicated to the player ("you cannot progress further like this"), but must NOT be a hard ceiling where income just stops. Idea: a **research** the player unlocks that lets them redo the run, with the need to do so made unmistakable. Designer is open to other ideas. OPEN.
- **A story reset is total:** everything goes back to sleeve level 1 (sleeve XP of sleeve actions too, and the whole corporation side). What is kept is **some form of boost**, plus **new upgrades unlocked based on the branch chosen**, to speed the next pass up. OPEN: the exact boost currency/form.
- **The two routes have distinct mechanics** and distinct **corporation-screen actions**. Corporation actions have no sleeve XP. Both routes are built on the derivative/exponential-growth idea. Specific mechanics are OPEN (to be designed later in detail).
- **The combined run (route C)** runs **both at once, all upgrades on one screen**. Each branch is **colour-coded throughout its own run** (thematic choice, plus generic things shared by both). In the combined run the UI mixes the themes but each concept stays colour-coded by the branch it belongs to. The combining step: **each side undoes the main blocking parameter of the other** (e.g. the underworld can launder the money the political run couldn't). Additional upgrades unlock that **multiply the effects** of both, which is what breaks through the wall.

## Re-sleeve upgrades, action count, pacing of re-sleeving

- **Tagged upgrades** (cybernetic, see 2b) are bought with **credits and nodes** like ordinary buyables. Some unlock via re-sleeve skills, some simply by the **total number of re-sleeves**. Assumed to be **rebought each life**. OPEN: whether to preview them early so the player sees what the next run holds.
- **Six sleeve actions in total**, and six corporation actions too.
- **First re-sleeve:** the Re-sleeve button carries the lore in its tooltip; the mechanics can be explained freely from that point.
- **When re-sleeving stops:** once the player can match synths to their current sleeve and no more skill points can be earned, there is no reason to re-sleeve. The exact count (today 38) is not firm. Re-sleeve length is not fixed: it depends on the skills chosen, so exact balance is not possible. Avoid extreme outliers where an upgrade does nothing; some patterns being optimal is fine.
- **Synthetic sleeves vs synths:** a copy of a past life is just an **algorithm that replays the life**: no soul, no life, only the knowledge of how to make credits. A synth can be given a copy of the algorithm and be just as good. So the sleeve's "synthetic sleeves" lead naturally into the corporation's **synths** (bottom tier of the chain).
- **Corporation tiers:** not fixed. Each tier produces the tier below, as in Derivative Clicker and CIFI. Designer's experience: about **8 layers** reliably reaches infinity fast regardless of growth factors, purely through multiplication. Tier count and names are OPEN; keep that in mind when choosing growth factors.

## The derivative scaling (corporation phase)

Production chains stack: **sub-corporations in neighbourhoods generate synth factories, which generate synths**; cities generate neighbourhoods, regions generate cities, planets generate regions, and so on. Layers may have different scaling or production methods. Side mechanics help these grow faster, and the sleeve loop (the synth template) keeps being improved alongside. This is the game's "derivative" (copies-of-copies) engine.

## Corporation phase: how it plays

- **Evolving gameplay.** Buying the first factory/synth tier starts a new loop on top of the old one; the game turns into something different while the old layer keeps running.
- **Corporation actions** are used much like sleeve actions. The first couple interact with the sleeve gameplay to smooth the transition (Insider backstabbing, stock acquisition); later ones raise the player's standing in the corporation and ownership of the city and world. Stock takeover is the first takeover mechanic and is "within the rules" (investing, helped by slight insider trading); later actions expand on it.
- **Separately from actions**, the player buys synths, factories, cities and so on, plus upgrades, aggressive expansion, overtaking competing corporations, and a slow transition into the underworld or political route.
- **Income principle:** *nothing in the corporation section earns money by itself.* Each tier **produces the tier below it**; the bottom tier is **synths**, and synths make the credits. Progress is mostly raising the speed at which synths are produced, with many different vectors for it. Buying the first of a tier starts passive generation of the tier below at all times.
- **Super currency:** synth credits may later become a higher-tier currency for expensive corporation acquisitions. OPEN.
- **Conquest:** opposition exists (rival corporations etc.) and depends on the story branch; how it is modelled is OPEN. Corporation actions are the main progress on conquest, and income is split between more synth production and more conquest capability.
- **The sleeve stays relevant:** the active sleeve is the **template every synth is based on**; upgrading it immediately upgrades all synths. So the player keeps improving the sleeve (without re-sleeving) because it multiplies the whole corporation income.
- **Side mechanics** (research, politicians, contracts, small storylines) are proactive: buying upgrades, action XP, strategic choices on passive boosts. **No random events**: they are not proactive player choices.
- **Routes and sleeve content.** The sleeve actions are the same in every route; each route instead unlocks **upgrades that are only available while on that route**.
- **The route choice** is a concrete, explicit player choice (presentation OPEN). It unlocks new options, so it feels like a reset although nothing resets. It is signalled ahead of time, mostly through lore.
- **Political lever (example direction, not planned):** legislation that benefits the player's criminal empire and hurts others, using the authorities against enemies.
- **Singularity:** the player pushes a button at the very end, which runs a game-over screen.
- **Planet seeding:** possibly just a final tier in the chain, possibly its own mechanics. Decided when reached.
- **Achievements,** if added, unlock once and then stay active for good (survive every reset).

