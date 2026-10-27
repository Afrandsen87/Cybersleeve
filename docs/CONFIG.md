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
| `heatPerSecond?` | number >= 0 | Heat added for every second the action is actually running (default 0; may be a fraction; idle time is not charged). Build Legend uses 5 |
| `heatPerRun?` | number >= 0 | Heat added by each completed run (default 0). Together with `heatPerSecond` and Overclock's `heatPerMinute`, the ways an action adds heat. Heat taxes only the credits network nodes produce, never a run's reward |
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
| `overclock?` | `{speedBonus?, rewardBonus?, heatPerMinute?, heatPerRunFactor?, completionEffects?, alsoPays?, stopsHeatCooling?}`, at least one | What Overclock does to this action once the `overclock` buyable is owned. **Gains** (scaled by the buyable's strength, i.e. its copies): `speedBonus > 0` (0.5 = 50% faster) and `rewardBonus > 0` (2 = 200% more, x3; scales the action's own reward per run only). **Fixed costs and extras** (not scaled): `heatPerMinute >= 0` (heat per minute of game time while the action runs overclocked, in fractions of a point), `heatPerRunFactor >= 1` (multiplies the action's `heatPerRun`), `completionEffects` (applied for every completed run, e.g. `{kind: 'removeNodes', amount: 5}`) and `alsoPays` (another action id: each completed run also pays that action's reward as if it had completed one run, with its reward multipliers; no XP, heat or drops). `stopsHeatCooling: true` holds heat in place while the action is running overclocked (the cooldown stands still, Moles are kept, Burn leads cannot be used). (A chain is not part of the rule: the `overclockChain` buyable adds it, see `buyables[]`.) An action without a rule has no Overclock switch. Real content: Grow network `{speedBonus: 0.5, heatPerMinute: 2}`, Practice Hacking `{rewardBonus: 2, completionEffects: [removeNodes 5]}`, Push malware `{alsoPays: 'grow-network', heatPerRunFactor: 3}`, Kill servers `{rewardBonus: 1, stopsHeatCooling: true}` |

## `items` – the item entity
| Field | Type | Meaning |
|---|---|---|
| `rarities[]` | `{id, name, sellValue}` | The rarity tiers, **most common first**. `sellValue` (BigNum >= 0) is what one item of the tier sells for in credits. Real content: Common 100, Uncommon 100,000, Rare 100,000,000, Legendary 100,000,000,000, Crisis level 100,000,000,000,000 (three orders of magnitude per tier) |
| `definitions[]` | `{id, name, sellable?, hasRarity?}` | The kinds of item. Every kind exists in every rarity unless `hasRarity: false`: such an item is one stack named by the item alone (the stack is kept under the first rarity), and a drop rule for it names no `rarityWeights` (the rarity of an item that has rarities needs them). Real content: `burn-lead` ("Burn lead", `sellable: false`, `hasRarity: false`), `kompromat` ("Kompromat file") and `augment-schematic` ("Augment schematic", `sellable: false`: it has no Sell buttons and cannot be sold; default `true`) |
| `augment?` | `{itemId, xpBonusPerItem > 0}` | Makes `itemId` the Augment schematic: the Augment button on every action card applies one of the rarity selected in the Inventory, adding `xpBonusPerItem` (0.03 = 3%) to the action XP boost of ITS rarity on that action, additively within a rarity; the boosts of the different rarities multiply (3 common, 3 uncommon and 3 rare give 1.03 x 1.03 x 1.03). Sleeve XP is not affected. Leave it out for a game without the button. Real content: `augment-schematic`, 0.03 |
| `zeroDay?` | `{itemId, actionId}` | Makes `itemId` the Zero-day: its Inventory tile becomes a **toggle** (it cannot be switched on with none held). While on, every completed run of `actionId` uses one up and is a critical success; the toggle switches itself off when none is left. Both ids are validated. Declare the item `sellable: false`. Leave it out for a game without the toggle. Real content: `zero-day`, Push malware |
| `adminKey?` | `{itemId, actionId, shard?: {itemId, chance in [0, 1]}}` | Makes `itemId` the Admin key: the same toggle as `zeroDay` (its own switch), for `actionId`. `shard` names an item **without rarity** that each run the key made critical drops with that `chance` (drawn once per batch). Declare both items `sellable: false`. Real content: `admin-key`, Practice Hacking, shard `skill-shard` at 0.02 |
| `skillShard?` | `{itemId, levelsDelayed >= 1 (integer)}` | Makes `itemId` the Skill shard: its Inventory tile is used by clicking it; it lands on a random unlocked action and delays that action's XP scaling by `levelsDelayed` levels (see `LevelRule.xpCostOfLevel`). Real content: `skill-shard`, 1 |
| `burnLead?` | `{itemId, heatFraction in (0, 1]}` | Makes `itemId` the Burn lead: its Inventory row gets a **Use** button that uses up one lead of that stack and removes `heatFraction` (0.05 = 5%) of the CURRENT heat. The button is disabled while there is no heat. Declare the item `sellable: false` so it cannot be paid out. Leave it out for a game without the button. Real content: `burn-lead`, 0.05 |

Ids must be unique, and items need at least one rarity. Selling pays `sellValue` per item in full: the heat tax and `global.creditMultiplier` do not touch it (they scale run rewards and passive income only).

## `buyables[]` – one entry per purchase
| Field | Type | Meaning |
|---|---|---|
| `id`, `name`, `description` | string | Identity and text (shown in the hover tooltip) |
| `formula?` | string | A formula that explains the effect, shown right under the description in the tooltip (e.g. `Growth factor percentage = Action level / 1000` for Self-replication). For effects that have numbers to fill in (today `networkGrowthFromActionLevel`) the tooltip also lists them under the formula. Rarity refinement has none: its tooltip is just its description |
| `actionId?` | action id | The action whose card shows this purchase; for `autoRun`/`rewardMultiplier` it is also the action the effect applies to. **Omit it for a purchase shown in the Sleeve widget.** Action effects (`autoRun`, `rewardMultiplier`, `itemDrop`, `rarityShiftFromProficiency`) require it; sleeve effects (`interfaceSpeed`, `accessLevel`) forbid it |
| `symbol?` | string | Short text on the square button (default: initials of `name`) |
| `cost` | BigNum >= 0 | Price of the first copy, in `currency` |
| `currency?` | `'credits'`, `'networkNodes'`, `'skillPoints'`, `'resleevePoints'` or `'automationPoints'` | What the price is paid in (default credits). Paying in nodes removes them from the network. `skillPoints` makes the buyable a **skill**: it is shown in the Skills tab (not on a card or in the Sleeve widgets), the points available are the points earned (0 until an action reaches level 1, then 1 + floor(log10(total of action levels))) minus the price of the skills owned, and nothing is spent from the state. Give a skill no `actionId` |
| `effect` | Action effects: `{kind:'autoRun'}`, `{kind:'rewardMultiplier', factor >= 1}` (multiplies the reward the action pays per run, nothing else: not its XP or counted runs). Sleeve effects: `{kind:'interfaceSpeed', amount >= 0}` (adds `amount` to the interface speed per copy), `{kind:'accessLevel', amount >= 1}` (adds `amount` to the access level per copy; copies stack on top of `sleeve.baseAccessLevel`). Newer: `{kind:'nodePayoutMultiplier', factor >= 1}` (what each node produces x `factor^copies`), `{kind:'iceRatingMultiplier', factor >= 1}` (ICE Rating x `factor^copies`). Auto-run buyables are toggleable in the UI. Kill servers: `{kind:'startCostReduction', perLevel in (0, 1)}` (action effect: the share of the balance the action's start cost takes is multiplied by `(1 - perLevel)^plain action level`; while owned a node cost that rounds down to 0 becomes 1 node) `{kind:'overclockChain', chain: {maxLinks >= 1 (integer), rewardPerLink > 0, nodesPerLink >= 0}}` (action effect: adds a chain to the action's Overclock; each consecutive completed run while overclocked adds a link, up to `maxLinks`; each link adds `rewardPerLink` to the reward bonus of the next run (a gain: scaled by the strength of Overclock, like `rewardBonus`) and `nodesPerLink` to the factor on the share of the balance the start cost takes, `1 + links x nodesPerLink` (a price, not scaled); a stopped action or a switched-off Overclock breaks it; the action needs a `startCost`, so its runs come one per batch, and an `overclock` rule: both checked) and `{kind:'creditSiphon', seconds > 0}` (action effect: at every start, `seconds` seconds of the current per-node income are paid for each node the start cost destroys). More: `{kind:'networkGrowth', ratePerSecond >= 0}` (nodes grow by that fraction of themselves per second; 0.000001 = 0.0001%), `{kind:'networkGrowthFromActionLevel', sourceActionId, percentPerLevel >= 0}` (nodes grow by `level * percentPerLevel` percent of themselves per second, `level` = the plain action level of `sourceActionId`, per copy; 0.001 = level / 1000 percent), `{kind:'interfaceSpeedPerLnNodes', perLn >= 0}` (base interface speed x `1 + perLn * ln(nodes)`), `{kind:'levelBonusFromSleeveLevel', sourceActionId, targetActionId}` (adds the source action's sleeve level to the target's level for speed only), `{kind:'interfaceSpeedMultiplier', factor >= 1}` (interface speed x `factor^copies`), `{kind:'heatCooldownSpeed', factor >= 1}` (heat cools `factor^copies` times as fast), `{kind:'hackingProficiencyMultiplier', factor >= 1}` (Hacking Proficiency counts `factor^copies` times as much: hacking multiplier, drop ratio shifts and the stat shown), `{kind:'runsPerSleeveXpReduction', perCopy >= 1, minRuns >= 1}` (whole numbers: every copy takes `perCopy` runs off the `progression.runsPerSleeveXp` runs one batch of sleeve XP needs, for every action, never below `minRuns`; real content: 1 and 10, so 90 copies reach the floor), `{kind:'iceRatingFromActionLevel', sourceActionId, perLevel > 0}` (adds `perLevel x plain action level of the source x copies` to the base ICE Rating, before the `iceRatingMultiplier` buyables multiply it; real content: Hardened payload on Push malware, price 10,000, `perLevel: 10`), `{kind:'actionXpReduction', amount in (0,1)}` (every ACTION level needs `amount x copies` less XP, capped by `progression.maxSleeveXpReduction`; sleeve levels are unaffected), `{kind:'itemDropChanceMultiplier', itemId, factor >= 1}` (the chance of a drop at all of every drop rule of that item x `factor^copies`, at most 1), `{kind:'nodePayoutFromItems', itemId, rarityId, perItem >= 0}` (node payout x `(1 + perItem x the number of that item and rarity held)`), `{kind:'backChannel', itemId, rarityId, molesPerItem > 0, cooldownBoost >= 0}` (lets the player give up that item and rarity for `molesPerItem` Moles each; while Moles remain heat cools `cooldownBoost` faster, one Mole per point of heat), `{kind:'sleeveXpReduction', sourceActionId, perLevel > 0, maxReduction in [0,1)}` (every sleeve level of every action except the source needs `min(maxReduction, perLevel * source sleeve level)` less XP). Action effect `{kind:'itemDrop', drop:{itemId, chance in [0,1], rarityWeights}}` (each completed run of the buyable's action has `chance` to drop one `itemId`; the rarity is drawn by `rarityWeights` (required for an item with rarities, forbidden for one without), a relative weight per rarity id, >= 0, at least one > 0, normalised, a missing rarity weighs 0; applies once whatever the number of copies). Action effect `{kind:'criticalBoost', factor >= 1}` (multiplies the `xpMultiplier` and `rewardMultiplier` of the action's critical successes by `factor`; once, whatever the copies; real content: Persistence, 500,000, 3). Action effect `{kind:'criticalLink', targetActionId}` (every critical run of the action banks one guaranteed critical success for the target action, spent by that action's next completed runs; once; real content: Ransomware, Push malware to Grow network). Sleeve effect `{kind:'overclockHeatFactor', targetActionId, factor >= 1}` (lowers the target action's Overclock `heatPerRunFactor` to `factor` when the rule's own factor is higher; the lowest owned wins; real content: the skill Obfuscation, Push malware, 2). Action effect `{kind:'rarityShiftFromProficiency', fractionPerOrder in (0,1]}` (for every whole order of magnitude of Hacking Proficiency, `fractionPerOrder` of each rarity's weight moves to the next rarity, all amounts worked out up front and moved at once; shifts the drop ratios of the buyable's action; real content: 0.01)  Re-sleeve tree: `{kind:'actionXpReductionFromSleeveLevel', remainingPerOrder in (0,1), maxReduction in [0,1)}` (sleeve effect: every ACTION level of an action needs `1 - remainingPerOrder^log10(sleeve level of that action)` less XP, at most `maxReduction`; multiplies with `actionXpReduction` and is outside its cap; real content: Sleeve Euphoria, 0.5 and 0.999, so 50% at level 10 and 75% at 100), `{kind:'synthSleeves'}` (gives one synthetic sleeve when bought, copied from the last finished run, and one more with every later re-sleeve) and `{kind:'placeholder'}` (does nothing; real content: Incorporation). A buyable paid in `resleevePoints` is a **re-sleeve skill**: it is kept through re-sleeving, listed in the tree on the Skills tab, and its `requires` draw the tree | What each owned copy does. Output multipliers compound: `factor^copies` |
| `requires?` | id[] | Buyables that must be owned first; until then the buyable is hidden. For a skill this is the **reveal gate**: the purchase that makes it useful (until it is owned the skill's text reads `???`) |
| `parents?` | id[] | Skill-tree edges, skills only (paid in points): the skills that must be owned before this one can be bought. A skill reads only when its `requires` are owned **and** every parent reads, so the masking runs down the tree. Every parent is in the **same `branch`** as the skill, so each parent has a line drawn to it (validated); parents form no cycle (validated together with `requires`) |
| `branch?` | string | The skill-tree branch (lane) the skill is drawn in; ids are in `content/ids.ts` (`BRANCH_*`), titles in `uiText.skills.branches`, colours in `ui/style.css` (`--branch-<id>` and a `.skill-lane[data-branch="<id>"]` rule). Skills without one share a general lane |
| `maxPurchases?` | integer >= 1 or `Infinity` | Copies allowed (default 1) |
| `costGrowth?` | number >= 1 | Price multiplier per copy owned: price = `cost * costGrowth^owned` (default 1) |

**Effect kinds of the cybernetics skills** (all sleeve-wide, so a skill has no `actionId`; one entry each in `core/effectRegistry.ts`): `{kind:'interfaceSpeedFromAugmentRarities', perRarity > 0}` (interface speed x `1 + perRarity x` the number of distinct rarities with at least one augment applied on any action; additive across rarities); `{kind:'paysActionReward', sourceActionId, targetActionId, chance in (0, 1]}` (each completed run of the source has `chance` to also pay ONE whole reward of the target: its reward, multipliers and reward kind; never critical, no XP, heat or drops; drawn once per batch by `core/linkedPayouts.ts`); `{kind:'rewardMultiplierFromActionLevel', sourceActionId, targetActionId, coefficient > 0, scale > 0}` (the target's reward x `1 + coefficient x ln(1 + level / scale)`, `level` = the plain action level of the source; concave; see `core/levelRewardFactor.ts`; real content: Backbone Parasite, `coefficient` 2.263 and `scale` 18, about x2 at level 10 and x4 at level 50); `{kind:'criticalExtraChance', chance in (0, 1]}` (every critical success has `chance` to bring one extra, free critical success that does not roll again; chances of copies add, capped at 1); `{kind:'criticalRewardMultiplier', factor >= 1}` (the reward multiplier of every critical success x `factor^copies`, its XP unchanged). Fiber Tap's `chance` (0.25) and Parallel Threads' `perLn` (0.002) are in `content/buyables/skillBranches/cybernetics.ts`.

Current buyables (the newest additions are listed in DESIGN.md section 7). **Overclock unlock** (25x the action's own Auto-run price: 250 on Grow network, and so on for Practice Hacking, Push malware and Kill servers; `OVERCLOCK_UNLOCK_COST_RATIO`), **Focus unlock** (100x the action's Auto-run price, on every action; `FOCUS_UNLOCK_COST_RATIO`; both ratios and the Auto-run prices are constants at the top of `gameConfig.ts`), **Overclock upgrade** (sleeve, 250,000 = 1000x the old unlock price, `costGrowth: 1000`, unlimited, `perCopy: 0.1`), **Focus upgrade** (sleeve, 1,000,000, `costGrowth: 100000`, `maxPurchases: 4`, `perCopy: 1`) and, on the Grow Network card, **Burn leads** (1,000 placeholder; `itemDrop` of `burn-lead`, `chance: 0.005`, no rarity weights) and, on the Push malware card, **Zero-day exploits** (5,000; `itemDrop` of `zero-day`, `chance: 0.05`, no rarity weights), **Persistence** (500,000, one time, `criticalBoost` factor 3) and **Ransomware** (100,000 placeholder, `criticalLink` to Grow network). On the Kill servers card (all prices placeholders, climbing in this order): **Cascade failure** (1e10, `costGrowth: 100`, unlimited; `rewardMultiplier` factor 2), **Credit Siphon** (1e12; `creditSiphon` `seconds: 10`), **Decommission protocol** (1e14; `startCostReduction` `perLevel: 0.01`), **Kill chain** (1e17; `requires` the Overclock unlock; `overclockChain` `{maxLinks: 20, rewardPerLink: 0.1, nodesPerLink: 0.1}`) and **Black box recorder** (1e20; `itemDrop` of `admin-key`, `chance: 0.1`, no rarity weights). **Skills** (1 skill point each, see DESIGN.md section 2.7d): Overclocked Cortex (interface speed x1.05), Bandwidth Leech (node payout x1.1), Cold Trail (heat cools 5% faster), Muscle Memory (Hacking Proficiency +5%), Quick Study (action levels need 1% less XP), Nose for Secrets (Kompromat drop chance x2), Exploit Kompromat (+1% node payout per uncommon Kompromat), Back Channel Deals (common Kompromat for 5 Moles each, 200% faster heat cooldown), Obfuscation (Push malware's Overclock makes 2x heat per run instead of 3x). **Push malware** (reward: +0.0001 credits per second added to the base value of every node per run, `rewardKind: 'nodePayout'`, +1 heat): **Auto-run** (15,000; listed first on the card, card order is the order in the file), **Malware payload** (10,000, `costGrowth: 100`, unlimited, `rewardMultiplier` x2: doubles what each run adds to the base payout of every node). **Kill servers**: start cost 1% of nodes; **Auto-run** (1e9). **Build Legend**: **Auto-run** (1e15). **Sleeve**: also **ICE Rating boost** (15,000, `costGrowth: 100`, unlimited, x2 ICE Rating; moved here from Push malware on 2026-10-25), **Interface boost** (10, `costGrowth: 1000`, unlimited), **Node payout** (25 nodes, `currency: 'networkNodes'`, `costGrowth: 10`, unlimited, x2), **Practice Hacking**: **Auto-run** (1,000), **Kompromat harvest** (500; `itemDrop` of `kompromat`, `chance: 0.05`, `rarityWeights: {common: 90, uncommon: 9, rare: 1, legendary: 0, crisis: 0}`), **Rarity refinement** (10,000, requires the harvest, `fractionPerOrder: 0.01`), **Skill transfer** (1,000,000), **Study methods** (1e15, `perLevel: 0.0001` = 0.01% per sleeve level, max 25%, not applied to the source action). **Grow Network**: **Auto-run** (10), **Parallel nodes** (75, `costGrowth: 100`, unlimited, x2 output), **Industrial Espionage** (10,000; `itemDrop` of `augment-schematic`, `chance: 0.005`, weights 90/9/1/0/0), **Self-replication** (1e10, `networkGrowthFromActionLevel` from Grow network, `percentPerLevel: 0.001` = level / 1000 % per second), **Network synergy** (1e35, `perLn: 0.01`). **Faster conditioning** (sleeve, 1,000, `costGrowth: 100`, `maxPurchases: 90`, `runsPerSleeveXpReduction` 1 run per copy down to 10). **Sleeve**: **Node uplink** (10 nodes, `costGrowth: 10`, unlimited, +0.1 base interface speed).

## `corporation` – the corporation's actions (optional)
| Field | Type | Meaning |
|---|---|---|
| `actions[]` | `{id, name, baseDurationMs, effects[]}` | The actions of the Corporation tab, in order. `id` must be unique; `baseDurationMs` (> 0) is the run time at level 0: **only the action level speeds a corporation action up** (`speed.actionLevel`, as for a character action; no interface speed, sleeve level, Focus or Overclock). `xpPerRun` (optional, > 0, default 1) is the action XP each completed run gives; the action levels follow `progression.actionLevels` (there are no sleeve levels, and a level changes nothing yet). `effects[]` are applied once for each completed run, in order |
| effect `{kind: 'upgradeRandomItem', itemId, chance}` | `itemId` an item that has rarities, `chance` in (0, 1] | Each completed run has `chance` to upgrade ONE random stack-member of the item one rarity up: the stack is drawn weighted by how many are held, the highest rarity is never upgraded, nothing held does nothing. Real content: Insider backstabbing, `kompromat`, 0.01 (placeholder) |

`baseRank` (optional integer >= 1, default 1) is the corporate rank before any `corporateRank` purchase; an action's optional `requiredRank` (integer >= 1, default 1) is the rank needed to start it. The buyable effect `{kind: 'corporateRank', amount}` (integer >= 1 per copy) adds to the rank; such a buyable is listed in the Asset Acquisition widget and kept through re-sleeving (`content/buyables/corporation.ts`).

A buyable with `corporationActionId` is shown on that corporation action's card (not in Asset Acquisition); the effect `{kind: 'addsCorporationEffect', effect}` adds a corporation effect (e.g. `{kind: 'acquireStock', chance}`, chance in (0, 1]) to every completed run of that action while owned. Such buyables are kept through re-sleeving (`content/buyables/corporation.ts`).

The tab is opened by a buyable with the effect `{kind: 'unlocksCorporation'}` (real content: the re-sleeve skill Incorporation). Leave `corporation` out for a game without a Corporation tab. A new kind of effect is one union member in `core/corporationTypes.ts` plus one entry in `core/corporationEffects.ts`.

## `criticalSuccess` – what a critical success does
Chance comes from `criticalChance` buyables (`{kind:'criticalChance', chance 0 < c <= 1}`: chance per copy owned, summed over copies, **not capped**: above 1 a run has several critical successes, each applying the rule once, sleeve-wide), `{kind:'overclockUnlock'}` and `{kind:'focusUnlock'}` (per action: unlock that action's Overclock or Focus switch, shown in the square of its card; the action needs an `overclock` rule for the first), `{kind:'overclockStrength', perCopy > 0}` (sleeve-wide: strength is `1 + perCopy x copies`, so the gains of every Overclock, `speedBonus` and `rewardBonus`, are multiplied by it) and `{kind:'focusSlots', perCopy >= 1 whole}` (sleeve-wide: `perCopy` more actions can be focused at once per copy, on top of `focus.baseSlots`; set `maxPurchases` so that the base slots plus all copies equal the number of actions, the content test checks it). The rule applies to the runs drawn as critical, once per batch of runs.

| Field | Type | Meaning |
|---|---|---|
| `xpMultiplier` | number >= 1 | Multiplies the action XP of a critical run. Sleeve XP and the run counter are not touched |
| `rewardMultiplier` | number >= 1 | Multiplies the reward the action pays for a critical run (any reward kind; the credit lever and `rewardMultiplier` buyables still apply). Heat and completion effects are not scaled |
| `completionEffects?` | list of completion effects | Extra effects applied once per critical run, after the ordinary ones. Default: none |

## `focus` – what Focus does
| Field | Type | Meaning |
|---|---|---|
| `speedBonus` | number > 0 | A focused action runs this much faster (0.25 = 25%). Real content: 0.25 |
| `baseSlots` | integer >= 1 | Actions that can be focused at once before any `focusSlots` buyable is bought. Real content: 1 |

## `resleeve`
| Field | Meaning |
|---|---|
| `pointsPerResleeve` | Re-sleeve points given for each re-sleeve (integer >= 1; real content: 1) |
| `lockoutMs` | Game time in ms after buying the Unlock resleeving buyable during which re-sleeving is refused (>= 0, optional, default 0; real content: 5000) |
| `runsShown` | How many of the latest finished sleeve-runs the Stats tab lists (integer >= 1; real content: 10) |

## `automation` – the automation features (optional)

| Field | Type | Meaning |
|---|---|---|
| `autoBurnCeiling` | number >= 0 | Where Auto Burn's heat ceiling starts: while on, Burn leads are used whenever heat is above it. The player changes it. Real content: 20 (placeholder) |

Leave the section out for a game without automation (the Automation tab then never appears). The points come from `{kind:'automationPoints', perCopy >= 1 whole}` buyables (sleeve-wide: each copy owned gives `perCopy` points, which pay for buyables with `currency: 'automationPoints'`: the skills of the automation lanes; a lane has `branch` = the feature id (`autoBurn`, `autosale`, `dispersal`), its first skill has the effect `{kind:'unlocksAutomation', feature}` and is what unlocks the feature, and the rest are `{kind:'placeholder'}` for now; real content: `content/buyables/skillBranches/automationLines.ts`, 10 skills per lane at 1 point each). Real content: **Automation core**, 1,000,000 credits, `costGrowth: 100`, unlimited, `perCopy: 1`. The features themselves (Auto Burn, Kompromat autosale, Augment dispersal) use `items.burnLead`, `items.augment` and the sellable items; there is nothing else to tune.

## `reveal` – when purchases appear (optional)

| Field | Type | Meaning |
|---|---|---|
| `buyableOrders` | number >= 0 (`Infinity` shows everything) | A purchase paid in credits or nodes shows once its next price is within this many orders of magnitude of the most of that currency held this life (`peakCredits`, `peakNetwork`; a peak below 1 counts as 1). Owned purchases, skills and the purchases in an action's square always show. Real content: 3. Leave the section out to show everything (the unit tests do) |

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
| `earnedSpeedKnee?` | Hacking Proficiency at which the curve changes shape (>= 0, default 1). Only matters together with `earnedSpeedExponentBeyond`. Real content: 1 |
| `earnedSpeedExponentBeyond?` | The shape past the knee (<= 1, same meaning as `earnedSpeedExponent`). The curve continues from the value AND the slope it has at the knee, so nothing jumps: `bonus(knee) + scale x (1 + knee)^exponent x (r^beyond - 1) / beyond` with `r = (1 + earned) / (1 + knee)`. Below `earnedSpeedExponent` it flattens the curve past the knee; leave it out for one curve all the way. Real content: 0.1 |
| `earnedSpeedExponent` | Shape of that curve (<= 1, default 0.25). The applied bonus is `scale * ((1 + earned)^exponent - 1) / exponent`: 1 = straight line, 0 = logarithm (`scale * ln(1 + earned)`), in between = diminishing returns with no ceiling. Lower is stricter |
| `baseHeat` | Heat of a new sleeve (>= 0, default 0). Actions add heat (`heatPerRun`, `heatPerSecond`); the cooldown removes it |
| `heatTaxPerPoint` | Share of the credits network nodes produce that one point of heat takes (>= 0, default 0.01 = 1%). ICE Rating lowers the effect. Node credits stop at `1 / heatTaxPerPoint` heat without ICE Rating |
| `heatCooldownMs` | Length of one heat cooldown cycle (> 0, default 60000 = 60 s). The cycle only advances while heat is above 0 |
| `heatCooldownAmount` | Heat removed each time a cooldown cycle completes (> 0, default 1). The skill Purge Protocol (`heatCooldownAmountFromSleeveLevel`) adds `perLevel` per sleeve level of its source action |
| `baseIceRating` | ICE Rating of a new sleeve (>= 1, default 1) |
| `iceRatingReductionPerOrder` | Share of heat's effect removed per order of magnitude of ICE Rating (>= 0, default 0.005 = 0.5%, so 100% at 1e200) |
| `legendHeatSpeedup` | Each Legend point makes heat cool this much faster: the cycle is divided by `1 + this x Legend` (>= 0, default 0.1 = 10%) |
| `legendDecayPeriodMs` | Legend falls by exactly 1 each time this many ms have passed, in whole steps like the heat cooldown (> 0, default 600000 = 10 min) |

Current sleeve buyables (placeholder prices): **Interface boost** (10 credits, +0.05 interface speed, so 0.1 becomes 0.15, one-time), **Access upgrade** (5 credits, `costGrowth: 1000`, unlimited, +1 access level per copy). Required access levels: Grow network 1, Practice Hacking 2, Push malware 3, Kill servers 4, Build Legend 5.

## `network`
| Field | Meaning |
|---|---|
| `creditsPerNodePerSecond` | Credits each network node produces per second of game time (>= 0, default 0.01). Multiplied by `global.creditMultiplier`. Paid every tick, also while no action runs |

## `global` – broad levers (all > 0, 1 = unchanged)
`speedMultiplier`, `creditMultiplier`, `xpMultiplier`, `costMultiplier`. `creditMultiplier` scales credits only (run rewards paid in credits and passive network income); it never changes nodes, ICE Rating, Legend or the interface-speed and node-payout bonuses. There is deliberately no lever that scales every reward kind: a lever for another kind would be its own named setting.

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
| `fastForwardFactor` | Time multiplier of the test-aids bar toggle (> 1) |

## What is deliberately not in the configuration
**Infinity** (`core/infinity.ts`, `INFINITY = 1e308`): the one number at which an amount stops growing. Every amount (credits, nodes, XP, ICE Rating, ...) is clamped to it by the overflow policy after every slice, and every multiplier derived from an amount saturates there; reaching it calls the policy's `onInfinity` listener (the hook for the future infinity prestige). It is a representational limit (it sits just under the largest double), not a progression setting. Numerical limits of the number maths, not progression: `EXACT_RUN_LIMIT` (`progression.ts`, above 1e15 runs the exact remainder toward the next sleeve XP is meaningless) and `SEQUENTIAL_RUN_LIMIT` (`completion.ts`, runs that remove nodes one by one before the closed form takes over). Display wording is not configuration either: it lives in `src/ui/uiText.ts`.

## Not configurable yet (by design, for later)
Re-sleeve requirement (`ResleevePolicy`), what resets on re-sleeve, number formatting, offline progress.
