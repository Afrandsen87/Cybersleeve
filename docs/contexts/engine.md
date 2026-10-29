# Context: engine

Tick loop, engine facade, queries and commands, time.

Code: `src/core/engine/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Design (from DESIGN.md)

### 12. Time

- The game keeps running while the window is unfocused: the loop measures real elapsed time and simulates the whole gap. Gaps over 10 minutes are capped; offline progress is not implemented.
- **Tick size does not matter:** a long tick is cut into slices of at most 1 s (at most 64), so one long tick and many short ones give the same result including feedback such as interface speed rising with every run.
- One tab plays: a second tab or window is told the game is taken before it loads the save.
- The save is written every 10 s, when the page is hidden and when it closes. The last good save is kept as a fallback; the player can copy the save as text and paste one back (Export save / Import save).

## Architecture (from docs/ARCHITECTURE.md)

### Tick loop
`setTimeout` (50 ms; keeps firing in background tabs) → `GameLoop.step` (real elapsed time × `timeScale`, capped at 10 min) → `GameEngine.tick(delta)` → the tick is cut into slices of at most `engine.maxSliceMs` (at most `engine.maxSlicesPerTick` slices); for each slice: passive network income (`nodes × rate × slice × heat-tax factor`, nodes owned at the start of the slice) → network growth → heat cooldown and Legend decay (closed form) → for each action (skipped while locked by access level): apply auto-run, advance progress, then complete runs **in batches** (below) → `OverflowPolicy.apply` → `render()` (skipped while `document.hidden`). A step that throws is reported (`onError`, default `console.error`) and the loop carries on.
**Progress of a run.** `ActionState.progress` is the share (0 up to, not including, 1) of the current run that is done. Each step takes `(1 - progress) x duration` to finish at the speed of the moment, so a change of speed only changes the rest of the run. A tolerance of `1e-9` of a run (`PROGRESS_EPSILON` in `actionRunner.ts`) stops floating-point rounding from keeping a finished run waiting. The save format is version 6; only the current version is read.

**Batches (closed form).** All runs between two level changes are identical in speed and reward, so they are applied at once: `n = min(runs that fit in the time left, Progression.runsBeforeLevelChange)`. A batch pays its reward in full (`n × reward`; heat taxes only the credits network nodes produce, so a run's payout does not fall as heat rises), adds `n × heat`, and records `n × XP` and `n` counted runs. A tick therefore costs about one batch per level gained, not one iteration per run; `maxBatchesPerTick` is only a safety net. A manual run that completes drops leftover time; an auto-run carries it into the next batch.

**Automation.** `Automation` (`core/automation/automation.ts`) owns the unlocks and settings in `GameState.automation` (saved, reset by re-sleeving) and runs once per slice after the actions (`GameEngine.advance`): Auto Burn computes the number of leads that brings heat to the ceiling (`BurnLeads.useMany`), autosale sells whole stacks of the switched-on rarities (`Inventory.sell`), dispersal splits the schematics held by largest remainder (`Augments.applyMany`). Points are not stored: `pointsEarned` sums the owned `automationPoints` buyables (`automationPointsEarned`) and `pointsAvailable` asks the `Shop` (earned minus the price of the owned buyables paid in the `automationPoints` currency, the automation skills). **Unlocked is derived, not saved:** a feature is unlocked when the buyable with the effect `unlocksAutomation` for it (the first skill of its lane, `isFeatureUnlocked`) is owned, and `unlock(feature)` (the screen has no unlock button; the player clicks the skill) buys that skill through the injected `AutomationShop`. The lanes are skills with `branch` = the feature id, drawn inside each feature's box by `ui/widgets/automationWidget.ts` with the same `buildSkillLanes` / `mountSkillTree` as the Skills tab (`panelViews.automationView`). The screen reaches the unit through `GameQueries.automation()` (an `AutomationControls`). Save version 5 dropped `automation.unlocked`; version 6 deliberately wiped all earlier saves (no migration is kept).

**Critical successes.** `CriticalSuccesses.settle(runs, covered)` settles a batch with two binomial draws (runs that carry +100% from a Zero-day, Admin key or banked success, and those that do not): the whole part of the chance is that many sure successes per run, the fraction a chance of one more, a covered run has one more for sure. It returns the total number of successes and the runs that got none; the runner pays `plainRuns x reward + successes x rewardMultiplier x reward` and teaches `plainRuns + successes x xpMultiplier`. `CritFeed` (`core/crits/critFeed.ts`, advanced by the engine with every slice, never saved) remembers the last second of successes per action for the card highlight.

**Cybernetics skill effects (units).** `CriticalSuccesses.settle` ends with one more binomial draw: each success brings one extra, free success with `SleeveStats.criticalExtraChance` (`criticalExtraChance` buyables; the extras do not roll again, so `DerivedStats.maxCritsPerRun` doubles while one is owned). `DerivedStats.criticalRule` multiplies the rule's `rewardMultiplier` (not its XP) by `SleeveStats.criticalRewardFactor` (`criticalRewardMultiplier`). `LinkedPayouts` (`core/actions/linkedPayouts.ts`, injected into `ActionRunner`) draws once per batch how many whole rewards of another action a source action's runs also pay (`paysActionReward`, rules in `SleeveStats.paysActions`, read by `DerivedStats.paysActions`); `ActionRunner.completeRuns` pays them with `payAlso`, so they never crit and carry no XP, heat or drops. `DerivedStats.rewardMultiplier` also multiplies by `levelRewardFactor` (`core/actions/levelRewardFactor.ts`: `1 + coefficient x ln(1 + level / scale)` per owned `rewardMultiplierFromActionLevel`). `interfaceSpeedFromAugmentRarities` is a sleeve hook that multiplies `interfaceSkillFactor` by `1 + perRarity x distinctAugmentRarities` (`augments.ts`, passed to `resolveSleeveStats` as `augmentRaritiesHeld`).

**Item drops.** Chance cannot be rolled run by run when a batch holds millions of runs, so `ItemDrops.roll(action, n)` draws the number of drops directly from Binomial(n, chance) and splits them over the rarities with a multinomial draw (`sampling.ts`: exact up to 1000 runs, Poisson or normal approximation above). A batch of any size costs the same. The randomness is an injected `RandomSource` (`Math.random` in `createGame`, a seeded one in tests). Rules are read when the runs complete, so a rule that changes over time applies to later runs. `DerivedStats.itemDrops` hands out the rules with their weights as they stand now: a `rarityShiftFromProficiency` buyable shifts them with `shiftWeights` (`rarityShift.ts`), one step per whole order of magnitude of Hacking Proficiency. One long tick and many short ones give the same drop rate, not the same drops (it is random); `items.test.ts` checks the rate.

**Tick granularity and slicing.** Within a slice passive income and heat cooling use the nodes and heat at the start of the slice, and heat added by runs starts cooling in the next slice. Systems that feed back on themselves (interface speed rising with every run, heat cooling while the network pays) would drift if a long tick were computed in one go, so a tick longer than `engine.maxSliceMs` is cut into slices that run one after another. Result: one long tick and many short ones agree (`batching.test.ts` checks interface speed within 2% over 5 minutes and passive income under cooling within 1% over 50 minutes, and that without slicing the first would be clearly off). The cost of a tick is bounded by `engine.maxSlicesPerTick`; beyond that the slices simply get longer and the agreement degrades gracefully. Runs of actions with a start cost still complete one per batch (a share-of-balance cost has no exact closed form because of rounding), so `maxBatchesPerTick` caps them per slice.

## Configuration (from docs/CONFIG.md)

### `engine`
`maxBatchesPerTick` – safety cap on run batches per action per tick (integer >= 1, default 1000). Runs are computed in closed form: a batch is all the runs between two level changes, so a tick needs roughly one batch per level gained, however long it is. Time beyond the cap is discarded; normal play never reaches it. The cap applies per slice (see below).

`maxSliceMs` – longest stretch of game time simulated in one go, in ms (> 0, default 1000). A longer tick is cut into equal slices of at most this length, run one after another, so feedback between systems follows the same course however the time is delivered. A normal 50 ms step is one slice.

`maxSlicesPerTick` – most slices one tick is cut into (integer >= 1, default 64). Bounds the cost of a very long tick; beyond it slices get longer and the feedback effects become approximate again.

`minRunDurationMs` – shortest time one run can take, in ms (> 0, default 0.001). However fast an action gets, its run never takes less, so a speed that overflows cannot turn a duration into 0.

### `runtime`
| Field | Meaning |
|---|---|
| `stepMs` | Interval between game steps |
| `renderMs` | Shortest interval between screen refreshes (default 100). The game still steps every `stepMs`; only the drawing is limited. Drawing happens on the display's frame clock (`app/renderLoop.ts`), so refreshes land on the first frame at or after this interval (about 100–117 ms on a 60 Hz screen). It also sets the length of the bars' glide (`--render-ms`) |
| `maxDeltaMs` | Largest real-time gap simulated per step (no offline progress beyond this) |
| `autosaveMs` | Autosave interval |
| `fastForwardFactor` | Time multiplier of the test-aids bar toggle (> 1) |

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-26 (by the user, after the full review)*
- **One tab plays:** the first tab takes a Web Lock (`app/tabGuard.ts`), later tabs are told so before loading the save. The `storage`-event guard remains only as a fallback.

*Group: Decided 2026-10-26 (by the user, after the full review)*
- **The engine mutates no state itself:** `Shop.toggle` switches auto-runs and `BackChannel` turns items into Moles. The 45-method delegating facade of `GameEngine` was kept on purpose (the UI and tests depend on it); flatten it only if it starts to hurt.
