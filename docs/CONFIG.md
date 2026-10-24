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
| More credits everywhere | `global.rewardMultiplier` |
| Levels come sooner / later | `progression.actionLevels.firstLevelXp` / `growthFactor` |
| Levels worth more / less speed | `speed.actionLevel.perLevel` (linear) or switch to `{ kind: 'exponential', base: 1.5 }` |
| Everything cheaper / dearer | `global.costMultiplier` |
| Start with credits | `progression.startingCredits` |
| One action levels differently | `actions[i].levels` / `actions[i].speedScaling` |

## `actions[]` – one entry per action
| Field | Type | Meaning |
|---|---|---|
| `id` | string | Internal id (unique) |
| `name` | string | Display name (placeholder) |
| `baseDurationMs` | number > 0 | Run time at speed x1 (interface speed 1, level 1) |
| `rewardPerNetworkNode?` | boolean | When true the reward is paid once per network node owned (`reward * nodes`) |
| `heatPerRun?` | number >= 0 | Heat added by each completed run (default 0) |
| `requiredAccessLevel?` | integer >= 1 | Access level needed to perform the action (default 1); until then it is locked |
| `reward` | BigNum >= 0 | Amount per completed run, in units of `rewardKind` |
| `rewardKind?` | `'credits'` or `'networkNodes'` | What `reward` is paid as (default credits). `networkNodes` adds to the network instead of the credit balance |
| `xpPerRun` | BigNum >= 0 | Action XP per completed run |
| `levels?` | LevelRuleConfig | Overrides `progression.actionLevels` for this action |
| `sleeveLevels?` | LevelRuleConfig | Overrides `progression.sleeveLevels` for this action's sleeve level |
| `speedScaling?` | LevelScaling | Overrides `speed.actionLevel` for this action |

## `buyables[]` – one entry per purchase
| Field | Type | Meaning |
|---|---|---|
| `id`, `name`, `description` | string | Identity and text (shown in the hover tooltip) |
| `actionId?` | action id | The action this purchase belongs to: shown inside that action's card, its effect applies to that action. **Omit it for a sleeve-wide (global) purchase**, which is shown in the Sleeve widget. Action effects (`autoRun`, `outputMultiplier`) require it; sleeve effects (`interfaceSpeed`, `accessLevel`) forbid it |
| `symbol?` | string | Short text on the square button (default: initials of `name`) |
| `cost` | BigNum >= 0 | Price of the first copy |
| `effect` | Action effects: `{kind:'autoRun'}`, `{kind:'outputMultiplier', factor >= 1}`. Sleeve effects: `{kind:'interfaceSpeed', amount >= 0}` (adds `amount` to the interface speed per copy), `{kind:'accessLevel', level >= 1}` (raises access level to `level`) | What each owned copy does. Output multipliers compound: `factor^copies` |
| `requires?` | id[] | Buyables that must be owned first; until then the buyable is hidden |
| `maxPurchases?` | integer >= 1 or `Infinity` | Copies allowed (default 1) |
| `costGrowth?` | number >= 1 | Price multiplier per copy owned: price = `cost * costGrowth^owned` (default 1) |

Current buyables (all belong to **Earn credits**): **Auto-run** (10,000), **Dual processors** (15, x2 output), **Duplicate processors** (150 = 10x Dual, requires Dual, `costGrowth: 10`, unlimited, x2 output per copy).

## `progression`
| Field | Meaning |
|---|---|
| `runsPerSleeveXp` | Completed runs of ONE action per batch of that action's sleeve XP (integer >= 1) |
| `sleeveXpPerGrant` | Sleeve XP per batch |
| `actionLevels` | Default level rule for actions (`firstLevelXp`, `growthFactor`) |
| `sleeveLevels` | Default level rule for every action's own sleeve level (an action may override it) |
| `startingCredits` | Credits at the start and after re-sleeve |

**Level rule** (`LevelRuleConfig`): level 1 below `firstLevelXp`; level 2 at `firstLevelXp`; each further level needs `growthFactor` times more. Threshold of level n+1 = `firstLevelXp * growthFactor^(n-1)`. Defaults 10 and 10 give 10, 100, 1000, ...

## `speed`
`actionLevel` and `sleeveLevel` are `LevelScaling`:
- `{ kind: 'linear', perLevel }` -> `1 + (level - 1) * perLevel` (perLevel 1: multiplier = level)
- `{ kind: 'exponential', base }` -> `base ^ (level - 1)`

Speed = actionLevel factor x the action's own sleeveLevel factor x interface speed (`sleeve`) x `global.speedMultiplier`; run time = `baseDurationMs / speed`.

## `sleeve` – starting values of the global sleeve stats
| Field | Meaning |
|---|---|
| `baseAccessLevel` | Access level of a new sleeve (integer >= 1, default 1). Actions with a higher `requiredAccessLevel` stay locked |
| `baseInterfaceSpeed` | Interface speed of a new sleeve (> 0, default 0.1): a multiplier on the speed of every action, **shown on screen as a percentage** (0.1 = 10 %) |
| `baseHeat` | Heat of a new sleeve (>= 0, default 0). Each point is 1 % tax on all credits earned. Actions add heat (`heatPerRun`); the cooldown removes it |
| `heatCooldownMs` | Length of one heat cooldown cycle (> 0, default 60000 = 60 s). The cycle only advances while heat is above 0 |
| `heatCooldownAmount` | Heat removed each time a cooldown cycle completes (> 0, default 1) |

Current sleeve buyables (placeholder prices): **Interface boost** (100 credits, +0.05 interface speed, so 10 % becomes 15 %, one-time), **Access upgrade** (1000 credits, access level 2).

## `network`
| Field | Meaning |
|---|---|
| `creditsPerNodePerSecond` | Credits each network node produces per second of game time (>= 0, default 0.05). Multiplied by `global.rewardMultiplier`. Paid every tick, also while no action runs |

## `global` – broad levers (all > 0, 1 = unchanged)
`speedMultiplier`, `rewardMultiplier`, `xpMultiplier`, `costMultiplier`.

## `engine`
`maxBatchesPerTick` – safety cap on run batches per action per tick (integer >= 1, default 1000). Runs are computed in closed form: a batch is all the runs between two level changes, so a tick needs roughly one batch per level gained, however long it is. Time beyond the cap is discarded; normal play never reaches it.

## `runtime`
| Field | Meaning |
|---|---|
| `stepMs` | Interval between game steps |
| `maxDeltaMs` | Largest real-time gap simulated per step (no offline progress beyond this) |
| `autosaveMs` | Autosave interval |
| `fastForwardFactor` | Time multiplier of the corner test toggle (> 1) |

## Not configurable yet (by design, for later)
Re-sleeve requirement (`ResleevePolicy`), what resets on re-sleeve, number formatting, offline progress.
