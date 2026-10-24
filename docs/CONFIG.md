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
| `unlock?` | `{kind:'nodes', amount > 0}` or `{kind:'buyable', buyableId}` | Extra condition besides the access level. `nodes`: unlocks when the network reaches `amount` and **stays unlocked** (until re-sleeving). `buyable`: unlocked while that buyable is owned |
| `startCost?` | `{currency, amount? >= 0, fractionOfBalance? 0..1}` | Paid each time a run starts (manual or auto-run): `amount` plus `fractionOfBalance` of the balance held at that moment (network nodes: rounded down to whole nodes). A share-based cost that comes to 0 cannot be paid, so with 1% of nodes you need at least 100 nodes. Without enough the run cannot start. Such actions complete **one run per batch** (no closed-form multi-run batching) |
| `completionEffects?` | list of `{kind:'removeNodesFraction', fraction 0..1}` / `{kind:'addHeat', heat >= 0}` | Applied after each completed run, in order (several runs in a batch apply them that many times) |
| `requiredAccessLevel?` | integer >= 1 | Access level needed to perform the action (default 1); until then it is locked |
| `reward` | BigNum >= 0 | Amount per completed run, in units of `rewardKind` |
| `rewardKind?` | `'credits'`, `'networkNodes'`, `'interfaceSpeed'`, `'circumvention'`, `'infamy'` or `'nodePayout'` | What `reward` is paid as (default credits). `networkNodes` adds to the network instead of the credit balance; `interfaceSpeed` adds to a multiplier on the sleeve's interface speed: speed = (base + boosts) x (1 + sum of rewards), so returns diminish (untaxed, reset by re-sleeving) |
| `xpPerRun` | BigNum >= 0 | Action XP per completed run |
| `levels?` | LevelRuleConfig | Overrides `progression.actionLevels` for this action |
| `sleeveLevels?` | LevelRuleConfig | Overrides `progression.sleeveLevels` for this action's sleeve level |
| `speedScaling?` | LevelScaling | Overrides `speed.actionLevel` for this action |

## `buyables[]` – one entry per purchase
| Field | Type | Meaning |
|---|---|---|
| `id`, `name`, `description` | string | Identity and text (shown in the hover tooltip) |
| `actionId?` | action id | The action whose card shows this purchase; for `autoRun`/`outputMultiplier` it is also the action the effect applies to. **Omit it for a purchase shown in the Sleeve widget.** Action effects (`autoRun`, `outputMultiplier`) require it; sleeve effects (`interfaceSpeed`, `accessLevel`) forbid it |
| `symbol?` | string | Short text on the square button (default: initials of `name`) |
| `cost` | BigNum >= 0 | Price of the first copy, in `currency` |
| `currency?` | `'credits'` or `'networkNodes'` | What the price is paid in (default credits). Paying in nodes removes them from the network |
| `effect` | Action effects: `{kind:'autoRun'}`, `{kind:'outputMultiplier', factor >= 1}`. Sleeve effects: `{kind:'interfaceSpeed', amount >= 0}` (adds `amount` to the interface speed per copy), `{kind:'accessLevel', level >= 1}` (raises access level to `level`). Newer: `{kind:'nodePayoutMultiplier', factor >= 1}` (what each node produces x `factor^copies`), `{kind:'circumventionMultiplier', factor >= 1}` (Circumvention x `factor^copies`), `{kind:'unlock'}` (no effect of its own; satisfies an action's `unlock: {kind:'buyable'}`). Auto-run buyables are toggleable in the UI. More: `{kind:'networkGrowth', ratePerSecond >= 0}` (nodes grow by that fraction of themselves per second; 0.000001 = 0.0001%), `{kind:'interfaceSpeedPerLnNodes', perLn >= 0}` (base interface speed x `1 + perLn * ln(nodes)`), `{kind:'levelBonusFromSleeveLevel', sourceActionId, targetActionId}` (adds the source action's sleeve level to the target's level for speed only), `{kind:'sleeveXpReduction', sourceActionId, perLevel > 0, maxReduction in [0,1)}` (every sleeve level of every action except the source needs `min(maxReduction, perLevel * source sleeve level)` less XP) | What each owned copy does. Output multipliers compound: `factor^copies` |
| `requires?` | id[] | Buyables that must be owned first; until then the buyable is hidden |
| `maxPurchases?` | integer >= 1 or `Infinity` | Copies allowed (default 1) |
| `costGrowth?` | number >= 1 | Price multiplier per copy owned: price = `cost * costGrowth^owned` (default 1) |

Current buyables (the newest additions are listed in DESIGN.md section 2.7). **Push malware** (reward: +0.001 node payout multiplier per run, +1 heat): **Circumvention boost** (250,000, `costGrowth: 100`, unlimited, x2 Circumvention), **Auto-run** (10,000,000). **Kill servers**: start cost 1% of nodes. **Sleeve**: also **Interface boost** (100, `costGrowth: 1000`, unlimited), **Node payout** (750, `costGrowth: 100000`, unlimited, x1.5), **Unlock Legend** (1e20 placeholder). **Practice Hacking**: **Auto-run** (10,000), **Duplicate processors** (150, `costGrowth: 10`, unlimited, x2 output per copy), **Skill transfer** (50,000), **Study methods** (1e15, `perLevel: 0.0001` = 0.01% per sleeve level, max 25%, not applied to the source action). **Grow Network**: **Auto-run** (100), **Parallel nodes** (10,000, `costGrowth: 1000`, unlimited, x2 output), **Self-replication** (1e10, 0.0001%/s), **Network synergy** (1e35, `perLn: 0.01`). **Sleeve**: **Node uplink** (100 nodes, `costGrowth: 100000`, unlimited, +0.1 base interface speed).

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
- `{ kind: 'linear', perLevel }` -> `1 + (level - 1) * perLevel` (perLevel 1: multiplier = level; the current game uses 0.05, i.e. +5% per level above 1)
- `{ kind: 'exponential', base }` -> `base ^ (level - 1)`

Speed = actionLevel factor x the action's own sleeveLevel factor x interface speed (`sleeve`) x `global.speedMultiplier`; run time = `baseDurationMs / speed`.

## `sleeve` – starting values of the global sleeve stats
| Field | Meaning |
|---|---|
| `baseAccessLevel` | Access level of a new sleeve (integer >= 1, default 1). Actions with a higher `requiredAccessLevel` stay locked |
| `baseInterfaceSpeed` | Interface speed of a new sleeve (> 0, default 0.1): a multiplier on the speed of every action, shown on screen as a plain number |
| `baseHeat` | Heat of a new sleeve (>= 0, default 0). Each point is 1 % tax on all credits earned. Actions add heat (`heatPerRun`); the cooldown removes it |
| `heatCooldownMs` | Length of one heat cooldown cycle (> 0, default 60000 = 60 s). The cycle only advances while heat is above 0 |
| `heatCooldownAmount` | Heat removed each time a cooldown cycle completes (> 0, default 1) |
| `baseCircumvention` | Circumvention of a new sleeve (>= 1, default 1) |
| `circumventionReductionPerOrder` | Share of heat's effect removed per order of magnitude of Circumvention (>= 0, default 0.005 = 0.5%, so 100% at 1e200) |
| `infamyHeatSlowdown` | Each Infamy point makes a heat cooldown cycle this much longer (>= 0, default 0.1 = 10%) |
| `infamyDecayPeriodMs` | Infamy falls by exactly 1 each time this many ms have passed, in whole steps like the heat cooldown (> 0, default 600000 = 10 min) |

Current sleeve buyables (placeholder prices): **Interface boost** (100 credits, +0.05 interface speed, so 0.1 becomes 0.15, one-time), **Access upgrade** (10,000 credits, access level 2).

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
