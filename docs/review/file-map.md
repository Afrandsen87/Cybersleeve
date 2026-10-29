# File map: `src/core` old path to new path

All paths under `src/core/`. Names without extension; `.t` = `X.test.ts`. A name in `()` is renamed or split. Everything in a row moves to `<context>/` with the same file name unless shown. Rows marked `testing/` move to `src/testing/`.

Split files (body divided; the old name becomes a thin facade or disappears):
- `effectRegistry` -> `effects/effectTypes`, `effects/registry`, kind entries in the owning context (`heat/heatEffects`, `actions/actionEffects`, `resleeve/resleeveEffects`, `sleeve/sleeveEffects`, `items/itemEffects`, `economy/economyEffects`).
- `buyableTypes` -> `effects/kinds/<family>.ts` (action, sleeve, heat, items, resleeve, corporation) + `economy/buyableDefinition`.
- `effects` -> `effects/actionResolver`, `sleeve/sleeveResolver`, `effects/queries`.
- `stats` -> `actions/rewardStats`, `items/dropStats`, `actions/toggleStats`, `actions/speedStats`, `economy/incomeStats`, `heat/heatStats`, `stats.ts` stays as the composing `DerivedStats` facade in `engine/`.
- `progression` -> `actions/levels`, `actions/xpReductions`, `resleeve/sleeveXp`.
- `actionRunner` -> `actions/actionRunner` (orchestration) + `actions/runBatch` (settle one batch).
- `zeroDays` -> `crits/zeroDays` (toggle, claim) + bonus drop moves to `items/drops`.
- `heat` -> `heat/heat` (cooldown) + `heat/heatTax`.
- `rarityShift` -> `items/rarityShift` + `kernel/curves` (wholeOrders).
- `leverageEffects` -> `items/backChannel` + `items/rarityWeight`.
- `config` -> `config/config` + `config/validators/<context>.ts`.
- `serialization` -> `save/saveCodec` + per-context `serialize/restore` hooks.
- `concaveBonus` -> `kernel/curves`.

| Context (target folder) | Source files |
|---|---|
| `kernel/` | infinity, overflow, fields, sampling, (concaveBonus->curves), snapshot, diagnostics, types; tests: fields.t, sampling.t, concaveBonus.t, mathSafety.t, snapshot.t, hardening.t, structure.t |
| `config/` | config, configTypes; tests: core.t |
| `effects/` | effectRegistry*, effectTraits, effects*, buyableTypes*, buyableCaps; tests: buyableEffects.t, buyableCaps.t, skillEffects.t |
| `actions/` | actionTypes, actionLookup, actionRunner*, actionToggles, completion, speed, level, progression*, rewards, economy (reward half), levelRewardFactor, linkedPayouts, overclock (new, from engine/stats); tests: engineProgress.t, progressAndSpeed.t, levels.t, coreLevels.t, levelRewardFactor.t, linkedPayouts.t, runsPerSleeveXp.t, batching.t, overclock.t, overclockEffects.t, overdriveCap.t, killServers.t, cyberneticsSpeed.t |
| `heat/` | heat*, heatPace, heatEffects, cooldowns; tests: heatChance.t, heatPace.t, heatSkills.t, heatStep.t, skillsHeat.t |
| `crits/` | critical, criticalLinks, critFeed, zeroDays*; tests: critical.t, criticalBoosts.t, critFeed.t, cyberneticsCrits.t, zeroDays.t, adminKeys.t |
| `items/` | inventory, itemTypes, drops, rarityShift*, burnLeads, skillShards, augments, backChannel, leverageEffects*; tests: items.t, dropSources.t, rarityShift.t, burnLeads.t, burnLeadsFlat.t, skillShards.t, augments.t, leverageEffects.t, backChannel.t |
| `economy/` | economy, network, shop, reveal; tests: reveal.t, retentionLane.t(?) |
| `skills/` | skills, (skillsKit -> `testing/`); tests: skills.t, skillParents.t, wholeNodes.t |
| `automation/` | automation; tests: automation.t |
| `sleeve/` | sleeveEuphoria, (stats sleeve half), (effects sleeve half), (concave users); tests: sleeveEuphoria.t, iceRating.t, iceRatingFromLevel.t, coreSleeve.t, engineSleeve.t |
| `resleeve/` | resleeve, sleeveLevelGate, runsSave, resleeveCarry, resleever, resleeveGate, resleeveEffects, resleeveEffectTypes, reflexArchive, (resleeveSkillsKit -> `testing/`); tests: resleeveGate.t, sleeveLevelGate.t, carryTraits.t, resleevePoints.t, runRecord.t, synthSleevesPlay.t, sleeveEuphoriaPlay.t, resleeveSaving.t (split from resleeveTree.t), revealAfterResleeves.t, batchingResleeveSkills.t, reflexArchive.t, retentionLane.t, saveWipe.t |
| `synth/` | synthSleeves; tests: synthLane.t |
| `corporation/` | corporation, corporationEffects, corporationLevels, corporationState, corporationTypes; tests: corporation.t, corporationLane.t, corporationLevels.t, corporationRank.t, corporationStocks.t |
| `save/` | serialization (composes), saveParts, purchasesSave, migrate, state, stateTypes; tests: progression.t, shop.t, serialization.t, configHelpers.t (split from coreState.t), saveParts.t, v7Golden.t, v7Migration.t, walletSleeve.t. Per-context parts: actions/actionsSave, crits/critsSave, items/inventorySave, automation/automationSave, corporation/corporationSave, resleeve/runsSave, synth/synthSave; kernel/savePart, kernel/readValues |
| `engine/` | engine, api, index, stats (facade only); tests: engine.t, engineAccess.t, api.t, properties.t |

Unverified placements (check in the owning step): hardening.t, structure.t, retentionLane.t, saveWipe.t, coreState.t, and where the mixed halves of `stats`/`effects` land. `core/index.ts` stays a re-export barrel until Step 12, then shrinks to `engine/index`.

Outside `core`: `ui/` follows the same contexts for view models (`ui/view/<ctx>*`), and `ui/viewTypes.ts` (21 KB), `ui/uiText.ts` (18.7 KB), `ui/uiTextParts.ts` (18.5 KB), `ui/tipText.ts` (16.8 KB) split by context (Step 13). `content/buyables/` already has one file per action; add `content/currencies.ts`.
