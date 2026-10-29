# Context: actions

Actions: definitions, runner, toggles, speed, levels and XP, rewards, Overclock and Focus.

Code: `src/core/actions/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Code structure (S5b, 2026-10-29)

- **One reward-rounding owner (P6):** `rewards.ts` `wholeRunAmount(kind, gross)` floors a run's amount for whole-unit kinds (`wholePerRun`). `payReward` (what is paid) and `Economy.payout` (what is shown) both call it, so they cannot drift. Pinned by `rewardRounding.test.ts` (zero, fractions, huge, negative, NaN, Infinity).
- **One pay path (P7):** `RewardPayer` (`rewardPayer.ts`) is the only code that turns a run into a payment: `payRun(def, runs, scale?)` (gross reward at the action's own multiplier, then `payReward` in its kind; the kind defaults to `DEFAULT_REWARD_KIND`) and `payLinked(targetId, runs)`. A critical run is `payRun` with `scale = rewardMultiplier`. `ActionRunner` no longer touches `Economy`.
- **One linked-payout source list (P8):** `DerivedStats.paysActions(id)` returns Overclock's `alsoPays` as a rule with chance 1 (first), then the owned `paysActionReward` rules. `LinkedPayouts.settle` draws them all (chance 1 draws nothing) and the runner pays each through `payLinked`. Order of random draws is unchanged.
- **`runBatch`** (was `completeRuns`) is a list of small steps: `settleCrits` (claim order banked -> Zero-day -> Admin key, settle, bank links, feed), `payBatch`, `chargeRunHeat` (one binomial draw), drops, `extendChain`, `applyEffects`, XP. The order fixes the order of random draws.
- **`StartCosts`** (`startCosts.ts`) holds `costOf` / `canPay` / `pay` (with the Credit Siphon), moved out of `ActionRunner` to keep it under 15 KB; `ActionRunner.startCostOf` delegates.
- **`progression.ts` split:** it stays the facade (`Progression`, the level queries). `xpReductions.ts` (`XpReductions`) owns the four reduction buyable kinds and `runsPerSleeveXp`; level lookups it needs are passed in. `sleeveXp.ts` owns `countRunsTowardSleeveXp` and `wholeCount`.
- Tests: `batchingPay.test.ts` (one long tick equals many short ones through the direct, `paysActionReward` and Overclock `alsoPays` paths, with a whole-unit reward that floors per run).

## Stats services (S6)

`DerivedStats` (`engine/stats.ts`) is a facade; the actions-context questions are answered by `ToggleStats` (`toggleStats.ts`: auto-run, linked payouts, chain, start cost scale, siphon, level bonus, Overclock and Focus status) and `RunStats` (`runStats.ts`: speed, duration, reward multiplier, payout, XP). The other contexts own their own: `crits/critStats.ts`, `items/itemStats.ts`, `economy/incomeStats.ts`, `heat/heatStats.ts`. `engine/statsFacade.test.ts` checks the facade equals each service built on the same state.

## Design (from DESIGN.md)

### 3. Actions

An action has a base duration, a reward of some kind, and its own XP, level and sleeve level. By default it is manual: the player starts it, a bar fills, on completion the reward is paid and the player must start it again. **Progress is the share of the run done**: when the speed changes mid-run only the rest of the run gets faster or slower. A manual run that completes discards leftover time; an auto-run carries it into the next run.

**Critical highlight:** an action card lights up (magenta border and a mark beside the start button) for one second of game time after it hit a critical success. One success in that second shows `CRITICAL!`; several show the average per second (`N crits/s`). The feed behind it (`core/crits/critFeed.ts`) is not saved and is cleared by re-sleeving.

**Critical success:** every run has a critical chance made of the Critical success buyable's chance, and the chance **may exceed 100%**: the whole part is that many critical successes for sure, the fraction a chance of one more (150% is one for sure and a 50% chance of a second; 240% is two and a 40% chance of a third). On top of that a Zero-day, an Admin key or a banked success adds **+100% chance to one run each** (on distinct runs, so one more sure success each). The batch is settled with binomial draws, never per run. **Each critical success applies the effect once:** it pays 3x the reward (whatever the reward kind) and gives 2x action XP, so a run with two pays 2 x 3 = 6x and gives 2 x 2 = 4x XP, and the completion effects of the critical rule apply once per success. A run with none is ordinary. Heat, drops, the runs counted towards sleeve XP and the ordinary completion effects are unchanged. The rule is data (`criticalSuccess` in the configuration), and an action may replace single fields of it (`criticalSuccess` on the action, including extra completion effects per critical run), so an action's critical success can later do something of its own. No action does yet.

**Overclock and Focus** are two switches that each action buys for itself (see 7, "The square on each action card"): they sit with Auto-run in the square beside the bars of the card, both off at first and both reset by re-sleeving. They add a speed factor to the action's speed (`speed` in 4) and nothing else.
- **Overclock** exists on an action once that action has bought its Overclock unlock AND has an Overclock effect of its own (`ActionDefinition.overclock`, so each action can get a different one; an action without one has no unlock). Each rule is a mix of gains and costs, and every action has its own:
  - **Grow network:** **50% faster**, at **2 heat per minute** while it is running overclocked (charged for the time the action actually ran, in fractions of a point; a manual action that has finished its run and is waiting costs nothing).
  - **Practice Hacking:** pays **200% more** (x3) per run, but every completed run costs **5 nodes** (never below 0 nodes). The bonus is part of the action's reward multiplier, so it scales that reward only, not XP or counted runs.
  - **Push malware:** every completed run **also pays the nodes of a Grow network run** (Grow network's reward with its own reward multipliers, rounded down per run; no XP, heat, drops or critical success for Grow network), and the run makes **three times as much heat, and twice as often** (heat chance 10% becomes 20%; the factors are `heatPerRunFactor` and `heatChanceFactor`).
  - **Kill servers:** pays **double the ICE Rating** per run (a reward bonus of +100%), and **heat does not cool at all** while the action is running overclocked: the cooldown stands still, Moles are not used and Burn leads cannot be used (the tile is disabled). Heat the action or anything else adds still counts. The **Kill chain** buyable (see 7) adds a chain on top of this: every consecutive completed run while the action stays overclocked and keeps running adds a **link** (at most 20). Each link makes the next run pay **10% more** of the base ICE Rating (added to the Overclock bonus: with 10 links the reward is 1 + 1 + 1 = x3) and take **10% more of the share of nodes** (1% becomes 1.1%, 1.2%, ... up to 3%). The chain is **broken** (back to 0 links) when the action stops (a manual run finishes, or an auto-run cannot pay its next start) or when Overclock is switched off. The reward per link is a **gain** and grows with the strength of Overclock; the node share per link is a price and does not. A chain exists only for an action with a start cost (its runs always come one per batch). The links are saved and reset by re-sleeving.
  - Every copy of the sleeve **Overclock upgrade** makes the **gains** of every Overclock 10% of their base stronger (strength 1, 1.1, 1.2, ...: the speed bonus 50%, 55%, 60%; the reward bonus 200%, 220%, 240%). The **costs and the extra payment** (heat, the 5 nodes, the 3x heat, the Grow network payment) are fixed: more copies never make the price higher.
- **Focus** exists on an action once that action has bought its Focus unlock. At most as many actions can be focused at once as there are **Focus slots**: one is free, and every copy of the sleeve **Focus upgrade** adds one (up to one per action). A focused action runs **25% faster**, whatever the number of slots. Switching on needs a free slot, switching off always works. Focus adds no heat. **With the Overdrive Cap re-sleeve skill** several slots can sit on the same action: its Focus cell splits into an **add** and a **remove** half, and every slot on an action multiplies its speed by 1.25 again (3 slots = 1.25^3). The extra slots are saved (`focusStacks`) and reset by re-sleeving; switching the action's Focus off takes all its slots off.
- The two multiply with each other and with the other speed factors (an overclocked and focused Grow network runs 1.5 x 1.25 times as fast).

**Access ladder:** actions are gated only by **access level** (starts at 1, +1 per Access upgrade copy). A locked card says why ("Needs access level 3"). A card whose start cost cannot be paid cannot be started.

| Action | Needs access | Base duration | Each completed run |
|---|---|---|---|
| Grow network | 1 | 3 s | +1 network node (rounded down per run) |
| Practice Hacking | 2 | 5 s | +0.01 Hacking Proficiency |
| Push malware | 3 | 6 s | +0.0001 credits per second added to the base payout of every node; each run has a 10% chance to make 1 heat (one binomial draw per batch of runs) |
| Kill servers | 4 | 2 min | +1 ICE Rating. Costs **1% of the nodes** (rounded down to whole nodes, so you need at least 100) each time a run starts, also for each auto-run restart. Decommission protocol lowers the share (and keeps it from vanishing), Credit Siphon pays credits for the nodes destroyed, and its Overclock builds a Kill chain (see 3 and 7) |
| Build Legend | 5 | 5 min | +1 Legend; removes 25% of the nodes (rounded down per run); +5 heat per second while it runs |

Every completed run gives 1 action XP. Several runs in one batch apply every effect that many times. Runs are computed in closed form, so any speed is exact.

**A reward multiplier** (a buyable) multiplies **only the reward its own action pays per run**, never XP, counted runs, heat or completion effects. There is no general output multiplier and no global reward multiplier; each lever names what it scales. Today the only global lever is `global.creditMultiplier`, which scales credits earned (run rewards paid in credits and passive income) and nothing else.

### 4. Levels, XP and speed

**Level rule.** Levels start at **0** with 0 XP. Every level costs its own full amount, and the XP counted inside a level starts again at 0 at each level-up. Leaving level 0 costs **10 XP**; each further level costs **2 times** the one before, for action levels (`progression.actionLevels`) and sleeve levels (`progression.sleeveLevels`) alike.

| Level reached | Costs on its own | Total XP |
|---|---|---|
| 1 | 10 | 10 |
| 2 | 100 | 110 |
| 3 | 1 000 | 1 110 |
| L | 10^L | 10 (10^L − 1) / 9 |

The stored XP is the running total; the screen shows the part inside the current level against the full cost of that level. Formula: a track with `xp` has gained `floor(log_g(xp (g − 1) / first + 1))` levels.

**Two tracks.** *Action XP / level*: per action, 1 XP per completed run, reset by re-sleeving. *Sleeve XP / level*: **per action**, 1 sleeve XP per **100** completed runs of that action (ASSUMPTION, implemented: whole points from a run counter that keeps its remainder), kept through re-sleeving.

**Speed.**
```
speed        = actionLevelFactor × sleeveLevelFactor (that action's) × interfaceSpeed × global.speedMultiplier
levelFactor  = 1 + level × 0.05            (+5% of the base speed per level)
duration     = baseDuration / speed        (never below engine.minRunDurationMs)
interfaceSpeed = (base + boosts) × networkFactor × hackingMultiplier × skill factor
hackingMultiplier = 1 + scale × ((1 + proficiency)^exponent − 1) / exponent      (concave, no ceiling), up to proficiency = knee
                    past the knee the same curve continues with a flatter exponent (below)
networkFactor = 1 + ln(nodes) / 100 per Network synergy copy, else 1
```
Hacking Proficiency is the total Practice Hacking has paid out, a stored total reset by re-sleeving. The curve uses scale 1 and exponent 0.25 (strong diminishing returns; 1 = straight line, 0 = logarithm); without it the speed fed itself exponentially. **From Hacking Proficiency 1 on the curve flattens further** (knee 1, exponent 0.1 past it): below 1 nothing changes, and past 1 each further point is worth even less. The second piece starts from the value AND the slope the first has at the knee, so the multiplier does not jump or kink there: with `r = (1 + proficiency) / (1 + knee)` the bonus past the knee is `bonus(knee) + scale × (1 + knee)^exponent × (r^beyondExponent − 1) / beyondExponent`. Both numbers are data (`sleeve.earnedSpeedKnee`, `sleeve.earnedSpeedExponentBeyond`); leaving them out gives one curve. The tooltips of Interface speed and Hacking Proficiency say where it changes. The level used for speed is the action level plus any level bonus from Skill transfer. Speed is built from pluggable modifiers, so new factors add without editing the old.

### The square on each action card
The run bar of an action card spans the full width of the card. Underneath it, beside the reward line and the two level bars (action level, sleeve level), sits a **square** of the same height as those three rows (78 px; cells of 36 px). It holds the toggles of the action:
- **Before Auto-run is bought** the whole square is one big button that buys it (its price is the action's own Auto-run price, listed with the action's purchases below).
- **Once Auto-run is owned** the square becomes a grid of four buttons: **Auto-run** (a toggle), **Overclock**, **Focus** and **Augment** (see 10; it applies one schematic and is disabled while none is held).
- **Overclock and Focus cells** show what the action has: a cell whose unlock is not bought is a purchase button (lit when affordable, the tip shows the price); once bought it is a toggle (lit when on, struck through when off). An action without an Overclock effect has an empty dashed cell there (and in the Augment cell when the game has no schematic).

| Per-action unlock | Cost | Effect |
|---|---|---|
| Overclock (Grow network, Practice Hacking, Push malware, Kill servers) | 25x that action's Auto-run price (Grow network: 250) | Unlocks that action's Overclock switch (see 3 for what each one does). |
| Focus (every action) | 100x that action's Auto-run price (Grow network: 1,000) | Unlocks that action's Focus switch: a focused action runs 25% faster, within the Focus slots. |

The prices are the same for every action for now. The sleeve-wide **Overclock upgrade** and **Focus upgrade** (above) scale what these toggles do.

### Practice Hacking
| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 100 credits | Restarts the action itself. |
| Kompromat harvest | 500 credits | 5% of completed runs drop a Kompromat file, rarity 90 / 10 / 0 / 0 / 0 over common, uncommon, rare, legendary, crisis (see 10). |
| Rarity refinement | 10,000 credits; needs the harvest | Increases the rarity of Kompromat drops based on Hacking Proficiency (see 10 for how). Its tooltip says just that. |
| Skill transfer | 1,000,000 credits | Adds Practice Hacking's **sleeve level** to Grow network's level, for speed only (not its XP). |
| Study methods | 1e15 credits | The XP every sleeve level of the **other** actions needs is divided by 1 + the sleeve level of Practice Hacking (level 1 halves it, level 3 quarters it); there is no ceiling. Practice Hacking itself is not affected. |

### Grow network
| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 10 credits | Restarts the action itself. |
| Parallel nodes | 75 credits, ×100 per copy, unlimited | Doubles the nodes each run pays (a reward multiplier). |
| Burn leads | 1,000 credits (placeholder); hidden until Push malware Overclock is owned (heat is not known before) | Each completed run has a 0.75% chance to drop a **Burn lead** (it has **no rarity**: one stack, named just "Burn lead"). Using a lead from the Inventory takes 5% of the current heat away (see 10). |
| Industrial Espionage | 10,000 credits | Each completed run has a 0.5% chance to drop an Augment schematic (see 10). |
| Self-replication | 1e10 credits | Nodes grow every second by (Grow network's plain action level / 1000)% of themselves, compounding, in closed form; the rate is read at the start of each slice. The tip shows the formula and the live numbers. |
| Network synergy | 1e35 credits | Multiplies the base interface speed by `1 + ln(nodes) / 100` (ASSUMPTION: the "+1" keeps it a bonus). |

### Push malware, Kill servers, Build Legend
| Buyable | Cost | Effect |
|---|---|---|
| Auto-run (Push malware) | 15,000 credits | Restarts the action itself. |
| Malware payload | 10,000 credits, ×100 per copy, unlimited | Doubles what each run adds to the node base payout (a reward multiplier). |
| Zero-day exploits (Push malware) | 5,000,000 credits | Each completed run has a 5% chance to drop a **Zero-day** (**no rarity**, like the Burn lead). Switched on in the Inventory, each Zero-day adds +100% critical chance to one completed Push malware run (see 10). |
| Persistence (Push malware) | 1,000,000,000,000 credits, one time | **Triples what a critical success does for Push malware**: the reward multiplier (3x) and the action XP multiplier (2x) of its critical runs become 9x and 6x. Ordinary runs and other actions are unchanged. |
| Ransomware (Push malware) | 5,000,000,000 credits | Every **critical success** of Push malware banks **+100% critical chance for Grow network's next run**; Grow network's next completed runs use the bank, one banked +100% per run (see 10). |
| Hardened payload (Push malware) | 100,000 credits | Adds 10 to the base ICE Rating for every action level of Push malware. The ICE Rating boost multiplies the sum, so the order of buying does not matter. |
| Auto-run (Kill servers) | 1e9 credits | Restarts the action itself. |
| Decommission protocol (Kill servers) | 1e14 credits (placeholder) | Every **plain action level** of Kill servers lowers the share of the nodes a run takes by **1% of its current value**: the share is multiplied by `0.99 ^ level`. The first level is worth the most (1% of the start value), every further one 1% of the new, smaller value, so it works at any level and never reaches zero. While owned, a node cost that rounds down to 0 is raised to **1 node**, so the action stays startable with fewer than 100 nodes (with 0 nodes there is still nothing to give up). One time. |
| Credit Siphon (Kill servers) | 1e12 credits (placeholder) | When a run starts, you are paid **10 seconds of what one node produces** for **every node the start cost destroys**: `nodes destroyed x credits per node per second now x 10`. The rate is the live per-node income, after the node payout multiplier and the heat tax (what one node delivers once the tax has taken its share). Paid at every start, also for each auto-run restart. One time. |
| Cascade failure (Kill servers) | 1e10 credits (placeholder), ×100 per copy, unlimited | The standard reward multiplier: **doubles the ICE Rating each run pays** (it scales that reward only, like Parallel nodes and Malware payload). |
| Kill chain (Kill servers) | 1e17 credits (placeholder); needs the Overclock unlock of Kill servers | Adds the **Kill chain** to this action's Overclock (see 3): up to 20 links, each making the next run pay 10% more ICE Rating and take 10% more of the node share. One time. |
| Black box recorder (Kill servers) | 1e20 credits (placeholder) | Each completed run has a 10% chance to drop an **Admin key** (no rarity, see 10). One time. |
| Auto-run (Build Legend) | 1e15 credits | Restarts the action itself. |

## Configuration (from docs/CONFIG.md)

### `actions[]` – one entry per action
| Field | Type | Meaning |
|---|---|---|
| `id` | string | Internal id (unique) |
| `name` | string | Display name (placeholder) |
| `baseDurationMs` | number > 0 | Run time at speed x1 (interface speed 1, level 0) |
| `rewardPerNetworkNode?` | boolean | When true the reward is paid once per network node owned (`reward * nodes`) |
| `heatPerSecond?` | number >= 0 | Heat added for every second the action is actually running (default 0; may be a fraction; idle time is not charged). Build Legend uses 5 |
| `heatChance?` | number in [0, 1] | The chance that a completed run adds its `heatPerRun` (default 1: every run). A batch of runs draws how many make heat in one binomial draw with the injected RandomSource (no draw at 1). Real content: Push malware 0.1 |
| `heatPerRun?` | number >= 0 | Heat added by each completed run that makes heat (default 0). Together with `heatPerSecond` and Overclock's `heatPerMinute`, the ways an action adds heat. Heat taxes only the credits network nodes produce, never a run's reward |
| `startCost?` | `{currency, amount? >= 0, fractionOfBalance? 0..1}` | Paid each time a run starts (manual or auto-run): `amount` plus `fractionOfBalance` of the balance held at that moment (network nodes: rounded down to whole nodes). A share-based cost that comes to 0 cannot be paid, so with 1% of nodes you need at least 100 nodes. Without enough the run cannot start. Such actions complete **one run per batch** (no closed-form multi-run batching) |
| `completionEffects?` | list of `{kind:'removeNodesFraction', fraction 0..1}` or `{kind:'removeNodes', amount: integer >= 1}` | Applied after each completed run, in order (several runs in a batch apply them that many times). `removeNodes` takes a fixed number of nodes per run and stops at 0 |
| `requiredAccessLevel?` | integer >= 1 | Access level needed to perform the action (default 1); until then it is locked |
| `reward` | BigNum >= 0 | Amount per completed run, in units of `rewardKind` |
| `rewardKind?` | `'credits'`, `'networkNodes'`, `'hackingProficiency'`, `'iceRating'`, `'legend'` or `'nodePayout'` | What `reward` is paid as (default credits). `networkNodes` adds to the network instead of the credit balance; `hackingProficiency` adds to Hacking Proficiency (untaxed, reset by re-sleeving); the Hacking Multiplier on interface speed is `1 + sleeve.earnedSpeedScale x ((1 + proficiency)^sleeve.earnedSpeedExponent - 1) / exponent`, so returns diminish |
| `xpPerRun` | BigNum >= 0 | Action XP per completed run |
| `levels?` | LevelRuleConfig | Overrides `progression.actionLevels` for this action |
| `sleeveLevels?` | LevelRuleConfig | Overrides `progression.sleeveLevels` for this action's sleeve level |
| `speedScaling?` | LevelScaling | Overrides `speed.actionLevel` for this action |
| `criticalSuccess?` | partial `criticalSuccess` rule | Replaces single fields of the global rule for this action's critical runs (see `criticalSuccess` below); validated like the global one. Default: the global rule |
| `overclock?` | `{speedBonus?, rewardBonus?, heatPerMinute?, heatPerRunFactor?, heatChanceFactor?, completionEffects?, alsoPays?, stopsHeatCooling?}`, at least one | What Overclock does to this action once the `overclock` buyable is owned. **Gains** (scaled by the buyable's strength, i.e. its copies): `speedBonus > 0` (0.5 = 50% faster) and `rewardBonus > 0` (2 = 200% more, x3; scales the action's own reward per run only). **Fixed costs and extras** (not scaled): `heatPerMinute >= 0` (heat per minute of game time while the action runs overclocked, in fractions of a point), `heatPerRunFactor >= 1` (multiplies the action's `heatPerRun`), `heatChanceFactor >= 1` (multiplies the action's `heatChance`, capped at 1), `completionEffects` (applied for every completed run, e.g. `{kind: 'removeNodes', amount: 5}`) and `alsoPays` (another action id: each completed run also pays that action's reward as if it had completed one run, with its reward multipliers; no XP, heat or drops). `stopsHeatCooling: true` holds heat in place while the action is running overclocked (the cooldown stands still, Moles are kept, Burn leads cannot be used). (A chain is not part of the rule: the `overclockChain` buyable adds it, see `buyables[]`.) An action without a rule has no Overclock switch. Real content: Grow network `{speedBonus: 0.5, heatPerMinute: 2}`, Practice Hacking `{rewardBonus: 2, completionEffects: [removeNodes 5]}`, Push malware `{alsoPays: 'grow-network', heatPerRunFactor: 3, heatChanceFactor: 2}`, Kill servers `{rewardBonus: 1, stopsHeatCooling: true}` |

### `focus` – what Focus does
| Field | Type | Meaning |
|---|---|---|
| `speedBonus` | number > 0 | A focused action runs this much faster (0.25 = 25%). Real content: 0.25 |
| `baseSlots` | integer >= 1 | Actions that can be focused at once before any `focusSlots` buyable is bought. Real content: 1 |

### `progression`
| Field | Meaning |
|---|---|
| `runsPerSleeveXp` | Completed runs of ONE action per batch of that action's sleeve XP (integer >= 1) |
| `sleeveXpPerGrant` | Sleeve XP per batch |
| `actionLevels` | Default level rule for actions (`firstLevelXp`, `growthFactor`) |
| `sleeveLevels` | Default level rule for every action's own sleeve level (an action may override it) |
| `startingCredits` | Credits at the start and after re-sleeve |
| `maxSleeveXpReduction` | The most that all sleeve-XP reduction buyables together can cut a sleeve level's XP requirement (fraction in [0, 1), default 0.99) |

**Level rule** (`LevelRuleConfig`): every level costs its own full amount of XP, and the XP inside a level starts again at each level-up. Levels start at 0. Going from level 0 to 1 costs `firstLevelXp`; each further level costs `growthFactor` times the one before: leaving level n costs `firstLevelXp * growthFactor^n`. Defaults 10 and 10: 10, then 100, then 1000 more, ... so level 1 is reached at 10 XP in total, level 2 at 110, level 3 at 1110.

### `speed`
`actionLevel` and `sleeveLevel` are `LevelScaling`:
- `{ kind: 'linear', perLevel }` -> `1 + level * perLevel` (levels start at 0, so level 0 is worth exactly 1; the current game uses 0.05, i.e. +5% per level)
- `{ kind: 'exponential', base }` -> `base ^ level`

Speed = actionLevel factor x the action's own sleeveLevel factor x interface speed (`sleeve`) x `global.speedMultiplier`; run time = `baseDurationMs / speed`.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-25 (by the user, after testing)*
- Interface speed earned by Practice Hacking goes through a concave curve with no ceiling (`sleeve.earnedSpeedScale` / `earnedSpeedExponent`, `core/kernel/concaveBonus.ts`). Duplicate processors on Practice Hacking was removed.

*Group: Decided 2026-10-25 (by the user, after testing)*
- **Hacking Proficiency flattens past 1 (2026-10-26):** the curve is unchanged below 1 Hacking Proficiency, and past it continues with a flatter exponent (`sleeve.earnedSpeedKnee: 1`, `earnedSpeedExponentBeyond: 0.1`), joined smoothly (same value and slope at the knee). "Scale the harder" was read, after asking, as flatter.

*Group: Decided 2026-10-25 (by the user, access ladder)*
- Actions are gated **only by access level** in the real content: Grow network 1, Practice Hacking 2, Push malware 3, Kill servers 4, Build Legend 5. Access upgrade (5 credits, x1000 per copy, unlimited) adds +1 level per copy (`accessLevel` effect is now `{ amount }` and stacks). The Unlock Legend buyable and Kill servers' node-count unlock were removed. The `unlock` rules and the `unlock` effect still exist in the engine (tests use them) but the real content uses none.

*Group: Decided 2026-10-26 (by the user, Overclock, Focus and Burn leads)*
- **Overclock** (changed 2026-10-26: per action, see the square below). An action unlocks its own Overclock toggle for 250 credits, if it has an Overclock effect of its own (`ActionDefinition.overclock`, a mix of gains and costs; each action's effect is meant to be unique). **Grow network:** 50% faster, +2 heat per minute while it runs. **Practice Hacking:** pays 200% more (x3), each completed run costs 5 nodes. **Push malware:** each run also pays the nodes of a Grow network run, and makes 3x the heat. The sleeve **Overclock upgrade** (250,000 credits, x1000 per copy, unlimited) makes the GAINS (speed bonus, reward bonus) of every Overclock 10% of their base stronger per copy; costs and the extra payment stay fixed (my reading of "10% increase to the effect"; confirmed). Heat per minute is charged only for time the action actually ran.

*Group: Decided 2026-10-26 (by the user, Overclock, Focus and Burn leads)*
- **Focus** (changed 2026-10-26): an action unlocks its own Focus toggle for 1,000 credits (every action can). A focused action runs 25% faster (`GameConfig.focus.speedBonus`). Focus slots limit how many actions are focused at once: 1 is free (`focus.baseSlots`), and the sleeve **Focus upgrade** (1,000,000 credits, x100,000 per copy, at most 4, so every action can get a slot) adds one per copy. The upgrades cost 1000x what the old sleeve buyables did.

*Group: Decided 2026-10-26 (by the user, Kill servers buyables): Kill servers gets five buyables and an Overclock. Prices (placeholders) climb in this order, each a few orders of magnitude above the one before: Cascade failure 1e10, Credit Siphon 1e12, Decommission protocol 1e14, Kill chain 1e17, Black box recorder 1e20. The Credit Siphon icon is the stylised credits chip with speed stripes behind it.*
- **Decommission protocol** (effect `startCostReduction`): the share of the nodes a run takes is multiplied by `0.99 ^ plain action level` (the first level is the biggest step, it never reaches zero). While owned, a node cost that rounds down to 0 is raised to 1 node (my reading of "the cost never reaches 0"; the plain rule still needs 100 nodes without it).

*Group: Decided 2026-10-26 (by the user, Kill servers buyables): Kill servers gets five buyables and an Overclock. Prices (placeholders) climb in this order, each a few orders of magnitude above the one before: Cascade failure 1e10, Credit Siphon 1e12, Decommission protocol 1e14, Kill chain 1e17, Black box recorder 1e20. The Credit Siphon icon is the stylised credits chip with speed stripes behind it.*
- **Credit Siphon** (effect `creditSiphon`): when a run starts, 10 seconds of the live per-node income (after the payout multiplier and the heat tax) are paid for each node destroyed.

*Group: Decided 2026-10-26 (by the user, Kill servers buyables): Kill servers gets five buyables and an Overclock. Prices (placeholders) climb in this order, each a few orders of magnitude above the one before: Cascade failure 1e10, Credit Siphon 1e12, Decommission protocol 1e14, Kill chain 1e17, Black box recorder 1e20. The Credit Siphon icon is the stylised credits chip with speed stripes behind it.*
- **Cascade failure**: the standard `rewardMultiplier` (x2, x100 per copy) on the ICE Rating a run pays.

*Group: Decided 2026-10-26 (by the user, Kill servers buyables): Kill servers gets five buyables and an Overclock. Prices (placeholders) climb in this order, each a few orders of magnitude above the one before: Cascade failure 1e10, Credit Siphon 1e12, Decommission protocol 1e14, Kill chain 1e17, Black box recorder 1e20. The Credit Siphon icon is the stylised credits chip with speed stripes behind it.*
- **Kill servers Overclock:** double ICE Rating per run (`rewardBonus: 1`) and heat does not cool at all while the action runs overclocked (`stopsHeatCooling`: the cooldown stands still, Burn leads cannot be used). The **Kill chain** is its own buyable (effect `overclockChain`, state `chains`, only for an action with a start cost; requires the Overclock unlock; it adds the chain to the Overclock): each consecutive overclocked run adds a link (at most 20) that makes the next run pay 10% more ICE Rating (a gain: scaled by the Overclock strength) and take 10% more of the node share (a price: fixed). Stopping the action or switching Overclock off breaks it.

*Group: Decided 2026-10-26 (by the user, after the full review)*
- **Unlock rules were removed** (`ActionDefinition.unlock`, the `unlock` effect, `unlockedActions`, `latchUnlocks`): actions are gated by access level only. Only save version 4 is read (version 3 support was removed).

*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Overdrive Cap:** several Focus slots per action, each multiplying speed by 1.25 again (the assistant chose multiplicative, as the user asked for the default); the Focus cell splits into add and remove halves. Saved as `focusStacks`.

*Group: Decided 2026-10-29 (by the user, after reviewing the migration plan)*
- **Study methods is a divisor with no ceiling:** the XP the other actions sleeve levels need is divided by `1 + perLevel x Practice Hacking sleeve level` (content `perLevel: 1`). It replaced `0.01% per level, max 25%`, which was dead at every reachable level. If it still feels small when played, the lever changes from XP cost to extra levels (decide after playing; not pre-built).
