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
| Levels come sooner / later | `progression.actionLevels.firstLevelXp` / `growthFactor` |
| Levels worth more / less speed | `speed.actionLevel.perLevel` (linear) or switch to `{ kind: 'exponential', base: 1.5 }` |
| Everything cheaper / dearer | `global.costMultiplier` |
| Start with credits | `progression.startingCredits` |
| One action levels differently | `actions[i].levels` / `actions[i].speedScaling` |

## `actions[]` – one entry per action

*Moved to [contexts/actions.md](contexts/actions.md).*

## `items` – the item entity

*Moved to [contexts/items.md](contexts/items.md).*

## `buyables[]` – one entry per purchase

*Moved to [contexts/effects.md](contexts/effects.md).*

## `corporation` – the corporation's actions (optional)

*Moved to [contexts/corporation.md](contexts/corporation.md).*

## `criticalSuccess` – what a critical success does

*Moved to [contexts/crits.md](contexts/crits.md).*

## Newer re-sleeve skill effects

*Moved to [contexts/resleeve.md](contexts/resleeve.md).*

## `focus` – what Focus does

*Moved to [contexts/actions.md](contexts/actions.md).*

## `resleeve`

*Moved to [contexts/resleeve.md](contexts/resleeve.md).*

## `automation` – the automation features (optional)

*Moved to [contexts/automation.md](contexts/automation.md).*

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
