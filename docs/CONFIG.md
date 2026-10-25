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
| Field | Type | Meaning |
|---|---|---|
| `id` | string | Internal id (unique) |
| `name` | string | Display name (placeholder) |
| `baseDurationMs` | number > 0 | Run time at speed x1 (interface speed 1, level 0) |
| `rewardPerNetworkNode?` | boolean | When true the reward is paid once per network node owned (`reward * nodes`) |
| `heatPerRun?` | number >= 0 | Heat added by each completed run (default 0). The only way an action adds heat. Heat taxes only the credits network nodes produce, never a run's reward |
| `unlock?` | `{kind:'nodes', amount > 0}` or `{kind:'buyable', buyableId}` | Extra condition besides the access level. `nodes`: unlocks when the network reaches `amount` and **stays unlocked** (until re-sleeving). `buyable`: unlocked while that buyable is owned |
| `startCost?` | `{currency, amount? >= 0, fractionOfBalance? 0..1}` | Paid each time a run starts (manual or auto-run): `amount` plus `fractionOfBalance` of the balance held at that moment (network nodes: rounded down to whole nodes). A share-based cost that comes to 0 cannot be paid, so with 1% of nodes you need at least 100 nodes. Without enough the run cannot start. Such actions complete **one run per batch** (no closed-form multi-run batching) |
| `completionEffects?` | list of `{kind:'removeNodesFraction', fraction 0..1}` | Applied after each completed run, in order (several runs in a batch apply them that many times) |
| `requiredAccessLevel?` | integer >= 1 | Access level needed to perform the action (default 1); until then it is locked |
| `reward` | BigNum >= 0 | Amount per completed run, in units of `rewardKind` |
| `rewardKind?` | `'credits'`, `'networkNodes'`, `'hackingProficiency'`, `'iceRating'`, `'infamy'` or `'nodePayout'` | What `reward` is paid as (default credits). `networkNodes` adds to the network instead of the credit balance; `hackingProficiency` adds to Hacking Proficiency (untaxed, reset by re-sleeving); the Hacking Multiplier on interface speed is `1 + sleeve.earnedSpeedScale x ((1 + proficiency)^sleeve.earnedSpeedExponent - 1) / exponent`, so returns diminish |
| `xpPerRun` | BigNum >= 0 | Action XP per completed run |
| `levels?` | LevelRuleConfig | Overrides `progression.actionLevels` for this action |
| `sleeveLevels?` | LevelRuleConfig | Overrides `progression.sleeveLevels` for this action's sleeve level |
| `speedScaling?` | LevelScaling | Overrides `speed.actionLevel` for this action |

## `items` – the item entity
| Field | Type | Meaning |
|---|---|---|
| `rarities[]` | `{id, name, sellValue}` | The rarity tiers, **most common first**. `sellValue` (BigNum >= 0) is what one item of the tier sells for in credits. Real content: Common 10, Uncommon 100, Rare 1,000, Legendary 10,000, Crisis level 100,000 (an order of magnitude per tier) |
| `definitions[]` | `{id, name, sellable?}` | The kinds of item. Every kind exists in every rarity. Real content: `kompromat` ("Kompromat file") and `augment-schematic` ("Augment schematic", `sellable: false`: it has no Sell buttons and cannot be sold; default `true`) |
| `augment?` | `{itemId, xpBonusPerItem > 0}` | Makes `itemId` the Augment schematic: the Augment button on every action card applies one (the most common rarity held is used up), adding `xpBonusPerItem` (0.01 = 1%) to the action XP boost of ITS rarity on that action, additively within a rarity; the boosts of the different rarities multiply (3 common, 3 uncommon and 3 rare give 1.03 x 1.03 x 1.03). Sleeve XP is not affected. Leave it out for a game without the button. Real content: `augment-schematic`, 0.01 |

Ids must be unique, and items need at least one rarity. Selling pays `sellValue` per item in full: the heat tax and `global.creditMultiplier` do not touch it (they scale run rewards and passive income only).

## `buyables[]` – one entry per purchase
| Field | Type | Meaning |
|---|---|---|
| `id`, `name`, `description` | string | Identity and text (shown in the hover tooltip) |
| `formula?` | string | A formula that explains the effect, shown right under the description in the tooltip (e.g. `Growth factor percentage = Action level / 1000` for Self-replication). For effects that have numbers to fill in (today `networkGrowthFromActionLevel`) the tooltip also lists them under the formula |
| `actionId?` | action id | The action whose card shows this purchase; for `autoRun`/`rewardMultiplier` it is also the action the effect applies to. **Omit it for a purchase shown in the Sleeve widget.** Action effects (`autoRun`, `rewardMultiplier`, `itemDrop`, `rarityShiftFromProficiency`) require it; sleeve effects (`interfaceSpeed`, `accessLevel`) forbid it |
| `symbol?` | string | Short text on the square button (default: initials of `name`) |
| `cost` | BigNum >= 0 | Price of the first copy, in `currency` |
| `currency?` | `'credits'`, `'networkNodes'` or `'skillPoints'` | What the price is paid in (default credits). Paying in nodes removes them from the network. `skillPoints` makes the buyable a **skill**: it is shown in the Skills tab (not on a card or in the Sleeve widgets), the points available are the points earned (0 until an action reaches level 1, then 1 + floor(log10(total of action levels))) minus the price of the skills owned, and nothing is spent from the state. Give a skill no `actionId` |
| `effect` | Action effects: `{kind:'autoRun'}`, `{kind:'rewardMultiplier', factor >= 1}` (multiplies the reward the action pays per run, nothing else: not its XP or counted runs). Sleeve effects: `{kind:'interfaceSpeed', amount >= 0}` (adds `amount` to the interface speed per copy), `{kind:'accessLevel', amount >= 1}` (adds `amount` to the access level per copy; copies stack on top of `sleeve.baseAccessLevel`). Newer: `{kind:'nodePayoutMultiplier', factor >= 1}` (what each node produces x `factor^copies`), `{kind:'iceRatingMultiplier', factor >= 1}` (ICE Rating x `factor^copies`), `{kind:'unlock'}` (no effect of its own; satisfies an action's `unlock: {kind:'buyable'}`). Auto-run buyables are toggleable in the UI. More: `{kind:'networkGrowth', ratePerSecond >= 0}` (nodes grow by that fraction of themselves per second; 0.000001 = 0.0001%), `{kind:'networkGrowthFromActionLevel', sourceActionId, percentPerLevel >= 0}` (nodes grow by `level * percentPerLevel` percent of themselves per second, `level` = the plain action level of `sourceActionId`, per copy; 0.001 = level / 1000 percent), `{kind:'interfaceSpeedPerLnNodes', perLn >= 0}` (base interface speed x `1 + perLn * ln(nodes)`), `{kind:'levelBonusFromSleeveLevel', sourceActionId, targetActionId}` (adds the source action's sleeve level to the target's level for speed only), `{kind:'interfaceSpeedMultiplier', factor >= 1}` (interface speed x `factor^copies`), `{kind:'heatCooldownSpeed', factor >= 1}` (heat cools `factor^copies` times as fast), `{kind:'hackingProficiencyMultiplier', factor >= 1}` (Hacking Proficiency counts `factor^copies` times as much: hacking multiplier, drop ratio shifts and the stat shown), `{kind:'actionXpReduction', amount in (0,1)}` (every ACTION level needs `amount x copies` less XP, capped by `progression.maxSleeveXpReduction`; sleeve levels are unaffected), `{kind:'itemDropChanceMultiplier', itemId, factor >= 1}` (the chance of a drop at all of every drop rule of that item x `factor^copies`, at most 1), `{kind:'nodePayoutFromItems', itemId, rarityId, perItem >= 0}` (node payout x `(1 + perItem x the number of that item and rarity held)`), `{kind:'backChannel', itemId, rarityId, molesPerItem > 0, cooldownBoost >= 0}` (lets the player give up that item and rarity for `molesPerItem` Moles each; while Moles remain heat cools `cooldownBoost` faster, one Mole per point of heat), `{kind:'sleeveXpReduction', sourceActionId, perLevel > 0, maxReduction in [0,1)}` (every sleeve level of every action except the source needs `min(maxReduction, perLevel * source sleeve level)` less XP). Action effect `{kind:'itemDrop', drop:{itemId, chance in [0,1], rarityWeights}}` (each completed run of the buyable's action has `chance` to drop one `itemId`; the rarity is drawn by `rarityWeights`, a relative weight per rarity id, >= 0, at least one > 0, normalised, a missing rarity weighs 0; applies once whatever the number of copies). Action effect `{kind:'rarityShiftFromProficiency', fractionPerOrder in (0,1]}` (for every whole order of magnitude of Hacking Proficiency, `fractionPerOrder` of each rarity's weight moves to the next rarity, all amounts worked out up front and moved at once; shifts the drop ratios of the buyable's action; real content: 0.01) | What each owned copy does. Output multipliers compound: `factor^copies` |
| `requires?` | id[] | Buyables that must be owned first; until then the buyable is hidden |
| `maxPurchases?` | integer >= 1 or `Infinity` | Copies allowed (default 1) |
| `costGrowth?` | number >= 1 | Price multiplier per copy owned: price = `cost * costGrowth^owned` (default 1) |

Current buyables (the newest additions are listed in DESIGN.md section 2.7). **Skills** (1 skill point each, see DESIGN.md section 2.7d): Overclocked Cortex (interface speed x1.05), Bandwidth Leech (node payout x1.1), Cold Trail (heat cools 5% faster), Muscle Memory (Hacking Proficiency +5%), Quick Study (action levels need 1% less XP), Nose for Secrets (Kompromat drop chance x2), Exploit Kompromat (+1% node payout per uncommon Kompromat), Back Channel Deals (common Kompromat for 5 Moles each, 200% faster heat cooldown). **Push malware** (reward: +0.000001 credits per second added to the base value of every node per run, `rewardKind: 'nodePayout'`, +1 heat): **Auto-run** (10,000,000; listed first on the card, card order is the order in the file), **Malware payload** (50,000, `costGrowth: 10000`, unlimited, `rewardMultiplier` x2: doubles what each run adds to the base payout of every node). **Kill servers**: start cost 1% of nodes; **Auto-run** (1e9). **Build Legend**: **Auto-run** (1e15). **Sleeve**: also **ICE Rating boost** (250,000, `costGrowth: 100`, unlimited, x2 ICE Rating; moved here from Push malware on 2026-10-25), **Interface boost** (100, `costGrowth: 1000`, unlimited), **Node payout** (25 nodes, `currency: 'networkNodes'`, `costGrowth: 100`, unlimited, x1.5), **Practice Hacking**: **Auto-run** (1,000), **Kompromat harvest** (500; `itemDrop` of `kompromat`, `chance: 0.05`, `rarityWeights: {common: 90, uncommon: 9, rare: 1, legendary: 0, crisis: 0}`), **Rarity refinement** (150,000, requires the harvest, `fractionPerOrder: 0.01`), **Skill transfer** (1,000,000), **Study methods** (1e15, `perLevel: 0.0001` = 0.01% per sleeve level, max 25%, not applied to the source action). **Grow Network**: **Auto-run** (100), **Parallel nodes** (500, `costGrowth: 1000`, unlimited, x2 output), **Industrial Espionage** (10,000; `itemDrop` of `augment-schematic`, `chance: 0.05`, weights 90/9/1/0/0), **Self-replication** (1e10, `networkGrowthFromActionLevel` from Grow network, `percentPerLevel: 0.001` = level / 1000 % per second), **Network synergy** (1e35, `perLn: 0.01`). **Sleeve**: **Node uplink** (100 nodes, `costGrowth: 100000`, unlimited, +0.1 base interface speed).

## `progression`
| Field | Meaning |
|---|---|
| `runsPerSleeveXp` | Completed runs of ONE action per batch of that action's sleeve XP (integer >= 1) |
| `sleeveXpPerGrant` | Sleeve XP per batch |
| `actionLevels` | Default level rule for actions (`firstLevelXp`, `growthFactor`) |
| `sleeveLevels` | Default level rule for every action's own sleeve level (an action may override it) |
| `startingCredits` | Credits at the start and after re-sleeve |
| `maxSleeveXpReduction` | The most that all sleeve-XP reduction buyables together can cut a sleeve level's XP requirement (fraction in [0, 1), default 0.99) |

**Level rule** (`LevelRuleConfig`): every level costs its own full amount of XP, and the XP inside a level starts again at each level-up. Levels start at 0. Going from level 0 to 1 costs `firstLevelXp`; each further level costs `growthFactor` times the one before: leaving level n costs `firstLevelXp * growthFactor^n`. Defaults 10 and 10: 10, then 100, then 1000 more, ... so level 1 is reached at 10 XP in total, level 2 at 110, level 3 at 1110.

## `speed`
`actionLevel` and `sleeveLevel` are `LevelScaling`:
- `{ kind: 'linear', perLevel }` -> `1 + level * perLevel` (levels start at 0, so level 0 is worth exactly 1; the current game uses 0.05, i.e. +5% per level)
- `{ kind: 'exponential', base }` -> `base ^ level`

Speed = actionLevel factor x the action's own sleeveLevel factor x interface speed (`sleeve`) x `global.speedMultiplier`; run time = `baseDurationMs / speed`.

## `sleeve` – starting values of the global sleeve stats
| Field | Meaning |
|---|---|
| `baseAccessLevel` | Access level of a new sleeve (integer >= 1, default 1). Actions with a higher `requiredAccessLevel` stay locked |
| `baseInterfaceSpeed` | Interface speed of a new sleeve (> 0, default 0.1): a multiplier on the speed of every action, shown on screen as a plain number |
| `earnedSpeedScale` | Slope at 0 of the curve applied to the interface speed earned by actions (> 0, default 1: the first runs count in full) |
| `earnedSpeedExponent` | Shape of that curve (<= 1, default 0.25). The applied bonus is `scale * ((1 + earned)^exponent - 1) / exponent`: 1 = straight line, 0 = logarithm (`scale * ln(1 + earned)`), in between = diminishing returns with no ceiling. Lower is stricter |
| `baseHeat` | Heat of a new sleeve (>= 0, default 0). Actions add heat (`heatPerRun`); the cooldown removes it |
| `heatTaxPerPoint` | Share of the credits network nodes produce that one point of heat takes (>= 0, default 0.01 = 1%). ICE Rating lowers the effect. Node credits stop at `1 / heatTaxPerPoint` heat without ICE Rating |
| `heatCooldownMs` | Length of one heat cooldown cycle (> 0, default 60000 = 60 s). The cycle only advances while heat is above 0 |
| `heatCooldownAmount` | Heat removed each time a cooldown cycle completes (> 0, default 1) |
| `baseIceRating` | ICE Rating of a new sleeve (>= 1, default 1) |
| `iceRatingReductionPerOrder` | Share of heat's effect removed per order of magnitude of ICE Rating (>= 0, default 0.005 = 0.5%, so 100% at 1e200) |
| `infamyHeatSlowdown` | Each Infamy point makes a heat cooldown cycle this much longer (>= 0, default 0.1 = 10%) |
| `infamyDecayPeriodMs` | Infamy falls by exactly 1 each time this many ms have passed, in whole steps like the heat cooldown (> 0, default 600000 = 10 min) |

Current sleeve buyables (placeholder prices): **Interface boost** (100 credits, +0.05 interface speed, so 0.1 becomes 0.15, one-time), **Access upgrade** (5 credits, `costGrowth: 1000`, unlimited, +1 access level per copy). Required access levels: Grow network 1, Practice Hacking 2, Push malware 3, Kill servers 4, Build Legend 5.

## `network`
| Field | Meaning |
|---|---|
| `creditsPerNodePerSecond` | Credits each network node produces per second of game time (>= 0, default 0.01). Multiplied by `global.creditMultiplier`. Paid every tick, also while no action runs |

## `global` – broad levers (all > 0, 1 = unchanged)
`speedMultiplier`, `creditMultiplier`, `xpMultiplier`, `costMultiplier`. `creditMultiplier` scales credits only (run rewards paid in credits and passive network income); it never changes nodes, ICE Rating, Infamy or the interface-speed and node-payout bonuses. There is deliberately no lever that scales every reward kind: a lever for another kind would be its own named setting.

## `engine`
`maxBatchesPerTick` – safety cap on run batches per action per tick (integer >= 1, default 1000). Runs are computed in closed form: a batch is all the runs between two level changes, so a tick needs roughly one batch per level gained, however long it is. Time beyond the cap is discarded; normal play never reaches it. The cap applies per slice (see below).

`maxSliceMs` – longest stretch of game time simulated in one go, in ms (> 0, default 1000). A longer tick is cut into equal slices of at most this length, run one after another, so feedback between systems follows the same course however the time is delivered. A normal 50 ms step is one slice.

`maxSlicesPerTick` – most slices one tick is cut into (integer >= 1, default 64). Bounds the cost of a very long tick; beyond it slices get longer and the feedback effects become approximate again.

`minRunDurationMs` – shortest time one run can take, in ms (> 0, default 0.001). However fast an action gets, its run never takes less, so a speed that overflows cannot turn a duration into 0.

## `runtime`
| Field | Meaning |
|---|---|
| `stepMs` | Interval between game steps |
| `renderMs` | Shortest interval between screen refreshes (default 100). The game still steps every `stepMs`; only the drawing is limited. Drawing happens on the display's frame clock (`app/renderLoop.ts`), so refreshes land on the first frame at or after this interval (about 100–117 ms on a 60 Hz screen). It also sets the length of the bars' glide (`--render-ms`) |
| `maxDeltaMs` | Largest real-time gap simulated per step (no offline progress beyond this) |
| `autosaveMs` | Autosave interval |
| `fastForwardFactor` | Time multiplier of the corner test toggle (> 1) |

## What is deliberately not in the configuration
Numerical limits of the number maths, not progression: `EXACT_RUN_LIMIT` (`progression.ts`, above 1e15 runs the exact remainder toward the next sleeve XP is meaningless) and `SEQUENTIAL_RUN_LIMIT` (`completion.ts`, runs that remove nodes one by one before the closed form takes over). Display wording is not configuration either: it lives in `src/ui/uiText.ts`.

## Not configurable yet (by design, for later)
Re-sleeve requirement (`ResleevePolicy`), what resets on re-sleeve, number formatting, offline progress.
