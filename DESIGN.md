# Cybersleeve – Game Design

Living design document. Source of truth for mechanics. Items marked **CONFIRMED** were confirmed by the user; **ASSUMPTION** items were inferred by Claude and need confirmation; **OPEN** items are undecided. Names (e.g. "credits") are placeholders and will likely be renamed, so code must not hard-code display names.

Last updated: 2026-10-24 (milestone 1 implemented and made fully configurable; engine hardened and run completion made closed-form; see `docs/ARCHITECTURE.md` and `docs/CONFIG.md`).

## 1. Concept

Cyberpunk idle/incremental game. The player is a character who performs **actions**. There is no life clock: the player builds up their current **sleeve** (body) and chooses when to **re-sleeve** (the first prestige layer). Later layers (not designed yet): several sleeves at once, each replaying a copy of the previous lifetime; companies/organisations that produce ever more sleeves; cities, outposts, planets.

## 2. Milestone 1 – the first sleeve life

Scope: three actions (credits, network, malware), action levels, per-action sleeve levels, speed multiplier, three buyables, passive income, a test-only re-sleeve.

### 2.1 Resources
| Resource | Notes |
|---|---|
| Credits | Main currency (placeholder name). Starts at 0. Spent on buyables. |

### 2.2 Actions
- An **action** is a task the character performs: base duration, reward, own experience/level.
- Default behaviour is **manual**: the player starts it, a progress bar fills, on completion the reward is paid and the player must start it again. Further automation will be added over time.
- First action (placeholder name "Earn credits") – **CONFIRMED**:
  - Base duration **1 s** (was 10 s until 2026-10-24; lowered to balance the low interface speed of 10%, which makes it take 10 s in practice), reward **0.5 credits** per completed run, **1 XP** per completed run.
- Second action "Grow network" – **CONFIRMED 2026-10-24**: base duration **3 s** (was 40 s), **no credits**; each completed run adds **1 network node** (and 1 XP). Own action level and own sleeve level.
- Third action "Push malware" – **CONFIRMED 2026-10-24**: base duration **6 s**, needs **access level 2**. Each completed run pays **1 credit per network node owned** and adds **1 heat**. With no nodes it pays nothing but still adds heat. Locked actions cannot be started and show "Locked: needs access level N".
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
speedMultiplier   = actionLevel × sleeveLevel of THAT action × interfaceSpeed × global.speedMultiplier
effectiveDuration = baseDuration / speedMultiplier
```
- Affects duration only. Reward per run stays 0.5 (**ASSUMPTION**: no reward scaling yet).
- Built as a list of pluggable **modifiers** (`SpeedModifier`), so new factors can be added without editing existing code.
- **Everything is configurable** (see `docs/CONFIG.md`): the XP needed for the first level and the growth per level, how much a level is worth (linear `perLevel` or exponential `base`), per action and for the sleeve, plus global levers for speed, rewards, XP and prices.

### 2.4a Network and passive income – CONFIRMED 2026-10-24
- Every network node produces **0.05 credits per second** (`network.creditsPerNodePerSecond`), continuously, also while no action is running.
- **ASSUMPTION (implemented):** nodes finished during a tick start producing on the next tick; `global.rewardMultiplier` also scales passive income; the network is **reset by re-sleeving** (like credits); output multipliers (buyables) would multiply nodes per run too.

### 2.5 Worked examples (used in tests)
- Sleeve level 1, action level 1, interface speed 100%: a run of Earn credits takes 1 s (10 s at the starting interface speed of 10%, 6.67 s at 15%), pays 0.5 credits, gives 1 XP.
- After 10 runs: action XP = 10, action level 2, run takes 5 s.
- After 100 runs of one action: that action's sleeve XP = 1.
- Sleeve level 2, action level 3: duration = 10 / 6 s.
- 20 manual runs = 10 credits: far from enough for Auto-run (10,000).
- A run of Grow network: +1 node. 20 nodes produce 1 credit per second.
- 100 nodes, 0 heat: a Push malware run pays 100 credits and adds 1 heat; the next run pays 99.

### 2.6 Re-sleeving (first prestige)
- Player chooses when to re-sleeve; the button needs a second click to confirm (CONFIRMED 2026-10-24), with a Cancel button. The real requirement is **OPEN**; for now re-sleeving is **always allowed** so it can be tested (a replaceable `ResleevePolicy`).
- Kept: every action's sleeve XP, sleeve level and its run counter towards the next sleeve XP.
- Reset: credits, the network, action XP and levels, run progress, purchases (**ASSUMPTION**).
- Effect: faster progress through the higher sleeve level in the speed multiplier.

### 2.7 Buyables
Purchases paid with credits, defined as data in `src/content/gameConfig.ts`. **Every buyable belongs to one action** (CONFIRMED 2026-10-24; all current ones to "Earn credits") and is shown inside that action's card as a small square button; name, price and description appear in a hover tooltip. **CONFIRMED** costs and effects:

| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 10,000 credits (raised from 10 on 2026-10-24) | Restarts the action automatically when it completes, no click needed. Leftover time carries into the next run. |
| Dual processors | 15 credits | Runs the action twice at once, modelled as an **output multiplier ×2**. |
| Duplicate processors | 150 credits, ×10 per copy | Repeatable, unlimited, unlocked by Dual processors. Each copy doubles the output again. |

- **ASSUMPTION (implemented):** the output multiplier applies to credits, action XP **and** the runs counted towards sleeve XP (two parallel runs = two completed actions). It does not change the duration.
- **ASSUMPTION:** buyables are reset by re-sleeving (including all copies of repeatable ones).

**Duplicate processors – CONFIRMED:** becomes available (visible) once Dual processors is owned. Costs **10x** Dual processors (150 credits), can be bought **without limit**, and its price rises by **an order of magnitude with every copy** (150, 1.5K, 15K, ...). Every copy doubles the output again (2^n on top of Dual's x2). Implemented generically: any buyable can have `requires`, `maxPurchases` and `costGrowth`.

### 2.7a Sleeve widget and global buyables – CONFIRMED 2026-10-24
A **Sleeve** widget sits to the side of the actions (desktop layout; actions are in a 3x2 grid with four cells still empty). It shows global stats and holds the global buyables (square buttons, details on hover).

| Stat | Starts at | Effect (CONFIRMED 2026-10-24) |
|---|---|---|
| Access level | 1 | Gates actions: an action runs only if access level >= its `requiredAccessLevel` (default 1). Push malware needs 2 |
| Interface speed | 10 % | A multiplier on the speed of every action (stored as 0.1, **shown as a percentage**). At 10 % every run takes ten times as long as its base time |
| Heat | 0 | A tax on all credits earned: each point is 1 %. 13 heat subtracts 13 % of credits earned (capped at 100 %). Cools down over time, see below |

| Global buyable | Effect |
|---|---|
| Interface boost | +0.05 interface speed: 10 % becomes 15 % (CONFIRMED 2026-10-24). One-time (CONFIRMED: not repeatable for now) |
| Access upgrade | access level becomes 2, unlocking Push malware |

- Heat comes from actions (Push malware: +1 per run). The tax applies to credits from action runs and to passive network income, not to network nodes. The payout shown on an action is already after tax.
- **Heat cooldown – CONFIRMED 2026-10-24:** a progress bar under the heat stat fills over **60 s**; each time it completes, heat drops by **1**. While heat is 0 the bar does not advance. Letting time pass is the only way to lower heat for now; more ways will be added. Time is counted from the start of each step, so heat added by an action in a step starts cooling in the next step.
- **ASSUMPTION:** heat and its cooldown bar are reset by re-sleeving; the access level resets with the purchases. Interface speed was briefly given as 0.5 (a multiplier) by mistake; the intended start is 0.1, shown as 10 %.
- **ASSUMPTION:** both buyables are one-time purchases, paid in credits (placeholder prices 100 and 1000), reset by re-sleeving like other buyables, and the start values are configurable (`sleeve` in `gameConfig.ts`).

### 2.7b Scope decisions – CONFIRMED 2026-10-24
- **Desktop first.** The interface is designed for desktop browsers only; it will be redesigned for mobile if that is ever needed (so hover tooltips are fine for now).
- **Balance is not a factor yet.** Oddities such as Push malware paying less than passive income, or only Earn credits having buyables, are expected: more mechanics, including buyables for every action, are still to come.
- **Temporary "Reset save" button** (top corner, next to the speed control): wipes the game completely (including sleeve XP) and the stored save. To be removed before release.

### 2.8 Time and offline
- **CONFIRMED:** the game keeps running while the window is unfocused or the tab is in the background. The loop measures real elapsed time (timer-based, not frame-based) and simulates the whole gap, so throttled background timers lose nothing.
- Gaps longer than 10 minutes (device asleep, app closed) are capped: **offline progress is not implemented** (a later mechanic).
- **Offline progress is out of scope for now** (CONFIRMED 2026-10-24). The save format will need a timestamp when it is designed.
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
