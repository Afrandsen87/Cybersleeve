# Cybersleeve – Configuration Reference

All progression numbers live in **`src/content/gameConfig.ts`** (type `GameConfig`, defined in `src/core/types.ts`). Change a value there and the whole game follows; no code changes needed. `createGame` validates the configuration (`validateConfig`) and refuses to start with a list of problems if a value is invalid.

For experiments (tests, tuning sessions) derive a variant instead of editing the file:

```ts
import { createConfig } from './core';
import { gameConfig } from './content/gameConfig';
const fast = createConfig(gameConfig, { global: { speedMultiplier: 10 } });
const engine = createGame({ config: fast });
```

Unit tests use their own fixed `src/testing/testConfig.ts`, so retuning the game does not break them.

## Quick recipes

| Goal | Change |
|---|---|
| Whole game 2x faster | `global.speedMultiplier: 2` |
| More credits (run rewards and passive income; nothing else) | `global.creditMultiplier` |
| Levels come sooner / later | `progression.actionLevels.firstLevelXp` / `growthFactor` (10 / 1.2) |
| Levels worth more / less speed | `speed.actionLevel.perLevel` (0.01, +1% per level; linear) or switch to `{ kind: 'exponential', base: 1.5 }` |
| Everything cheaper / dearer | `global.costMultiplier` |
| Start with credits | `progression.startingCredits` |
| Re-sleeve sleeve-level gate | `resleeve.progressNeeded`: optional `{ sleeveLevels: 5, perResleeve: 1 }`; required total = sleeveLevels + earlier re-sleeves * perResleeve; integer base >= 1, step >= 0; omit for no gate |
| One action levels differently | `actions[i].levels` / `actions[i].speedScaling` |

## `actions[]` – one entry per action

*Moved to [contexts/actions.md](contexts/actions.md).*

## `items` – the item entity

*Moved to [contexts/items.md](contexts/items.md).*

## `buyables[]` – one entry per purchase

*Moved to [contexts/effects.md](contexts/effects.md).*

- Effective action level is the real level plus all owned level bonuses. `levelBonusFromSleeveLevel` and `levelBonusFromSleeveSkills {targetActionId}` affect all derived calculations, leaving XP/progression unchanged. The latter validates its target and receives the distinct skill count from its caller.
- Networked Sleeve (`buyables/practiceHacking.ts`): Network Exploitation group, 10,000 networkNodes, requiresSleeveSkills 2, maxPurchases 1; targets Practice Hacking.
- Network Safety Protocols (`buyables/practiceHacking.ts`, Network Exploitation group, sleeve-wide): 3,500 networkNodes, costGrowth 50, maxPurchases Infinity, requiresSleeveSkills 1 and Grow network Overclock; `runIceChance {targetActionId: Grow network, chance:0.05, perCopy:0.01}`. Chance = min(1, chance + perCopy × (copies − 1)); finite chance in [0,1], finite perCopy >= 0. Each success earns 1 base ICE.
- Cloaking Protocols (`buyables/sleeve.ts`): 5e11 credits, maxPurchases 1, requiresSleeveSkills 1 and Grow network Overclock; `heatReductionPerSleeveSkill {perSkill:0.03}`. Finite perSkill in [0,1); heatTaxScale = (1 − perSkill)^distinctSkills. Ownership survives re-sleeve through its carried effect trait; currency carry rules are unchanged.

## `corporation` – the corporation's actions (optional)

*Moved to [contexts/corporation.md](contexts/corporation.md).*

## `criticalSuccess` – what a critical success does

*Moved to [contexts/crits.md](contexts/crits.md).*

## Newer sleeve skill effects

*Moved to [contexts/resleeve.md](contexts/resleeve.md).*

## `focus` – what Focus does

*Moved to [contexts/actions.md](contexts/actions.md).*

## `resleeve`

*Moved to [contexts/resleeve.md](contexts/resleeve.md).*

## `automation` – the automation features (optional)

*Moved to [contexts/automation.md](contexts/automation.md).*

Automation rarity skills live in content/buyables/skillBranches/autosaleLane.ts. Slots 1 to 3 sell common/uncommon/rare; 4 to 6 automate Back Channel common/uncommon/rare; 7 to 8 sell legendary/crisis. Every node costs one automation point, and 9/10 are removed. Effects allowsAutosale and allowsAutoBackchannel name a configured rarity id; unlocksAutomation optionally names allowsAutosale for the common root. Dispersal skills live in dispersalLane.ts: slots 1, 2, 4, 5, 7 and 9 each add one selected action; slots 1, 3, 6 and 8 allow common, uncommon, rare and legendary respectively. Slot 10 is removed. dispersalSlots {count} requires an integer count >= 1; allowsDispersal {rarity} requires a configured rarity. The unlocksAutomation root also carries dispersalSlots and allowsDispersal. No new timing, odds or payout constants.

## `reveal` – when purchases appear (optional)

*Moved to [contexts/economy.md](contexts/economy.md).*

## `progression`

*Moved to [contexts/actions.md](contexts/actions.md).*

## `speed`

*Moved to [contexts/actions.md](contexts/actions.md).*

## `sleeve` – starting values of the global sleeve stats

*Moved to [contexts/sleeve.md](contexts/sleeve.md).*

## `network`

*Moved to [contexts/economy.md](contexts/economy.md).*

## `global` – broad levers (all > 0, 1 = unchanged)

*Moved to [contexts/kernel.md](contexts/kernel.md).*

## `engine`

*Moved to [contexts/engine.md](contexts/engine.md).*

## `runtime`

*Moved to [contexts/engine.md](contexts/engine.md).*

## What is deliberately not in the configuration
**Infinity** (`core/kernel/infinity.ts`, `INFINITY = 1e308`): the one number at which an amount stops growing. Every amount (credits, nodes, XP, ICE Rating, ...) is clamped to it by the overflow policy after every slice, and every multiplier derived from an amount saturates there; reaching it calls the policy's `onInfinity` listener (the hook for the future infinity prestige). It is a representational limit (it sits just under the largest double), not a progression setting. Numerical limits of the number maths, not progression: `EXACT_RUN_LIMIT` (`progression.ts`, above 1e15 runs the exact remainder toward the next sleeve XP is meaningless) and `SEQUENTIAL_RUN_LIMIT` (`completion.ts`, runs that remove nodes one by one before the closed form takes over). Display wording is not configuration either: it lives in `src/ui/uiText.ts`.

## Not configurable yet (by design, for later)
Re-sleeve requirement (`ResleevePolicy`), what resets on re-sleeve, number formatting, offline progress.


Upgrades presentation adds no tuning: rows derive from buyable currency and base price; bought-first order, MAX and badges read existing ownership and maxed views.
