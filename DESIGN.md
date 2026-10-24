# Cybersleeve – Game Design

Living design document. Source of truth for mechanics. Items marked **CONFIRMED** were confirmed by the user; **ASSUMPTION** items were inferred by Claude and need confirmation; **OPEN** items are undecided. Names (e.g. "credits") are placeholders and will likely be renamed, so code must not hard-code display names.

Last updated: 2026-10-24 (milestone 1 implemented and made fully configurable; engine hardened and run completion made closed-form; see `docs/ARCHITECTURE.md` and `docs/CONFIG.md`).

## 1. Concept

Cyberpunk idle/incremental game. The player is a character who performs **actions**. There is no life clock: the player builds up their current **sleeve** (body) and chooses when to **re-sleeve** (the first prestige layer). Later layers (not designed yet): several sleeves at once, each replaying a copy of the previous lifetime; companies/organisations that produce ever more sleeves; cities, outposts, planets.

## 2. Milestone 1 – the first sleeve life

Scope: five actions (interface speed, network, malware, kill servers, legend), action levels, per-action sleeve levels, speed multiplier, three buyables, passive income, a test-only re-sleeve.

### 2.1 Resources
| Resource | Notes |
|---|---|
| Credits | Main currency (placeholder name). Starts at 0. Spent on buyables. |

### 2.2 Actions
- An **action** is a task the character performs: base duration, reward, own experience/level.
- Default behaviour is **manual**: the player starts it, a progress bar fills, on completion the reward is paid and the player must start it again. Further automation will be added over time.
- First action (placeholder name "Practice Hacking"; renamed from "Earn credits" 2026-10-24) – **CONFIRMED**:
  - Base duration **1 s** (was 10 s until 2026-10-24; lowered to balance the low interface speed of 10%, which makes it take 10 s in practice), reward **0.5 credits** per completed run, **1 XP** per completed run.
- Second action "Grow network" – **CONFIRMED 2026-10-24**: base duration **3 s** (was 40 s), **no credits**; each completed run adds **1 network node** (and 1 XP). Own action level and own sleeve level.
- Third action "Push malware" – **CONFIRMED 2026-10-24**: base duration **6 s**, needs **access level 2**. Each completed run adds **0.1% to the node payout multiplier** (+0.001 to a bonus, so the multiplier is `1 + 0.001 x runs`: 1000 runs give x2, 3000 runs x4; it multiplies with the Node payout buyable; reset by re-sleeving) and **1 heat**. It no longer pays credits directly (CONFIRMED 2026-10-24). Locked actions cannot be started and show "Locked: Needs access level N".
- Fourth action "Kill servers" – **CONFIRMED 2026-10-24**: base duration **2 minutes**, **costs 1% of the current network nodes to start** (rounded down to whole nodes, spent when the run starts and again for each auto-run restart). Because the cost is a whole number and a run cannot be free, **you need at least 100 nodes** (100 to 199 nodes cost 1, 200 costs 2, ...). CONFIRMED 2026-10-24. Each completed run adds **+1 Circumvention** (no credits, no heat). **Unlocks when the network reaches 1000 nodes and stays unlocked** afterwards (until re-sleeving). No buyables for now.
- Fifth action "Legend" – **CONFIRMED 2026-10-24**: base duration **5 minutes**, unlocked by the global buyable *Unlock Legend* (placeholder price 1e20 credits). Each completed run adds **1 Infamy**, **removes 25% of the current nodes** and **adds 50 heat** (on top of the current heat; with enough Circumvention heat above 100 still allows credits). Several runs in one batch apply this that many times.
- **ASSUMPTION:** "baseline speeds 1 and 3" was read as base durations of 1 s and 3 s.
- **ASSUMPTION (implemented):** a manual run that completes discards any leftover time; the player clicks again.

### 2.3 Experience and levels
Two independent tracks use the same level rule.

**Action XP / action level** – per action, 1 XP per completed run.

**Sleeve XP / sleeve level** – **per action** (CONFIRMED 2026-10-24): every action has its own sleeve level, shown inside that action. 1 sleeve XP per **100** completed runs *of that action*. Sleeve XP **carries over** through re-sleeving; action XP does not.

**Level rule – CONFIRMED:** levels start at **1** with 0 XP. The first level-up (to 2) is at exactly **10 XP** (= 10 runs), then at every new order of magnitude.

| XP reached | Level |
|---|---|
| 0 – 9.99… | 1 |
| 10 | 2 |
| 100 | 3 |
| 1 000 | 4 |
| 10^n | n + 1 |

Formula: `level = 1` if `xp < 10`, else `1 + floor(log10(xp))`.

- **ASSUMPTION (implemented):** sleeve XP is awarded in whole points: a counter of completed runs grants 1 point each time it passes 100 and keeps the remainder. The counter survives re-sleeving. Sleeve level 2 therefore needs 10 sleeve XP = 1 000 runs.

### 2.4 Speed multiplier
```
speedMultiplier   = actionLevelFactor × sleeveLevelFactor of THAT action × interfaceSpeed × global.speedMultiplier
levelFactor       = 1 + (level - 1) × 0.05   (each level above 1 is worth +5% of the base speed; CONFIRMED 2026-10-24)
interfaceSpeed    = (base + boosts) × networkFactor × (1 + 0.001 × completed Practice Hacking runs)
networkFactor     = 1 + ln(nodes)/100 with Network synergy (else 1);  level used for speed = level + level bonus from Skill transfer
effectiveDuration = baseDuration / speedMultiplier
```
- Affects duration only. Reward per run stays 0.5 (**ASSUMPTION**: no reward scaling yet).
- Built as a list of pluggable **modifiers** (`SpeedModifier`), so new factors can be added without editing existing code.
- **Everything is configurable** (see `docs/CONFIG.md`): the XP needed for the first level and the growth per level, how much a level is worth (linear `perLevel` or exponential `base`), per action and for the sleeve, plus global levers for speed, rewards, XP and prices.

### 2.4a Network and passive income – CONFIRMED 2026-10-24
- **Nodes are whole numbers – CONFIRMED 2026-10-24.** Nodes gained per run are rounded down per run; prices in nodes are rounded up; percentage costs (Kill servers) are rounded down and must be at least 1; Legend removes `floor(25%)` of the nodes per run (so 3 nodes or fewer are never reduced); Self-replication carries its fractional growth (a hidden "progress to the next node") between ticks so slow growth is not rounded away; saves floor the node count.
- A **Network widget** under the Sleeve shows the nodes, credits per second and the payout per node (x multiplier, with a tooltip showing where it comes from).
- Every network node produces **0.05 credits per second** (`network.creditsPerNodePerSecond`), continuously, also while no action is running.
- **ASSUMPTION (implemented):** nodes finished during a tick start producing on the next tick; `global.rewardMultiplier` also scales passive income; the network is **reset by re-sleeving** (like credits); output multipliers (buyables) would multiply nodes per run too.

### 2.5 Worked examples (used in tests)
- Sleeve level 1, action level 1, interface speed 1: a run of Practice Hacking takes 1 s (10 s at the starting interface speed of 0.1, 6.67 s at 0.15), pays **no credits but adds 0.001 to a multiplier on interface speed** (until re-sleeving), gives 1 XP.
- After 10 runs: action XP = 10, action level 2, run takes 5 s.
- After 100 runs of one action: that action's sleeve XP = 1.
- Sleeve level 2, action level 3: duration = 10 / 6 s.
- 20 manual runs = 10 credits: far from enough for Auto-run (10,000).
- A run of Grow network: +1 node. 20 nodes produce 1 credit per second.
- 1000 runs of Push malware with no Node payout buyable: each node produces 0.05 x 2 = 0.1 credits per second; 100 nodes with 0 heat give 10 credits per second.

### 2.6 Re-sleeving (first prestige)
- Player chooses when to re-sleeve; the button needs a second click to confirm (CONFIRMED 2026-10-24), with a Cancel button. The real requirement is **OPEN**; for now re-sleeving is **always allowed** so it can be tested (a replaceable `ResleevePolicy`).
- Kept: every action's sleeve XP, sleeve level and its run counter towards the next sleeve XP.
- Reset: credits, the network, action XP and levels, run progress, purchases (**ASSUMPTION**).
- Effect: faster progress through the higher sleeve level in the speed multiplier.

### 2.7 Buyables
Purchases paid with credits (or network nodes, see the Sleeve table), defined as data in `src/content/gameConfig.ts`. Action buyables are shown inside that action's card as a small square button; name, price and description appear in a hover tooltip. A buyable's card only decides where it is displayed: its effect may reach beyond the action (CONFIRMED 2026-10-24). **CONFIRMED** costs and effects:

| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 10,000 credits (raised from 10 on 2026-10-24) | Restarts the action automatically when it completes, no click needed. Leftover time carries into the next run. |
| Circumvention boost (Push malware) | 250,000 credits, ×100 per copy (every 2nd order of magnitude) | Repeatable, unlimited. Multiplies Circumvention by 2 per copy. CONFIRMED 2026-10-24 |
| Auto-run (Push malware) | 10,000,000 credits | Restarts the action automatically. |
| Skill transfer | 50,000 credits | Adds Practice Hacking's **sleeve level** to the **level** of Grow Network, as a flat addition that only affects Grow Network's speed multiplier, not its XP or leveling progress. |
| Study methods | 1e15 credits | Every sleeve level of the **other** actions needs less XP: **0.01% per sleeve level of Practice Hacking, at most 25%** (level 5 = 0.05% less; the cap is reached at level 2500). CONFIRMED 2026-10-24. **Practice Hacking itself is not affected**, so its level is always measured against the normal thresholds. |
| Duplicate processors | 150 credits, ×10 per copy | Repeatable, unlimited, **no unlock condition** (Dual processors was removed 2026-10-24). Each copy doubles the output (so also the interface speed multiplier gained per run). |

- **Auto-run is a toggle – CONFIRMED 2026-10-24:** after buying any auto-run buyable, clicking it switches auto-run **on or off** (it starts on; an off button is struck through). The tooltip shows ON/OFF. Switches reset on re-sleeving with the purchases.
- **Re-sleeving resets all new stats – CONFIRMED 2026-10-24:** Circumvention, Infamy, the remembered Kill servers unlock and the auto-run switches reset like the network and the purchases; only sleeve XP survives.
- **Layout:** all action cards have the same size; text is kept to one line (shortened, cut with an ellipsis rather than wrapped). A locked card says why ("Locked: Needs 1K nodes"). Hovering anywhere on a Sleeve stat row (label or value) shows its tooltip.
- **ASSUMPTION (implemented):** the output multiplier applies to credits, action XP **and** the runs counted towards sleeve XP (two parallel runs = two completed actions). It does not change the duration.
- **ASSUMPTION:** buyables are reset by re-sleeving (including all copies of repeatable ones).

**Duplicate processors – CONFIRMED:** becomes available (visible) once Dual processors is owned. Costs **10x** Dual processors (150 credits), can be bought **without limit**, and its price rises by **an order of magnitude with every copy** (150, 1.5K, 15K, ...). Every copy doubles the output again (2^n on top of Dual's x2). Implemented generically: any buyable can have `requires`, `maxPurchases` and `costGrowth`.

**Grow Network buyables – CONFIRMED 2026-10-24:**

| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 100 credits | Restarts the action automatically. |
| Parallel nodes | 10,000 credits, ×1000 per copy (every 3rd order of magnitude) | Repeatable, unlimited. Each copy doubles the output. |
| Self-replication | 1e10 credits | Nodes grow by **0.0001% of themselves per second** (compounding, closed form per tick; nodes finished during a tick start growing on the next tick). |
| Network synergy | 1e35 credits | Multiplies the **base** interface speed by `1 + ln(nodes) / 100` (never below 1), before the run multiplier. ASSUMPTION: the "+1" keeps it a bonus; a literal `ln(nodes) / 100` would shrink speed below about 2.7e43 nodes. "Base" includes Interface boost and Node uplink. |

### 2.7a Sleeve widget and global buyables – CONFIRMED 2026-10-24
A **Sleeve** widget sits to the side of the actions (desktop layout; actions are in a 3x2 grid with four cells still empty). It shows global stats and holds the global buyables (square buttons, details on hover).

| Stat | Starts at | Effect (CONFIRMED 2026-10-24) |
|---|---|---|
| Access level | 1 | Gates actions: an action runs only if access level >= its `requiredAccessLevel` (default 1). Push malware needs 2 |
| Interface speed | 0.1 | A multiplier on the speed of every action (**shown as a plain number**, e.g. 0.1 or 0.15; changed from a percentage 2026-10-24; hovering it shows the calculation as a tooltip). At 0.1 every run takes ten times as long as its base time. Interface speed = (base + Interface boosts) x (1 + 0.001 per completed Practice Hacking run). So 1000 runs double it, 3000 runs quadruple it: every doubling takes twice as many runs as the last (diminishing returns, CONFIRMED 2026-10-24; may be tuned further). The run multiplier resets on re-sleeving. Raising the base (boosts) gives sudden jumps |
| Heat | 0 | A tax on all credits earned: each point is 1 %. 13 heat subtracts 13 % of credits earned (capped at 100 %). Cools down over time, see below. **Circumvention lowers its effect** (below); hovering shows the calculation |
| Circumvention | 1 | **Reduces the effect of heat by 0.5% per order of magnitude** (100% at 1e200, capped). Effective heat = heat x (1 - reduction); the tax is still at most 100%, but credits now only stop at `100 / (1 - reduction)` heat: with a 50% reduction credits stop at 200 heat, not 100. Raised by Kill servers (+1 per run); multiplied by the Push malware buyable. Applies to run payouts and passive income. CONFIRMED 2026-10-24 |
| Infamy | 0 | Makes **heat cool 10% slower per point** (a cooldown cycle is `60 s x (1 + 0.1 x infamy)`). **Falls by exactly 1 each time a 10 minute cycle completes** (a progress bar below the value, like the heat cooldown; the cycle only runs while Infamy is above 0). Raised by Legend (+1 per run). Hovering shows the effect. CONFIRMED 2026-10-24 |

| Global buyable | Effect |
|---|---|
| Interface boost | 100 credits, +0.05 interface speed: 0.1 becomes 0.15. **Repeatable, unlimited; each copy costs 1000x more** (every 3rd order of magnitude). CONFIRMED 2026-10-24 |
| Node payout | 750 credits, **each node produces 50% more credits** (x1.5 per copy, compounding). Repeatable, unlimited; each copy costs 100,000x more (every 5th order of magnitude). CONFIRMED 2026-10-24 |
| Unlock Legend | Placeholder 1e20 credits. Unlocks the Legend action. |
| Node uplink | **Costs 100 network nodes** (the nodes are spent) and raises the base interface speed by 0.1. Repeatable, unlimited; each copy costs 100,000x more nodes (every 5th order of magnitude: 100, 1e7, 1e12, ...). CONFIRMED 2026-10-24 |
| Access upgrade | 10,000 credits (raised from 1000), access level becomes 2, unlocking Push malware |

**Sleeve layout – CONFIRMED 2026-10-24:** the purchases are shown in sections, each sorted by base price ascending: *Rebuyable* (repeatable, paid in credits), *One-time* (paid in credits) and *Paid in nodes* (any buyable priced in nodes). **A rebuyable lights up when it has been bought before and the next copy is affordable.** Stat order: Access level, Interface speed, Circumvention, Heat with its cooldown bar, Infamy with its cycle bar. The heat value is shown on its own; hover for the tax calculation. Action cards start their info line with "Action speed".

- Heat comes from actions (Push malware: +1 per run, Legend: +50 per run). The tax applies to credits from action runs and to passive network income, not to network nodes. The payout shown on an action is already after tax.
- **Heat cooldown – CONFIRMED 2026-10-24:** a progress bar under the heat stat fills over **60 s**; each time it completes, heat drops by **1**. While heat is 0 the bar does not advance. Letting time pass is the only way to lower heat for now; more ways will be added. Time is counted from the start of each step, so heat added by an action in a step starts cooling in the next step.
- **ASSUMPTION:** heat and its cooldown bar are reset by re-sleeving; the access level resets with the purchases. Interface speed was briefly given as 0.5 (a multiplier) by mistake; the intended start is 0.1, shown as 0.1.
- **ASSUMPTION:** both buyables are one-time purchases, paid in credits (placeholder prices 100 and 1000), reset by re-sleeving like other buyables, and the start values are configurable (`sleeve` in `gameConfig.ts`).

### 2.7b Scope decisions – CONFIRMED 2026-10-24
- **Desktop first.** The interface is designed for desktop browsers only; it will be redesigned for mobile if that is ever needed (so hover tooltips are fine for now).
- **Balance is not a factor yet.** Oddities such as Push malware paying less than passive income, or only Practice Hacking having buyables, are expected: more mechanics, including buyables for every action, are still to come.
- **Temporary "Reset save" button** (top corner, next to the speed control): wipes the game completely (including sleeve XP) and the stored save. To be removed before release.

### 2.8 Time and offline
- **CONFIRMED:** the game keeps running while the window is unfocused or the tab is in the background. The loop measures real elapsed time (timer-based, not frame-based) and simulates the whole gap, so throttled background timers lose nothing.
- Gaps longer than 10 minutes (device asleep, app closed) are capped: **offline progress is not implemented** (a later mechanic).
- **Offline progress is out of scope for now** (CONFIRMED 2026-10-24). The save format will need a timestamp when it is designed.
- **Tick size does not matter (CONFIRMED 2026-10-24):** a long tick is cut into slices of at most 1 s (at most 64 per tick, `engine.maxSliceMs` / `maxSlicesPerTick`) so one long tick and many short ones give the same result, including feedback such as interface speed rising with every run.
- **Run completion is exact at any scale:** many runs in one long tick are computed in closed form (see `docs/ARCHITECTURE.md`, Tick loop), so very fast actions or the x10 toggle never lose time to a per-tick cap.
- **Test aid:** a toggle in the top-right corner multiplies game time by 10 (button label `Speed x10`). Not saved; to be removed or hidden before release.

## 3. Out of scope for now
Story beats and tone, further automation, more shop contents, multiple actions, multiple simultaneous sleeves, organisations/cities/planets, the late-game "derivative" copy scaling, offline progress, naming.

## 4. Open questions
1. Confirm the sleeve-XP counter model and that the output multiplier also multiplies XP and counted runs.
2. What is the real re-sleeve requirement?
3. Should buyables survive re-sleeving?
4. Theme text/names for the action, buyables and currency.
5. Offline progress design (later).
