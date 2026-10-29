# Migration plan (15 steps, one session each)

**Order of work: see `execution-plan.md` (12 sessions). This file keeps the per-mechanic detail.**

**Approved scope overrides the design rides below: read `approved-scope.md` first** (D5, D7, D8, D4 dropped; D3 is a gate with no migration; D6 is only the Study methods redesign, pending the user's review).

Rules for all steps: behaviour-preserving unless a *Design* line says otherwise; `npm run check` green at the end; tests move with the code onto shared kits; the doc slice for the context is split out in the same step; use `step-prompt-template.md`. Old import paths keep working through the `core/index.ts` barrel until Step 12. Design changes only land if the user approved them at the checkpoint (finding ids refer to `findings-design.md`; P-numbers to `findings-code.md`).

Order logic: foundations (kernel, test kits, effects) -> single-mechanic contexts (heat, crits, items, actions) -> economy and skills -> state/save (the layer-readiness change) -> prestige layers -> engine/UI -> docs finish. Each later step depends on the earlier ones only through `index.ts`.

## Step 0: Scaffold + kernel
- Files: `infinity, overflow, fields, sampling, concaveBonus, snapshot, diagnostics, types`; new `kernel/curves.ts` (`orders`, `wholeOrders`, `logScaled`); new `boundaries.test.ts` with an allow-list of today's violations.
- Tests: move `fields, sampling, concaveBonus, mathSafety, snapshot, hardening, structure` tests; add curves tests (zero, negative, huge, NaN).
- Docs: create `docs/contexts/README.md` and `kernel.md` (numbers + infinity from DESIGN 9, CONFIG `global`, ARCHITECTURE "Number handling").
- Ride-along: P9 (one curves module; do NOT change results: replace call sites one by one with tests pinning the outputs), overflow-floor difference (`fields.ts:193-212`) documented, not changed.
- Risks: barrel re-exports hide cycles; the boundary test must start permissive.

## Step 1: Test kits
- New `src/testing/gameKit.ts`, `buyableKit.ts`, `corporationKit.ts`, `domMountKit.ts`; move `core/skillsKit.ts` and `core/resleeveSkillsKit.ts` into `src/testing/`.
- Tests: switch the ~25 files with local `game()/configWith()` to the kits; delete local `skill()/buy()/stock()/own()/mount()`. No logic changes, no file moves yet.
- Docs: `docs/contexts/testing.md` (kit catalogue, one line per helper). Update CLAUDE.md pointer only via the proposal.
- Risks: wide diff touching many tests; do it mechanically and run per-folder.

## Step 2: Effects context
- Files: `effectRegistry, effectTraits, effects, buyableTypes, buyableCaps, resleeveEffectTypes, resleeveEffects`; create `effects/effectTypes.ts` (breaks the registry cycle), kind unions per family, `ownedOfKind` (P13), kind traits for the `if (kind === ...)` sites in `state.ts, synthSleeves, resleeveCarry, serialization, corporation, config.ts`.
- Tests: `buyableEffects, buyableCaps, skillEffects`; add a registry-completeness test (every kind has an entry or an explicit exemption, every switch ends in `assertNever`).
- Docs: `effects.md`; fix `buyableTypes.ts:17,46` and `effectRegistry.ts:10` comment drift; CONFIG `buyables[]` (15 KB) index only.
- Risks: this is the widest import surface; keep `core/index.ts` re-exports; run `properties.test.ts` often.

## Step 3: Heat
- Files: `heat, heatPace, heatEffects, cooldowns`; new `HeatModel` (`taxShare, cycleMs, coolsNow, moleBonus, gain`); UI `ui/view/sleeveView.ts, moleBonus.ts` consume it.
- Tests: `heatChance, heatPace, heatSkills, heatStep, skillsHeat`, merge into one `heatKit`-based folder; add a test that UI strings equal the model values (P4, P5), P15 documented.
- Docs: `heat.md` from DESIGN 3/8 heat parts, CONFIG heat variables, DECISIONS heat entries; fix the `coolHeat` doc drift.
- Risks: heat is the known problem area; pin numbers from existing tests before moving.

## Step 4: Crits
- Files: `critical, criticalLinks, critFeed, zeroDays` (split bonus drop to items in Step 5; leave a TODO import), stats crit functions; new `CriticalCover` (P1, P2).
- Tests: `critical, criticalBoosts, critFeed, cyberneticsCrits, zeroDays, adminKeys`; a property test that `maxPerRun >= observed crits` for random seeds.
- Docs: `crits.md`; fix the "capped at 1" comment (`buyableTypes.ts:46`) or the code; ask the user which is intended before changing behaviour.
- Risks: `actionRunner.completeRuns` ordering of claims (banked -> zero-day -> admin key); keep the order.

## Step 5: Items
- Files: `inventory, itemTypes, drops, rarityShift, burnLeads, skillShards, augments, backChannel, leverageEffects`; `Inventory.take/addFirst`, `DropQueries.share` (P12), `burnLeads.use -> useMany(…,1)` (P3), zero-day bonus drop moved from `zeroDays`.
- Tests: `items, dropSources, rarityShift, burnLeads, burnLeadsFlat, skillShards, augments, leverageEffects, backChannel`; add a test that `use` equals `useMany(1)` for several heat/flat values.
- Docs: `items.md` from DESIGN 10 (split augments inside), CONFIG `items`.
- Design (if approved): D11 note only; none.
- Risks: serialization stores rarity-less items under rarity 0 by convention (`serialization.ts:204`); leave it, Step 9 revisits.

## Step 6: Actions and rewards
- Files: `actionTypes, actionLookup, actionRunner, actionToggles, completion, speed, level, progression, rewards, economy(reward half), levelRewardFactor, linkedPayouts`; new `RewardPayer.payRun` (P6, P7, P8), `DEFAULT_REWARD_KIND` everywhere; split `progression` into levels / xpReductions / sleeveXp; split `completeRuns` into `runBatch`.
- Tests: `engineProgress, progressAndSpeed, levels, coreLevels, levelRewardFactor, linkedPayouts, runsPerSleeveXp, batching, overclock*, overdriveCap, killServers`; extend `batching.test.ts`: one long tick equals many short ones across both pay paths.
- Docs: `actions.md` from DESIGN 3, 4, 7.x (per action), CONFIG `actions[]`, `progression`, `speed`, `focus`.
- Design (if approved): D5 (give Cascade failure its own lever) lands here because it lives in Kill servers; GAMEPLAY, keep id so no SAVE.
- Risks: closed-form batching must stay closed form; the binomial helper (P11) is a separate commit.

## Step 7: Economy and currencies
- Files: `economy, network, shop, reveal`; new `content/currencies.ts` + `CurrencyRegistry`; remove literals in `shop.ts, engine.ts, resleeveCarry.ts, state.ts` and the closed `Currency` union; P14 one taxed-income function.
- Tests: network/shop tests (find them: no dedicated files today, so add `economy.test.ts` on the kit), `reveal`; extend invariants.
- Docs: `economy.md` from DESIGN 2, 6, 7 intro, CONFIG `network`, `global`.
- Risks: serialization keys that name currencies (`skillPoints`, `resleevePoints`, `automationPoints`); do not rename.

## Step 8: Skills, automation, sleeve stats
- Files: `skills, automation, sleeveEuphoria`, sleeve halves of `stats`/`effects` (`SleeveStats`), composing `DerivedStats` facade; split `stats.ts` (22 KB) by context into the services named in `target-architecture.md`.
- Tests: `skills, skillParents, wholeNodes, automation, sleeveEuphoria, iceRating, iceRatingFromLevel, coreSleeve, engineSleeve`; add a test that `DerivedStats` queries equal the per-context services.
- Docs: `skills.md`, `automation.md`, `sleeve.md` from DESIGN 5, 8, 8b; `REVEAL_RULES` pointers.
- Design (if approved): D4 (measure points vs nodes first; the change itself is GAMEPLAY, may need SAVE if node ids change), D6 (Study methods) ride here.
- Risks: biggest `stats.ts` split; do it as pure moves first, then the facade.

## Step 9: State and save (layer-readiness)
- Files: `state, stateTypes, serialization`; split `GameState` into `Wallet` + `SleeveState`; keyed collections for zero-day/admin-key toggles; per-context `serialize/restore` hooks; new `save/` folder.
- Tests: `coreState, saveWipe`, round-trip and version tests; extend `invariants.ts` for wallet vs sleeve ownership.
- Docs: `save.md` (ARCHITECTURE "Persistence", "State lifetimes"); CONFIG nothing.
- Design: D1. SAVE: version bump + migration, written with the user's go-ahead (CLAUDE.md: outside scope without asking).
- Risks: highest risk step; old saves must load; keep the old key names in the file if possible and only reshape inside.

## Step 10: Resleeve and synth
- Files: `resleeve*, resleever, reflexArchive, synthSleeves`; carry lists become data with traits (no kind-name checks); `synth` records keep their own level input (D2); `synthBoost()` shared (P10).
- Tests: `resleeveGate, resleeveTree (18 KB: split by lane), revealAfterResleeves, batchingResleeveSkills, reflexArchive, retentionLane, synthLane`.
- Docs: `resleeve.md`, `synth.md` from DESIGN 11 (7.2K) and ARCHITECTURE "Re-sleeving".
- Design (if approved): D3 (points depend on the run) with a derived-points migration.
- Risks: DESIGN 11 positive lists; run the `properties` seeded play.

## Step 11: Corporation
- Files: `corporation*`; state keyed by corporation id (one entry), `CorporationQueries`; reads `SynthQueries.boost()` only.
- Tests: `corporation, corporationLane, corporationLevels, corporationRank, corporationStocks`.
- Docs: `corporation.md` from DESIGN 11b, CONFIG `corporation`, ARCHITECTURE "The Corporation".
- Design (if approved): D7 auto-run for corporation actions; D8 and the assignment rule only after the user decides (they are open design).
- Risks: SAVE shape (map) rides on Step 9's migration; do not do both in one session.

## Step 12: Engine and API
- Files: `engine, api, index`; per-context `*Queries` unions, optional sleeve id on queries, `core/index.ts` barrel reduced.
- Tests: `engine, engineAccess, api, properties`; the boundary allow-list must be empty at the end.
- Docs: `engine.md` (tick order, ARCHITECTURE "Tick loop", DESIGN 12).
- Risks: `engine.ts` stays the one allowed outlier; no behaviour change.

## Step 13: UI alignment
- Files: `ui/view/viewTypes.ts, uiText.ts, uiTextParts.ts, tipText.ts` split by context; break the `tipText <-> uiText`, `skillTreeTypes <-> viewTypes`, `controls <-> dom` cycles.
- Tests: `viewModel` (18 KB), `tooltipText`, `skillsTab`; `domMountKit` everywhere.
- Docs: `ui.md`; `REVEAL_RULES` update if the reveal tests move.
- Risks: UI change: preview and screenshot (CLAUDE.md "Looking at UI").

## Step 14: Docs finish and clean-up
- Turn `DESIGN.md`, `ARCHITECTURE.md`, `CONFIG.md`, `DECISIONS.md` into indexes (each under 8 KB); archive superseded material; delete dead code the boundary test shows; update `CLAUDE.md` with the approved proposal; ask about `npm run agents:sync`.
- Risks: link rot; add a link check to `npm run check` if cheap.

Cross-step work: after Step 3 (first context done) apply `claude-md-proposal.md` (user asked for this timing).
