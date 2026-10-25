# Cybersleeve – Game Design

Living design document. Source of truth for mechanics. Items marked **CONFIRMED** were confirmed by the user; **ASSUMPTION** items were inferred by Claude and need confirmation; **OPEN** items are undecided. Names (e.g. "credits") are placeholders and will likely be renamed, so code must not hard-code display names.

Last updated: 2026-10-25 (Kompromat harvest, items and the Inventory; second review: the credit multiplier scales credits only, heat is added only through `heatPerRun`, tax rate configurable; before that: milestone 1 implemented and made fully configurable; engine hardened and run completion made closed-form; see `docs/ARCHITECTURE.md` and `docs/CONFIG.md`).

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
- Default behaviour is **manual**: the player starts it, a progress bar fills, on completion the reward is paid and the player must start it again. **Progress is the share of the run that is done (CONFIRMED 2026-10-25):** when the speed changes mid-run (a purchase, a level-up, the Hacking Multiplier) the share done stays and only the rest of the run gets faster or slower. It used to be stored as elapsed time, so a speed-up made the bar jump ahead and finished late runs at once. Further automation will be added over time.
- **Action order and access ladder – CONFIRMED 2026-10-25:** the action grid is ordered Grow network, Practice Hacking, Push malware, Kill servers, Build Legend. Access level starts at 1 and rises by 1 per *Access upgrade* copy. Required access level: Grow network 1 (open from the start), **Practice Hacking 2**, **Push malware 3**, **Kill servers 4**, **Build Legend 5**. There are no other unlock conditions: the node-count rule on Kill servers and the Unlock Legend buyable were removed. Opening: Grow network pays nodes, nodes pay credits, 5 credits buy the first Access upgrade, which opens Practice Hacking.
- First action (placeholder name "Practice Hacking"; renamed from "Earn credits" 2026-10-24; **since 2026-10-25 it is the second action and needs access level 2**) – **CONFIRMED**:
  - Base duration **5 s** (set to 5 s on 2026-10-25, so a run takes **50 s** at the starting interface speed of 0.1; was 1 s, 10 s in practice; was 10 s until 2026-10-24; lowered to balance the low interface speed of 10%, which makes it take 10 s in practice), reward **0.5 credits** per completed run, **1 XP** per completed run.
- Second action "Grow network" – **CONFIRMED 2026-10-24**: base duration **3 s** (was 40 s), **no credits**; each completed run adds **1 network node** (and 1 XP). Own action level and own sleeve level.
- Third action "Push malware" – **CONFIRMED 2026-10-24**: base duration **6 s**, needs **access level 3** (was 2 until 2026-10-25). Each completed run adds **0.000001 credits per second to the BASE value of every node** (CONFIRMED 2026-10-25; the base is `network.creditsPerNodePerSecond`, 0.01, so 10,000 runs double it to 0.02 and 30,000 runs make it 0.04; it adds up linearly and is then multiplied by the Node payout buyable; reset by re-sleeving) and **1 heat**. **Until 2026-10-25 it wrongly added to a multiplier** (`1 + 0.0001 x runs`) that was multiplied with the buyable; the user intended an addition to the base value, which is what it does now (the size per run was kept so that the effect with no buyables is the same). It no longer pays credits directly (CONFIRMED 2026-10-24). Locked actions cannot be started and show "Locked: Needs access level N".
- Fourth action "Kill servers" – **CONFIRMED 2026-10-24**: base duration **2 minutes**, **costs 1% of the current network nodes to start** (rounded down to whole nodes, spent when the run starts and again for each auto-run restart). Because the cost is a whole number and a run cannot be free, **you need at least 100 nodes** (100 to 199 nodes cost 1, 200 costs 2, ...). CONFIRMED 2026-10-24. Each completed run adds **+1 ICE Rating** (no credits, no heat). **Needs access level 4** (since 2026-10-25; the "network reaches 1000 nodes" unlock was removed, but the 100-node start cost remains). No buyables for now.
- Fifth action "Build Legend" (renamed from "Legend" 2026-10-25) – **CONFIRMED 2026-10-24**: base duration **5 minutes**, **needs access level 5** (since 2026-10-25; the global buyable *Unlock Legend* was removed). Each completed run adds **1 Infamy**, **removes 25% of the current nodes** and **adds 50 heat** (configured as `heatPerRun: 50`, like every other action's heat, on top of the current heat; with enough ICE Rating heat above 100 still allows credits). Several runs in one batch apply this that many times.
- **ASSUMPTION:** "baseline speeds 1 and 3" was read as base durations of 1 s and 3 s.
- **ASSUMPTION (implemented):** a manual run that completes discards any leftover time; the player clicks again.

### 2.3 Experience and levels
Two independent tracks use the same level rule.

**Action XP / action level** – per action, 1 XP per completed run.

**Sleeve XP / sleeve level** – **per action** (CONFIRMED 2026-10-24): every action has its own sleeve level, shown inside that action. 1 sleeve XP per **100** completed runs *of that action*. Sleeve XP **carries over** through re-sleeving; action XP does not.

**Level rule – CONFIRMED (corrected 2026-10-25):** levels start at **0** with 0 XP (changed 2026-10-25 from starting at 1; the XP thresholds and the speed are unchanged, so every level is simply one lower than it used to be). **Every level costs its own full amount of XP, and the XP counted inside a level starts again from 0 at each level-up.** The first level-up (to 1) costs exactly **10 XP** (= 10 runs); each further level costs **10 times** the one before.

| Level reached | Costs on its own | Total XP gathered |
|---|---|---|
| 2 | 10 | 10 |
| 3 | 100 | 110 |
| 4 | 1 000 | 1 110 |
| n + 1 | 10^n | 10 (10^n − 1) / 9 |

(Until 2026-10-25 the thresholds were the plain totals 10, 100, 1000, ..., so each level asked only the difference from the one before: 90, 900, ... instead of 100, 1000, ....)

The stored XP is the running total; the interface shows the part inside the current level against the full cost of that level (for example level 1 at 60 total XP shows `50/100 XP`). Formula: with `first` and `growth`, a track with `xp` total has gained `floor(log_growth(xp (growth − 1) / first + 1))` levels, so `level = that` (levels start at 0). The same rule applies to the sleeve levels; a sleeve-XP reduction makes every level's cost proportionally smaller.

- **ASSUMPTION (implemented):** sleeve XP is awarded in whole points: a counter of completed runs grants 1 point each time it passes 100 and keeps the remainder. The counter survives re-sleeving. Sleeve level 1 therefore needs 10 sleeve XP = 1 000 runs.

**Levels start at 0 – CONFIRMED 2026-10-25.** Every action level and sleeve level starts at 0 instead of 1, and a level is simply the number of level-ups gained; the XP costs and the speed are unchanged (the speed used to be `1 + (level - 1) x 0.05` and is now `1 + level x 0.05`). **Three buyables read a level as a number and so each lose exactly one level of effect, because the number is one lower than it was** (the user asked for no change in balance; this is the one place where the zero-based number itself shows): *Skill transfer* adds Practice Hacking's sleeve level to Grow network's level (one level, so 5% of Grow network's speed, less than before), *Self-replication* grows the network by action level / 1000 % per second (0 instead of 0.001 % at the start) and *Study methods* cuts 0.01 % XP per sleeve level (one level, 0.01 %, less). If exact equality with the old numbers is wanted, add 1 in those three formulas.

### 2.4 Speed multiplier
```
speedMultiplier   = actionLevelFactor × sleeveLevelFactor of THAT action × interfaceSpeed × global.speedMultiplier
levelFactor       = 1 + level × 0.05   (levels start at 0; each level is worth +5% of the base speed; CONFIRMED 2026-10-24, re-based to zero 2026-10-25 with the same result)
interfaceSpeed    = (base + boosts) × networkFactor × hackingMultiplier
hackingMultiplier = 1 + scale × ((1 + hackingProficiency)^exponent − 1) / exponent
hackingProficiency = the total Practice Hacking has paid out so far: +0.001 per completed run (a stored total, reset by re-sleeving; CONFIRMED 2026-10-25: named Hacking Proficiency, shown as a Sleeve attribute under Interface speed, with a tooltip that shows the multiplier it gives)
                    (CONFIRMED 2026-10-25: concave, no ceiling. exponent 0.25 = strong diminishing returns; 0 = logarithm; 1 = straight line.
                     Tuning: sleeve.earnedSpeedScale / earnedSpeedExponent. Without it the speed fed itself exponentially.)
networkFactor     = 1 + ln(nodes)/100 with Network synergy (else 1);  level used for speed = level + level bonus from Skill transfer
effectiveDuration = baseDuration / speedMultiplier
```
- Affects duration only. Reward per run stays 0.5 (**ASSUMPTION**: no reward scaling yet).
- Built as a list of pluggable **modifiers** (`SpeedModifier`), so new factors can be added without editing existing code.
- **Everything is configurable** (see `docs/CONFIG.md`): the XP needed for the first level and the growth per level, how much a level is worth (linear `perLevel` or exponential `base`), per action and for the sleeve, plus global levers for speed, rewards, XP and prices.

### 2.4a Network and passive income – CONFIRMED 2026-10-24
- **Nodes are whole numbers – CONFIRMED 2026-10-24.** Nodes gained per run are rounded down per run; prices in nodes are rounded up; percentage costs (Kill servers) are rounded down and must be at least 1; Legend removes `floor(25%)` of the nodes per run (so 3 nodes or fewer are never reduced); Self-replication carries its fractional growth (a hidden "progress to the next node") between ticks so slow growth is not rounded away; saves floor the node count.
- A **Network widget** under the Sleeve shows, in this order, the nodes, the payout per node and the credits per second (order set 2026-10-25). **The payout per node shows what one node really pays per second now** (e.g. `0.015/s`: (base + the Push malware bonus) x credit lever x the Node payout multiplier x the share kept after the heat tax; changed on 2026-10-25 from showing only the x multiplier). Its tooltip shows the calculation step by step, ending with the node count and the network's total per second.
- Every network node produces **0.01 credits per second** (`network.creditsPerNodePerSecond`; was 0.05 until 2026-10-25), continuously, also while no action is running.
- **ASSUMPTION (implemented):** nodes finished during a tick start producing on the next tick; `global.creditMultiplier` scales credits only (run rewards paid in credits and passive income; CONFIRMED 2026-10-25: no global multiplier exists for other reward kinds); the network is **reset by re-sleeving** (like credits); a reward multiplier (buyable) on Grow Network multiplies the nodes per run.

### 2.5 Worked examples (used in tests)
- Sleeve level 0, action level 0, interface speed 1: a run of Practice Hacking takes 5 s (50 s at the starting interface speed of 0.1, 33.3 s at 0.15), pays **no credits but adds 0.001 Hacking Proficiency** (which raises the Hacking Multiplier on interface speed; until re-sleeving), gives 1 XP.
- After 10 runs: action XP = 10, action level 1, run takes 5 s.
- After 100 runs of one action: that action's sleeve XP = 1.
- Sleeve level 1, action level 2: duration = 10 / 6 s.
- 20 manual runs = 10 credits: far from enough for Auto-run (1,000).
- A run of Grow network: +1 node. 20 nodes produce 1 credit per second.
- 10,000 runs of Push malware with no Node payout buyable: the base of each node is 0.01 + 10,000 x 0.000001 = 0.02 credits per second; 100 nodes with 0 heat give 2 credits per second. With one Node payout copy (x1.5) each node produces 0.03.

### 2.6 Re-sleeving (first prestige)
- **Positive list – CONFIRMED 2026-10-25:** a re-sleeve carries over ONLY what is named in `CARRIED_OVER_ACTION_FIELDS` (`core/state.ts`): each action's sleeve XP (so its sleeve level) and the run counter towards its next sleeve XP. Everything else resets, including anything added later; to carry something over, add it to that list.
- Player chooses when to re-sleeve; the button needs a second click to confirm (CONFIRMED 2026-10-24), with a Cancel button. The real requirement is **OPEN**; for now re-sleeving is **always allowed** so it can be tested (a replaceable `ResleevePolicy`).
- Kept: every action's sleeve XP, sleeve level and its run counter towards the next sleeve XP.
- Reset: credits, the network, action XP and levels, run progress, purchases (**ASSUMPTION**).
- Effect: faster progress through the higher sleeve level in the speed multiplier.

### 2.7 Buyables
Purchases paid with credits (or network nodes, see the Sleeve table), defined as data in `src/content/gameConfig.ts`. Action buyables are shown inside that action's card as a small square button; name, price and description appear in a hover tooltip. A buyable's card only decides where it is displayed: its effect may reach beyond the action (CONFIRMED 2026-10-24). **CONFIRMED** costs and effects:

| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 1,000 credits (was 10, then 10,000; set to 1,000 on 2026-10-25) | Restarts the action automatically when it completes, no click needed. Leftover time carries into the next run. |
| ICE Rating boost (Sleeve) | 250,000 credits, ×100 per copy (every 2nd order of magnitude) | Repeatable, unlimited. Multiplies ICE Rating by 2 per copy. CONFIRMED 2026-10-24. **Moved to the Sleeve widget on 2026-10-25**: it is no longer tied to Push malware (no `actionId`), so it shows under *Rebuyable* in the Sleeve. |
| Auto-run (Push malware) | 10,000,000 credits | Restarts the action automatically. Listed **first** on the Push malware card (2026-10-25). |
| Malware payload (Push malware) | 50,000 credits, ×10,000 per copy (every 4th order of magnitude), added 2026-10-25 | Repeatable, unlimited. Doubles Push malware's output: what each run adds to the base payout of every node (a `rewardMultiplier`, so it scales only that reward, not XP, heat or counted runs). Second on the card, after Auto-run. |
| Auto-run (Kill servers) | 1 billion (1e9) credits | Restarts the action automatically; every restart pays the start cost again (1% of the nodes). Added 2026-10-25. |
| Auto-run (Build Legend) | 1 Qa (1e15) credits | Restarts the action automatically. Added 2026-10-25. |
| Kompromat harvest | 500 credits | Each completed run has a 5% chance to drop a Kompromat file (rarity 90/9/1/0/0 %). Second on the card. See section 2.7c. |
| Rarity refinement | 150,000 credits (needs Kompromat harvest; third on the card) | Hacking Proficiency shifts the drop ratios towards the rarer rarities. See section 2.7c. |
| Skill transfer | 1,000,000 credits (was 50,000 until 2026-10-25: it unlocked too fast) | Adds Practice Hacking's **sleeve level** to the **level** of Grow Network, as a flat addition that only affects Grow Network's speed multiplier, not its XP or leveling progress. |
| Study methods | 1e15 credits | Every sleeve level of the **other** actions needs less XP: **0.01% per sleeve level of Practice Hacking, at most 25%** (level 5 = 0.05% less; the cap is reached at level 2500). CONFIRMED 2026-10-24. **Practice Hacking itself is not affected**, so its level is always measured against the normal thresholds. |
| ~~Duplicate processors~~ | removed 2026-10-25 | Removed by the user: doubling the output also doubled the interface speed gained per run, which made the speed grow exponentially. Practice Hacking has no output multiplier now. |

- **Auto-run is a toggle – CONFIRMED 2026-10-24:** after buying any auto-run buyable, clicking it switches auto-run **on or off** (it starts on; an off button is struck through). The tooltip shows ON/OFF. Switches reset on re-sleeving with the purchases.
- **Re-sleeving resets all new stats – CONFIRMED 2026-10-24:** ICE Rating, Infamy, the remembered Kill servers unlock and the auto-run switches reset like the network and the purchases; only sleeve XP survives.
- **All tooltips follow one standard (CONFIRMED 2026-10-25), written for readability and understanding by the player:** a calculation tip is the formula(s), a blank line, the variables (one per line, named as the player sees them, with Title Case names), a blank line, and the result. The blank lines are intentional. Tips say what things do and never what they do not do (no "not", "never" or "no" in tips or purchase descriptions; a test enforces it). Applies to: Access Level (with the next unlock), Interface Speed, Hacking Proficiency, ICE Rating, Heat, Infamy, the payout per node, each action's Action Speed, and purchases (name, what it does, then cost and, for repeatables, how many are owned). **Every Sleeve attribute has a tooltip.** Tips never wrap lines; they grow wider.
- **Tooltips never wrap (2026-10-25):** every hover tip grows to fit its longest line; only the line breaks written in the text start a new line (the window width is the only limit).
- **Layout:** all action cards have the same size; text is kept to one line (shortened, cut with an ellipsis rather than wrapped). A locked card says why ("Locked: Needs access level 3"). **The "Action speed" line has a hover tip (2026-10-25)** that explains how the speed comes about: action speed = action level x sleeve level x interface speed (x the global speed lever when it is not 1), the worth of each level, and run time = base time / action speed, ending with the result for that action. Hovering anywhere on a Sleeve stat row (label or value) shows its tooltip.
- **CONFIRMED 2026-10-25:** there is **no general output multiplier**. A `rewardMultiplier` buyable multiplies the **reward its own action pays per run** (credits, nodes, ...) and nothing else: not the action XP, not the runs counted towards sleeve XP, not heat, not completion effects, not the duration. (It replaces the earlier `outputMultiplier`, which also doubled XP and counted runs; testing showed that was not good.) Every future multiplier names what exactly it multiplies.
- **ASSUMPTION:** buyables are reset by re-sleeving (including all copies of repeatable ones).

**Duplicate processors – REMOVED 2026-10-25 (history below):** becomes available (visible) once Dual processors is owned. Costs **10x** Dual processors (150 credits), can be bought **without limit**, and its price rises by **an order of magnitude with every copy** (150, 1.5K, 15K, ...). Every copy doubles the output again (2^n on top of Dual's x2). Implemented generically: any buyable can have `requires`, `maxPurchases` and `costGrowth`.

**Grow Network buyables – CONFIRMED 2026-10-24:**

| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 100 credits | Restarts the action automatically. |
| Parallel nodes | 500 credits (was 10,000 until 2026-10-25), ×1000 per copy (every 3rd order of magnitude) | Repeatable, unlimited. Each copy doubles the **nodes each run pays**; XP and everything else after the run is unchanged. |
| Self-replication | 1e10 credits | **Tooltip (2026-10-25):** "The network grows by a percentage every second." with the formula line "Growth factor percentage = Action level / 1000" under it (a purchase can carry a `formula`). Under the formula the tooltip shows the live numbers: `Action level = N`, then `Growth factor percentage = N%`. Nodes grow every second by **(Grow network's action level / 1000)% of themselves** (e.g. level 50 = 0.05% per second; CONFIRMED 2026-10-25, was a fixed 0.0001% per second). Uses the plain action level, not the level bonus from Skill transfer. Compounding, closed form per tick; the rate is read at the start of each slice, so a level-up counts from the next slice; nodes finished during a tick start growing on the next tick. |
| Network synergy | 1e35 credits | Multiplies the **base** interface speed by `1 + ln(nodes) / 100` (never below 1), before the hacking multiplier. ASSUMPTION: the "+1" keeps it a bonus; a literal `ln(nodes) / 100` would shrink speed below about 2.7e43 nodes. "Base" includes Interface boost and Node uplink. |

### 2.7c Items, drops and the Inventory – CONFIRMED 2026-10-25
- **Items are a new entity** (`GameConfig.items`): kinds (today only the *Kompromat file*) that exist in five **rarities**, most common first: Common, Uncommon, Rare, Legendary, Crisis level. Item counts are kept per kind and rarity in the **inventory**, which resets on re-sleeving like credits and purchases (**ASSUMPTION**, easy to change).
- **Kompromat harvest** (Practice Hacking, the **second** purchase on its card, **500 credits**, one-time): every completed Practice Hacking run has a **5% chance** to drop a Kompromat file. When one drops, its rarity is drawn from **90 / 9 / 1 / 0 / 0** (common, uncommon, rare, legendary, crisis; percentages). Both the drop chance and the rarity shares are plain numbers on the buyable's `itemDrop` effect and will be changed by future mechanics.
- **Blackmail, not a sale – CONFIRMED 2026-10-25:** the payment is the Kompromat being used for blackmail, which is why heat and the credit lever do not touch it. The stack tooltip says so ("Used as blackmail: pays N credits each"). The code still calls it selling (`sellItems`, `sellValue`).
- **Paying out:** the **Inventory widget** (under Network, shown once the harvest is owned or something is held) lists each stack that is held with its count and two buttons, *Sell 1* and *Sell all*. One item sells for **10 credits** (common) and **an order of magnitude more per rarity**: 100, 1,000, 10,000 and 100,000 for crisis level. A sale pays in full: the heat tax and the credit lever do not apply (they scale run rewards and passive income only).
- **Rarity refinement – CONFIRMED 2026-10-25** (Practice Hacking, 150,000 credits, one-time, listed after the harvest and hidden until it is owned): **every whole order of magnitude of Hacking Proficiency** (`floor(log10)`; none below 10) is one *shift*. A shift moves **1% of each rarity's weight to the next rarity**; the amounts are **worked out for all rarities up front and then moved all at once**. So with 90/9/1/0/0 the first shift gives 89.1/9.81/1.08/0.01/0: legendary receives 0.01 from rare, but crisis receives nothing because legendary was 0 when the amounts were worked out; **only the second shift lets the last rarity drop**. The last rarity has no next rarity and keeps what it has. The total never changes; with a huge proficiency everything ends up in the last rarity (steps are capped at 10,000, after which nothing visible changes). The shift is read from the current proficiency each time runs complete and each time Test drop is pressed. Hacking Proficiency resets on re-sleeving, so the shift starts over. The tooltip shows the formula, the proficiency and the number of shifts.
- **Test aid – Test drop button (2026-10-25):** in the corner with Reset save and Speed x10 (development builds or `?debug` only). One press drops exactly one item by the current rarity weights, whatever the drop chance; before the harvest is bought it uses the configured rule so the drops can be tried at once. To be removed with the other test aids.
- **Known and accepted:** selling stops mattering rather quickly because earnings outgrow it. It is there to give the player something to do early; items get more uses later.
- Drops are random, but computed for a whole batch of runs at once (no per-run rolling), so a long tick and many short ones give the same drop *rate*.

### 2.7a Sleeve widget and global buyables – CONFIRMED 2026-10-24
**Layout (CONFIRMED 2026-10-25):** the Sleeve, Network and Inventory widgets form a band ABOVE the actions, split from them by a line across the screen: Sleeve on the left; to its right, in thirds of the width, Network, **Sleeve Improvements** (the sleeve-wide purchases paid in credits) and **Network Exploitation** (the purchases paid in nodes); these purchases used to sit inside the Sleeve widget (titles are placeholders, the user's spelling "explotation" was read as Exploitation). Inventory is below them, across all three. The actions are a 3x2 grid below the line (one cell still empty). The **Sleeve** widget shows the global stats; the global buyables are in the two widgets next to Network. It shows global stats and holds the global buyables (square buttons, details on hover).

| Stat | Starts at | Effect (CONFIRMED 2026-10-24) |
|---|---|---|
| Access level | 1 | Gates actions: an action runs only if access level >= its `requiredAccessLevel` (default 1). Starts at 1, +1 per Access upgrade copy. Practice Hacking needs 2, Push malware 3, Kill servers 4, Build Legend 5 |
| Interface speed | 0.1 | A multiplier on the speed of every action (**shown as a plain number**, e.g. 0.1 or 0.15; changed from a percentage 2026-10-24; hovering it shows the calculation as a tooltip). At 0.1 every run takes ten times as long as its base time. Interface speed = (base + Interface boosts) x network bonus x hacking multiplier, where the hacking multiplier is 1 + a concave function of the interface speed Practice Hacking has paid out (see section 2.4; the tooltip shows the numbers and the curve; CONFIRMED 2026-10-25, it replaced the straight line `1 + 0.001 per run`). The hacking multiplier resets on re-sleeving. Raising the base (boosts) gives sudden jumps |
| Heat | 0 | A tax on the **credits network nodes produce** (CONFIRMED 2026-10-25; it does not touch run rewards, item payments or building nodes): each point is 1 % (`sleeve.heatTaxPerPoint`, configurable). 13 heat subtracts 13 % of the node income (capped at 100 %). Cools down over time, see below. **ICE Rating lowers its effect** (below); hovering shows the calculation |
| ICE Rating | 1 | **Reduces the effect of heat by 0.5% per order of magnitude** (100% at 1e200, capped). Effective heat = heat x (1 - reduction); the tax is still at most 100%, but credits now only stop at `100 / (1 - reduction)` heat: with a 50% reduction credits stop at 200 heat, not 100. Raised by Kill servers (+1 per run); multiplied by the Push malware buyable. Applies to run payouts and passive income. CONFIRMED 2026-10-24 |
| Infamy | 0 | Makes **heat cool 10% slower per point** (a cooldown cycle is `60 s x (1 + 0.1 x infamy)`). **Falls by exactly 1 each time a 10 minute cycle completes** (a progress bar below the value, like the heat cooldown; the cycle only runs while Infamy is above 0). Raised by Legend (+1 per run). Hovering shows the effect. CONFIRMED 2026-10-24 |

| Global buyable | Effect |
|---|---|
| Interface boost | 100 credits, +0.05 interface speed: 0.1 becomes 0.15. **Repeatable, unlimited; each copy costs 1000x more** (every 3rd order of magnitude). CONFIRMED 2026-10-24 |
| Node payout | **25 network nodes** (the nodes are spent; was 250 credits, 750 before that, until 2026-10-25), **each node produces 50% more credits** (x1.5 per copy, compounding). Repeatable, unlimited; each copy costs **100x** more (every 2nd order of magnitude; was 100,000x). Shown in the Network Exploitation widget. CONFIRMED 2026-10-25 |
| ~~Unlock Legend~~ | removed 2026-10-25 | Build Legend is gated by access level 5 instead. The Sleeve widget has no one-time purchases any more (the section is left out while empty). |
| Node uplink | **Costs 100 network nodes** (the nodes are spent) and raises the base interface speed by 0.1. Repeatable, unlimited; each copy costs 100,000x more nodes (every 5th order of magnitude: 100, 1e7, 1e12, ...). CONFIRMED 2026-10-24 |
| Access upgrade | **5 credits, repeatable and unlimited; each copy costs 1000x more** (every 3rd order of magnitude: 5, 5K, 5M, 5B, ...), CONFIRMED 2026-10-25. Each copy raises the access level by 1 (copies stack), which opens the next action. |

**Sleeve Improvements shows no "Rebuyable" heading (2026-10-25):** the rebuyable buttons come first, without a title line; the One-time heading (when there are one-time purchases) stays.

**Sleeve layout – CONFIRMED 2026-10-24:** the purchases are shown in sections, each sorted by base price ascending: *Rebuyable* (repeatable, paid in credits), *One-time* (paid in credits) and *Paid in nodes* (any buyable priced in nodes). **A rebuyable lights up when it has been bought before and the next copy is affordable.** Stat order: Access level, Interface speed, ICE Rating, Heat with its cooldown bar, Infamy with its cycle bar. The heat value is shown on its own; hover for the tax calculation. Action cards start their info line with "Action speed".

- Heat comes from actions (Push malware: +1 per run, Legend: +50 per run). **CONFIRMED 2026-10-25: the heat tax applies ONLY to the credits network nodes produce (passive income).** In the story it models the character being careful not to exploit the nodes too much when attention on them is high (story text comes later). Run rewards (including credits), item payments and building nodes are never taxed, so a run's payout does not fall as heat rises. This replaced the earlier rule that also taxed credits paid by action runs; the engine's closed-form series for falling payouts (`creditsForRuns`) was removed with it.
- **Heat cooldown – CONFIRMED 2026-10-24:** a progress bar under the heat stat fills over **60 s**; each time it completes, heat drops by **1**. While heat is 0 the bar does not advance. Letting time pass is the only way to lower heat for now; more ways will be added. Time is counted from the start of each step, so heat added by an action in a step starts cooling in the next step.
- **ASSUMPTION:** heat and its cooldown bar are reset by re-sleeving; the access level resets with the purchases. Interface speed was briefly given as 0.5 (a multiplier) by mistake; the intended start is 0.1, shown as 0.1.
- **ASSUMPTION:** both buyables are one-time purchases, paid in credits (placeholder prices 100 and 1000), reset by re-sleeving like other buyables, and the start values are configurable (`sleeve` in `gameConfig.ts`).

### 2.7b Scope decisions – CONFIRMED 2026-10-24
- **Desktop first.** The interface is designed for desktop browsers only; it will be redesigned for mobile if that is ever needed (so hover tooltips are fine for now).
- **Balance is not a factor yet.** Oddities such as Push malware paying less than passive income, or only Practice Hacking having buyables, are expected: more mechanics, including buyables for every action, are still to come.
- **Temporary "Reset save" button** (top corner, next to the speed control): wipes the game completely (including sleeve XP) and the stored save. To be removed before release.

### 2.7e Industrial Espionage and Augment schematics – CONFIRMED 2026-10-25
- **Industrial Espionage** (Grow network, **10,000 credits**, one-time; listed after Parallel nodes): every completed Grow network run has a chance to drop an **Augment schematic**, a new item (in all five rarities, like Kompromat; it goes to the Inventory and is applied to actions, never paid out). **ASSUMPTION (placeholder numbers):** the same as Kompromat: 5% chance per run, rarity 90 / 9 / 1 / 0 / 0.
- **Augment button – every action card, top right corner.** Pressing it applies **one** Augment schematic to that action. **Within one rarity the boost is additive: each schematic adds 1% to the XP boost of ITS rarity** on that action (3 common = +3%, not 1.01 cubed). **The boosts of the different rarities multiply each other** (CONFIRMED 2026-10-25): 3 common, 3 uncommon and 3 rare schematics give **1.03 x 1.03 x 1.03** of the base action XP per run, which is what makes a rarer schematic worth using. The next action levels need fewer runs. **Only the action level**: the sleeve level follows the number of runs and is not affected. The button is disabled while no schematic is held; its tooltip shows the calculation (`XP per Run = Base XP x Boost of each Rarity`) and then the **whole calculation with the numbers in** on the `XP per Run` line (for example `XP per Run = 1 x (1 + 0.01 x 3) x (1 + 0.01 x 2) = 1.0506`), the augments applied per rarity, the schematics held and which rarity the next press uses.
- **Which schematic is used up – CONFIRMED:** always the **most common rarity held**, so **every common one has to be used before an uncommon one** can be. The applied augments are kept per action and rarity, are saved, and are **reset by re-sleeving** (not on the carry-over list).
- **Schematics cannot be paid out – CONFIRMED 2026-10-25:** the player never wants to sell them, so the Inventory rows of the Augment schematic have no *Sell* buttons (an item definition can say `sellable: false`) and the engine refuses to sell them. Their tooltip says how they are used instead.
- The amount per schematic is data: `items.augment` (`itemId`, `xpBonusPerItem` 0.01, the same for every rarity for now).

### 2.7d Tabs and skills – CONFIRMED 2026-10-25
- **Two tabs at the top, centered: Character and Skills.** Everything that existed before is on **Character** (the Sleeve, Network, Sleeve Improvements, Network Exploitation and Inventory widgets, the actions and the re-sleeve button). **Skills** shows the points available in brackets next to its name (`Skills (3)`), and only the word when there are none. The credits stay visible on both tabs. The Skills tab is for now just a box holding the skills as buttons (a whole skill tree comes later), under the line "Skill points: N".
- **Skill points – CONFIRMED:** you start with **none**; **the first point comes when an action reaches level 1**, and one more for every **order of magnitude of the total of all action levels** (the sum over the actions' levels, not the sleeve levels): 0 points at a total of 0, **1 at 1** (changed 2026-10-25 from starting with 1), **2 at 10, 3 at 100, 4 at 1,000**, and so on (`1 + floor(log10(total))` from a total of 1). A skill costs **1 point** each for now (a skill can have another price). Points available = points earned minus what the owned skills cost, so nothing is stored for them. **ASSUMPTION:** the skills are reset by re-sleeving together with the action levels they depend on (like every purchase), so every life starts with no points, until an action reaches level 1.
- **The skills (all one-time, 1 point each; the names in italics are made up and can be changed):**

| Skill | Effect |
|---|---|
| *Overclocked Cortex* | Interface speed x1.05 |
| *Bandwidth Leech* | Node payout x1.1 (compounds with the Node payout buyable) |
| *Cold Trail* | Heat cools down 5% faster (each cooldown cycle is 1/1.05 as long) |
| *Muscle Memory* | Hacking Proficiency counts 5% higher, wherever it is used: the hacking multiplier on interface speed and the shifting of the drop ratios. The stat on the screen shows the raised value |
| *Quick Study* | Every ACTION level needs 1% less XP (sleeve levels are unchanged), like Study methods does for sleeve levels, with the same overall cap |
| *Nose for Secrets* | Doubles the Kompromat base drop chance (the chance that a run drops at all; the result is at most 100%) |
| Exploit Kompromat | Node payout x(1 + 1% per uncommon Kompromat file held) |
| Back Channel Deals | Lets the player give up common Kompromat files for **Moles**, see below |

- **Back Channel Deals and Moles – CONFIRMED:** the skill puts a **Back channel** button on the common Kompromat stack in the Inventory. Each press gives up **one** file for **5 Moles**. A new **Moles** counter in the Network widget (shown once the skill is owned, or Moles are held) is the number of points of heat that **cool 200% faster (three times the pace; was 50% until 2026-10-25)**. While there are Moles and heat, the heat cools at 3x pace (on top of Cold Trail), and **every point of heat cooled uses up one Mole**; when the Moles are gone the heat cools at the normal pace again. Moles are kept while there is no heat, and are reset by re-sleeving. The boost and the Moles per file are data on the skill.
- The heat cooldown bar now counts progress in units of normal-speed time, so a faster cooldown moves the bar faster and a change of speed never makes it jump.

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
1. Confirm the sleeve-XP counter model (each completed run counts as one run; reward multipliers do not change it).
2. What is the real re-sleeve requirement?
3. Should buyables survive re-sleeving?
4. Theme text/names for the action, buyables and currency.
5. Offline progress design (later).
