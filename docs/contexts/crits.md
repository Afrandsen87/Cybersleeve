# Context: crits

Critical successes, Zero-days, Admin keys, links.

Code: `src/core/crits/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Interface, state and config (S4)

- **`criticalCover.ts` (P1):** `criticalCover(state, items, actionId)` answers "can a Zero-day, an Admin key or a banked success make this action's next run critical?". `DerivedStats.criticalPossible` and `maxCritsPerRun` both ask it. The claim order when runs complete is unchanged and lives in `ActionRunner.runBatch` (`settleCrits`): banked success, then Zero-day, then Admin key (each covers distinct runs).
- **`CriticalSuccesses.maxPerRun(chance, extraChance, covered)` (P2):** the largest number of critical successes one run can have, next to `settle`, which draws with the same rules (whole part of the chance, one more for a fraction, one more for cover, doubled with an extra chance). A test checks seeded `settle` draws never exceed it.
- **Decided 2026-10-29:** critical chance has no cap; only `criticalExtraChance` is capped at 1.
- **State:** `zeroDaysOn`, `adminKeysOn`, `bankedCriticals` (unchanged). **Config:** `criticalSuccess`, `items.zeroDay`, `items.adminKey`, the `critical*` effect kinds (below).

## Configuration (from docs/CONFIG.md)

### `criticalSuccess` – what a critical success does
Chance comes from `criticalChance` buyables (`{kind:'criticalChance', chance 0 < c <= 1}`: chance per copy owned, summed over copies, **not capped**: above 1 a run has several critical successes, each applying the rule once, sleeve-wide), `{kind:'overclockUnlock'}` and `{kind:'focusUnlock'}` (per action: unlock that action's Overclock or Focus switch, shown in the square of its card; the action needs an `overclock` rule for the first), `{kind:'overclockStrength', perCopy > 0}` (sleeve-wide: strength is `1 + perCopy x copies`, so the gains of every Overclock, `speedBonus` and `rewardBonus`, are multiplied by it) and `{kind:'focusSlots', perCopy >= 1 whole}` (sleeve-wide: `perCopy` more actions can be focused at once per copy, on top of `focus.baseSlots`; set `maxPurchases` so that the base slots plus all copies equal the number of actions, the content test checks it). The rule applies to the runs drawn as critical, once per batch of runs.

| Field | Type | Meaning |
|---|---|---|
| `xpMultiplier` | number >= 1 | Multiplies the action XP of a critical run. Sleeve XP and the run counter are not touched |
| `rewardMultiplier` | number >= 1 | Multiplies the reward the action pays for a critical run (any reward kind; the credit lever and `rewardMultiplier` buyables still apply). Heat and completion effects are not scaled |
| `completionEffects?` | list of completion effects | Extra effects applied once per critical run, after the ordinary ones. Default: none |

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-25 (by the user, critical success)*
- **Critical success** is a sleeve buyable (50 credits, x1000 per copy): +5% chance per copy that any completed run is critical. A critical run pays 3x its reward and gives 2x action XP, and nothing else changes. The chance is drawn once per batch of runs (`core/crits/critical.ts`, injected `RandomSource`). The multipliers are data (`GameConfig.criticalSuccess`), and an action can replace single fields of the rule or add completion effects for its critical runs (`ActionDefinition.criticalSuccess`), so a critical success can later do something unique per action. No action does yet.

*Group: Decided 2026-10-26 (by the user, Kill servers buyables): Kill servers gets five buyables and an Overclock. Prices (placeholders) climb in this order, each a few orders of magnitude above the one before: Cascade failure 1e10, Credit Siphon 1e12, Decommission protocol 1e14, Kill chain 1e17, Black box recorder 1e20. The Credit Siphon icon is the stylised credits chip with speed stripes behind it.*
- **Black box recorder** makes Kill servers runs drop **Admin keys**: a toggle in the Inventory like the Zero-day (own switch `adminKeysOn`; the `ZeroDays` unit is instantiated per item): each completed Practice Hacking run uses one and is a critical success. Each run an Admin key made critical (and no other critical) has a small chance (2%, placeholder) to drop a **Skill shard** (no rarity, not sold). Clicking a Skill shard lands it on a random unlocked action and **delays its action XP scaling by 1 level** (`LevelRule` `delay`: the first level cost repeats once more); action levels only; resets by re-sleeving (assumption).
