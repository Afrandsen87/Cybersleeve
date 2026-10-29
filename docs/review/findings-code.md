# Code findings (Phase 1 audit, 2026-10-29)

**[V]** = I read the code. **[S]** = surveyed by a subagent, not traced. Path roots are `src/core/` unless stated.

## P. Parallel mechanics (same rule, more than one path)

Ordered by how much duplicated logic/tests/docs each carries. "Owner" is the single function/service that should hold the rule.

| # | Rule | Paths | Owner | |
|---|---|---|---|---|
| P1 | Critical "run is covered" (zero-day / admin key / banked success) | `stats.ts:202-210` criticalPossible, `stats.ts:217-227` maxCritsPerRun, `zeroDays.ts:99-104` claim, `actionRunner.ts:289-291` | `crits`: one `criticalCover(actionId)` | V |
| P2 | Crit count rounding (floor + fractional roll) and the extra-chance doubling | `critical.ts:75-83` vs `stats.ts:224-226` | `CriticalSuccesses.maxPerRun` next to `settle` | V |
| P3 | Burn lead: single vs batch heat removal | `burnLeads.ts:97-103` use() vs `:77-89` useMany() (k=1 gives the same value) | `use()` delegates to `useMany(r,1)` | V |
| P4 | Heat cycle length, "coolsNow", tax share and stop point re-derived in the UI | `cooldowns.ts:30` vs `ui/view/sleeveView.ts:70,81`; `heat.ts:65-67` vs `sleeveView.ts:69,87` | `heat`: export `cycleMs`, `coolsNow`, `heatTaxShare`; the UI only formats | V |
| P5 | Mole bonus formula | `heatPace.ts:47-48` vs `ui/view/moleBonus.ts:19` | `heat`: export the multiplier | S |
| P6 | Reward rounding (`wholePerRun` floor) | `economy.ts:74-76` payout vs `rewards.ts:62-66` payReward | `rewards.ts` | V |
| P7 | Pay a run's reward | `actionRunner.ts:272-273` payAlso and `:297-301` completeRuns both do grossReward then payReward and hard-code `'credits'` although `rewards.ts:36` has `DEFAULT_REWARD_KIND` | one `payRun(def, runs, mult)` in `actions/rewards` | V |
| P8 | Two ways to pay another action's reward | Overclock `alsoPays` (`actionRunner.ts:303`) vs `paysActionReward` buyable (`effectRegistry.ts:302-313`, `linkedPayouts.ts:54`) | one `LinkedPayouts` source list that both feed | V (both call payAlso; list sources differ) |
| P9 | "Per order of magnitude" curves: five hand-written variants (floor vs continuous log10) | `effects.ts:262`, `sleeveEuphoria.ts:26`, `rarityShift.ts:23`, `heatPace.ts:47`, `resleeveCarry.ts:81`, `levelRewardFactor.ts:33` (bypasses `concaveBonus.ts`) | `kernel/curves.ts` with named `orders`, `wholeOrders`, `logScaled` | S (semantics may be intentional; names hide it) |
| P10 | Same formula `(1 + perLn*ln(1+synths))^copies` | `resleeveEffects.ts:47`, `corporation.ts:83` | one `synthBoost()` in the resleeve context | S |
| P11 | Batch binomial/multinomial draw shape | `drops.ts:56`, `linkedPayouts.ts:55`, `actionRunner.ts:308`, `corporationEffects.ts:58,92`, `zeroDays.ts:106`, `critical.ts:79` | `sampling.ts`: a "per-run events in a batch" helper | S |
| P12 | Item-stack rules: take-one with held check; "first rarity" placement; drop share per rarity | `skillShards.ts:47,63`; `zeroDays.ts:68,99,107`; `burnLeads.ts:65,97`; `augments.ts:106`; `automation.ts:248`; `stats.ts:132-144` vs `drops.ts:79-86` | `Inventory.take/addFirst`; `ItemDrops` exposes normalised per-rarity chance | S |
| P13 | "Buyables of kind X owned" lookups | `progression.ts:87-100` (4 flatMaps), `buyableCaps.ts:26`, `synthSleeves.ts:89`, `resleeveCarry.ts:14`, `reflexArchive.ts:52`, `corporation.ts:51,92`, `serialization.ts:270`, `testing/invariants.ts:124` | one `ownedOfKind(kind)` in the effects context | S |
| P14 | Passive credits with heat tax | `stats.ts:435` taxedCreditsPerNode vs `economy.ts:98-102` | `economy` | S, low risk |
| P15 | Heat gain per second (tick) vs per run (completeRuns) | `actionRunner.ts:196-199` vs `:306-309` | Likely intentional (time vs run based); give it a `heatGained(slice)` function only if a third source appears | S, downgraded |

Overflow floors differ: `fields.ts:193-196` clamps plain numbers to MAX_SAFE_INTEGER, `:209-212` clamps amounts to 1e308; `overflow.ts` blurs the two [S]. Clamp rule belongs in `kernel`.

## Buyable-kind logic outside `effectRegistry` [S, many sites]
CLAUDE.md says "one registry entry per new kind". Kind checks still sit in: `config.ts:307-372` (4 kinds), `effects.ts:345-397` (query exceptions), `levelRewardFactor.ts:32`, `leverageEffects.ts:39-48`, `progression.ts`, `buyableCaps.ts`, `drops.ts:70`, `automation.ts:27,39`, `resleeveCarry.ts`, `resleeveGate.ts:24`, `synthSleeves.ts:89-158`, `corporation.ts:51-148`, `serialization.ts:213-320`, `state.ts:44-48`, and about 8 UI sites (`ui/view/buyableViews.ts`, `statReveal.ts`, `sleeveView.ts`, `inventoryView.ts`). Most are `if (kind === ...)` chains, not `assertNever` switches. Two effect families have their own registry-like loops: corporation (`corporationEffects.ts`, validated at `config.ts:307`) and leverage (`leverageEffects.ts`). Fix: kind-level traits (for example `carriedOver`, `synthMultiplier`) read from the registry instead of kind-name tests.

## Dependency problems [V from import graph]
- **12-file type cycle**: `stateTypes, configTypes, resleeveEffectTypes, itemTypes, corporationTypes, burnLeads, inventory, augments, automation, buyableTypes, actionTypes, types` (all `import type`, through the `types.ts` barrel, fan-in 50). Harmless at runtime, but it makes "who owns what" unreadable. Fix by giving each context its own `types` and removing runtime classes (`BurnLeads`, `Inventory`, `Augments`) from type files.
- **3-file value cycle**: `effectRegistry <-> heatEffects <-> resleeveEffects` (registry imports the entries, the entries import its types). Fix: `effectTypes.ts` (no entries), entries import only it.
- **UI cycles**: `tipText <-> uiText`, `skillTreeTypes <-> viewTypes`, `widgets/controls <-> dom`.
- **Test kits live in `core/`**: `resleeveSkillsKit.ts`, `skillsKit.ts` import `app/createGame` and `testing/`; move to `src/testing/`. Production `core` must not reach `app` or `testing`.
- **Hubs**: `core/index.ts` (fan-out 57, fan-in 61) and `types.ts` (fan-in 50) let any file reach any other. A per-context public `index.ts` plus a boundary test fixes this.
- **Derived stats facade reimplements engine rules**: `stats.ts` (22 KB) computes crit cover, drop shares, toggle status, speed, income, idle heat (see P1, P12, P14). Each context should answer its own stat; `DerivedStats` composes.
- `heat.ts` doc says `coolHeat` is called only by the engine, but `cooldowns.ts:54` also calls it (doc drift). `buyableTypes.ts:46` says crit chance is capped at 1; the code does not cap (`effectRegistry.ts:223`, `stats.ts:74`).
- `stats.ts` calls `resolveEffects` 9 times with no memo, and `dropSources` loops actions x item drops; this clashes with the render rule "no per-frame work that scales with buyables" [S, impact unmeasured].

## Layer-readiness (code side) [S, from the layer survey]
Hard-coded currencies (`buyableTypes.ts:250` closed `Currency` union; `shop.ts:102-198`; `engine.ts:576,581`; `resleeveCarry.ts:26,51`; `state.ts:41`), hard-coded carry lists of effect kinds (`state.ts:43-48`, `synthSleeves.ts:94-158`, `serialization.ts:320`), keyed singletons stored as named booleans (`zeroDaysOn`, `adminKeysOn`, `engine.ts:136-137`), snapshot keys with no sleeve id (`snapshot.ts:41-52`), one `SynthIncome` hook into global credits (`network.ts:29`). See findings-design D1/D2.

## Size and mixed responsibility
Source files over 15 KB (outliers `engine.ts`, `icons.ts` allowed): `effectRegistry.ts` 25.7, `config.ts` 24.8, `stats.ts` 21.9, `ui/view/viewTypes.ts` 21.4, `buyableTypes.ts` 20.7, `effects.ts` 20.0, `ui/uiText.ts` 18.7, `ui/uiTextParts.ts` 18.5, `serialization.ts` 18.2, `progression.ts` 17.9, `ui/tipText.ts` 16.8, `actionRunner.ts` 16.2.
Between 12 and 15 KB, close to the limit: `api.ts` 14.8, `automation.ts` 14.6, `ids.ts` 12.2, `invariants.ts` 12.0.
Tests over 12 KB: `viewModel` 18.5, `resleeveTree` 18.1, `iceRating` 17.5, `overclock` 16.9, `contentModes` 15.6, `buyableEffects` 15.6, `coreState` 15.3, `tooltipText` 14.9, `killServers` 14.9, `automation` 14.5, `items` 14.0, `engineSleeve` 13.2, `gameConfig` 12.9, `skillsTab` 12.8, `inventory` 12.6, `properties` 12.5.
Mixed responsibilities: `effectRegistry` (types + validators + ~75 entries + lookup), `stats` (rewards, drops, toggles, speed, income, heat), `effects` (action resolver, sleeve resolver, three query functions), `buyableTypes` (85-member union + definitions), `progression` (collectors, XP reductions, level queries, run recording), `zeroDays` (toggle + key use + bonus item drop), `heat` (cooldown + tax rule), `rarityShift` (stat helper + drop rule), `leverageEffects` (back-channel + drop weight), `actionRunner` (crit, drops, heat, payouts, XP in one `completeRuns`).

## Test structure [S]
- About 25 test files each define their own `game()` / `configWith()` / `withBuyables()` over `createGame` + `createConfig(testConfig, ...)`. Local `skill()` builders in 7 files; local `buy()` in two files despite `cyberneticsKit.buy`; local `stock()/own()` in 4-6 files; local `mount()` in 5 UI files.
- Missing kits: `gameKit` (game wrapper), `buyableKit` (buy/skill/withBuyables), `corporationKit` (action/contentWith/stock/own), `domMountKit` (mount and queries).
- Overlapping groups (candidate per-context folders): heat (5 core + 1 ui), crits (6), overclock (4), resleeve (4 + 3 ui), corporation (5 + 1 ui), skills (5 core + 4 ui + 9 content), levels (4 + 1 ui). `cyberneticsCrits`/`cyberneticsSpeed` already follow the kit model.
