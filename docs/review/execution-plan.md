# Execution plan (token-minimising), replaces the step order in `migration-plan.md`

12 sessions (0 to 11), down from 15. `migration-plan.md` stays as the per-mechanic detail; `approved-scope.md` as the design decisions. Each session = fresh context (`/clear` or new chat) + `step-prompt-template.md` + the one section below.

## Where the tokens go, and the rules that follow
1. **Mechanical work is a script, not an LLM edit.** Moving 144 files and rewriting imports, slicing docs by heading and rewiring ~25 test files onto kits are deterministic. Write the tool once, run it, let the compiler and `npm run check` judge. LLM effort goes only to deduplicating logic and design.
2. **Do the expensive reading once.** The surveys already exist (`findings-code.md`, `file-map.md`). Sessions get the P-rows and symbol names (not line numbers: they drift after moves) and read only the files named.
3. **Split docs once, up front** (Session 2), so later sessions load `docs/contexts/<ctx>.md` (2-6 KB) instead of the 35-60 KB originals. This deviates from "split per step"; per step you then only edit the context doc.
4. **Moves first, logic after.** Session 0 moves every file, nothing else. Dedupe sessions then never mix a move with a rewrite, so diffs stay small and reviews cheap.
5. **Iterate narrow, check once.** While working: `npx vitest run src/core/<ctx>` and `npx tsc --noEmit`. `npm run check` once at the end.
6. **No fan-out unless 3+ independent big packages.** Each subagent re-reads context. Mechanical test rewiring (Session 1) is the one place worth fanning out (disjoint folders, `sonnet`). Read-only surveys: `haiku`. Log all in `docs/AGENT_METRICS.md`; do not switch implementation to haiku until you start phase 2 of that experiment.
7. **Reports stay short:** moved/removed counts, check output, deferred items. No file dumps.
8. **Optionally run Sessions 0-2 on a cheaper orchestrator model** (they are mostly scripts). CLAUDE.md says only the orchestrator runs on the strongest model, so this is your call.

## Sessions

### S0: Mechanical move (no logic)
- Write `scripts/move-core.mjs` (reuse `graph.mjs` import resolver from the scratchpad): reads a table `old -> new` from `docs/review/file-map.md`, `git mv`s, rewrites relative imports, keeps `core/index.ts` re-exporting old names.
- Split files stay whole and go to their main context for now (`stats` -> `engine/`, `effectRegistry` -> `effects/`). Test kits `skillsKit`/`resleeveSkillsKit` -> `src/testing/`.
- Add `core/boundaries.test.ts` with a generated allow-list of today's violations (it may only shrink).
- Done when: `npm run check` green, zero logic diffs (`git diff -M --stat` shows renames only plus import lines).
- Size: small LLM effort, mostly script debugging.

### S1: Test kits
- Add `gameKit`, `buyableKit`, `corporationKit`, `domMountKit`; fan out 3 `sonnet` subagents by folder (`core/` A-M, `core/` N-Z, `ui/`) to replace local `game()/configWith()/skill()/buy()/stock()/own()/mount()`. Pure test edits; the production code does not change.
- Done when: test count unchanged (compare `vitest` totals before/after), `npm run check` green.

### S2: Docs split (script)
- `scripts/split-docs.mjs`: a heading-to-context table (from the doc survey, kept in `docs/review/doc-map.md`) slices `DESIGN.md`, `ARCHITECTURE.md`, `CONFIG.md`, `DECISIONS.md` into `docs/contexts/<ctx>.md`; the originals become indexes with links. Archive superseded material to `docs/archive/`.
- Review pass by one `haiku` reader per 3 contexts: "does each file read standalone, any broken links, anything misfiled?".
- Done when: every old section exists exactly once (script checks byte totals), indexes under 8 KB, `docs/contexts/README.md` lists context -> files -> doc -> kit.

### S3: Kernel + effects
- P9 (`kernel/curves`: `orders`, `wholeOrders`, `logScaled`; pin outputs with tests first), P11 (`perRunEvents`), P13 (`ownedOfKind`), kind traits replace the `kind ===` chains, `effectTypes.ts` breaks the registry cycle, split `effectRegistry`/`buyableTypes`/`effects` per `file-map.md`, registry-completeness test.
- Docs: `kernel.md`, `effects.md`. Risk: widest import surface; `properties.test.ts` often.

### S4: Heat + crits (first context done; then apply `claude-md-proposal.md`)
- `HeatModel` (P4, P5; UI `sleeveView`/`moleBonus` consume it, test that UI strings equal model values), P15 documented; `CriticalCover` and `maxPerRun` (P1, P2), keep claim order banked -> zero-day -> admin key.
- Merge `heat*` and `crit*` test files onto the kits. Ask about `npm run agents:sync` after applying the instruction edits.

### S5: Items + actions/rewards
- Items: `Inventory.take/addFirst`, `DropQueries.share` (P12), `burnLeads.use -> useMany(…,1)` (P3), zero-day bonus drop to `items`.
- Actions: `RewardPayer.payRun` (P6, P7, P8, `DEFAULT_REWARD_KIND`), `completeRuns` -> `runBatch`, `progression` split into levels / xpReductions / sleeveXp. Extend `batching.test.ts` (one long tick equals many short ones through both pay paths).
- This is the largest logic session; if it runs long, cut after Items and continue as S5b with a fresh context.

### S6: Economy, currencies, stats split
- `CurrencyRegistry` + `content/currencies.ts` (remove literals), P14, split `stats.ts` into per-context services with `DerivedStats` as the composing facade (test: facade equals services).
- Docs: `economy.md`, `skills.md`, `automation.md`, `sleeve.md` touch-ups.

### S7: Study methods (D6) — design session, small
- Per your review: effect becomes a divisor `1 + L` on the other actions' sleeve XP requirement with **no ceiling**. Implementation note: express it as a divisor applied after the shared 0.99 `maxSleeveXpReduction` clamp (a reduction `L/(L+1)` approaches but never reaches 100%, so no extra cap is needed). Tests: 1 at L=0, half at L=1, monotone, finite for huge L, NaN safe.
- Open point for the review after you play it: any XP divisor gives about 3.3 extra levels per decade of `L` (log scaling). If other actions have thousands of sleeve levels it will still feel small. If so, the lever has to change from "cost" to "levels" (for example other actions count a share of Practice Hacking's sleeve level as extra sleeve levels for speed, like Skill transfer). Decide after seeing it; do not pre-build.
- Can run any time after S3; it is independent. Edits: `content/buyables/practiceHacking.ts`, the `sleeveXpReduction` registry entry and `progression`, DESIGN line 149, CONFIG.

### S8: State and save (D1, D2)
- `Wallet` + `SleeveState`, keyed collections for zero-day/admin-key toggles, corporation keyed by id (one entry), per-context `serialize/restore`, new `save/`. SAVE version bump and migration: **ask you before writing it**; old saves must load.
- Tests: round trips, wipe, invariants for wallet vs sleeve ownership. Highest risk: keep it alone in its session.

### S9: Resleeve + synth + D3 gate
- Carry lists as data with traits, synth records take their own level input, `synthBoost()` shared (P10), the sleeve-level gate (`T(N)` from content config, second gate policy next to the Unlock purchase, tip shows the shortfall). No save change (derived from `runs.length`).
- Split `resleeveTree.test.ts` (18 KB) by lane. Docs: `resleeve.md`, `synth.md`.

### S10: Corporation + engine/API
- Corporation keyed by id surface (`CorporationQueries`), `*Queries` unions per context, optional sleeve id on queries, `core/index.ts` reduced; the boundary allow-list reaches empty.

### S11: UI alignment + finish
- Split `viewTypes`, `uiText`, `uiTextParts`, `tipText` by context, break the three UI cycles, `domMountKit` everywhere; preview + screenshot the changed screens.
- Final: indexes under 8 KB, link check, delete dead code the boundary test shows, `CLAUDE.md` pointers to `docs/contexts/`.

## Order and dependencies
S0 -> S1 -> S2 are prerequisites for everything. S3 before S4-S6. S7 independent after S3. S8 before S9 and S10. Stopping points that leave the repo coherent: after S2 (structure only), S6 (all mechanic dedupes done), S10 (layer-ready).

## Estimated spend (relative, my judgement, not measured)
S0 small, S1 small-medium (3 sonnet subagents), S2 small, S3 medium, S4 medium, S5 large, S6 medium-large, S7 small, S8 large, S9 medium, S10 small-medium, S11 medium. Sessions that grow past a context window should stop at a clean point and continue fresh; the plan above marks S5 as the likely one.

## Status (updated 2026-10-29, worktree `worktree-s0-core-move`, nothing committed)
- **S0 done.** 142 files moved, boundary test added (`core/boundaries.test.ts`). Also fixed 7 UI-text tests the user's text edits had broken.
- **S1 done, narrower than planned.** `testing/gameKit.ts` replaces 10 copies of `game(overrides)`; the duplicate `buy()` in `criticalBoosts` now uses `cyberneticsKit`. NOT done, on purpose: unified `skill()` builder (the copies differ in name/currency/defaults and tests assert on them), `setXp` (it sets action XP, not sleeve XP, so it is not a duplicate of `setSleeveXp`), `stock()`/`mount()` (each file builds a different shape). The survey overstated these.
- **S2 done.** `scripts/split-docs.mjs` split the four docs into `docs/contexts/*.md` (verified: no line lost). Not split further: ARCHITECTURE "Layering" (kept in `contexts/_layering.md`, 14 KB), and sections that mix contexts (DESIGN 3 and 8 sit in `actions`/`skills` with their heat/crit text) until the owning step extracts them. `actions.md` is 30 KB for that reason.
- **S3 done (2026-10-29, nothing committed).** P9: `kernel/curves.ts` (`orders`, `bigOrders`, `wholeOrders`, `logScaled`), outputs pinned in `curves.test.ts` against the old inline forms; call sites switched (`effects` ICE heat reduction, `sleeveEuphoria`, `heatPace`, `resleeveCarry`, `stats`; `wholeOrders` moved out of `rarityShift`). Not folded, on purpose: `levelRewardFactor` into `concaveBonus` (edge behaviour differs), `earnedSkillPoints` (precision epsilon). P11: `perRunEvents` in `kernel/sampling.ts`, used by drops, linkedPayouts, the heat draw in `actionRunner`, corporationEffects, zeroDays, critical; `batching.test.ts` and `sampling.test.ts` extended. `buyableTypes.ts` split into `effects/kinds/<family>.ts`; `effects.ts` split into `actionResolver` / `sleeveResolver` (+ `sleeveStatsTypes`) / `queries`, with `effects.ts` kept as a facade. `ownedOfKind.ts` gained `effectsOfKind` / `ownedEffects`, used by `BuyableCaps` and `queries`; the other `kind ===` chains are listed in `contexts/effects.md` and belong to S4-S9. Boundary allow-list: added `heat -> kernel`, `sleeve -> kernel` (curves). Decided: critical chance is not capped (comments fixed). Registry-completeness test added (`effects/registry.test.ts`).
- **S4 code done (2026-10-29, nothing committed; CLAUDE.md edits deliberately not applied).** `heat/heatModel.ts` (P4, P5) consumed by `cooldowns`, `heatPace`, `sleeveView`, `moleBonus`; P15 documented. `crits/criticalCover.ts` (P1) and `CriticalSuccesses.maxPerRun` (P2) used by `DerivedStats`; claim order unchanged. Crit tests moved onto `seededGame` (`testing/gameKit.ts`: adminKeys, critical, criticalBoosts, zeroDays). Not merged: the heat tests' local `game` helpers (`heatSkills`, `skillsHeat`) build different configs. Pending: preview check of the Sleeve heat tip, then the `claude-md-proposal.md` edits and the `agents:sync` question.
- **S5 items half done (2026-10-29, nothing committed); S5b (actions/rewards) NOT started.** Done: `Inventory.heldFirst/takeFirst/addFirst` (P12), `dropShare` (P12), `BurnLeads.use -> useMany(…,1)` (P3). Deferred: zero-day shard bonus drop into `items`, `DropQueries` as an interface. S5b scope: `RewardPayer.payRun` (P6, P7, P8, `DEFAULT_REWARD_KIND`), `completeRuns` -> `runBatch`, `progression` split into levels / xpReductions / sleeveXp, `batching.test.ts` over both pay paths.
- *S3 earlier status:* Done: `effects/effectTypes.ts` and `effectHelpers.ts` (cycle broken), registry table split into `effects/entries/*Entries.ts` (registry file 2 KB), `effects/ownedOfKind.ts` replaces 5 copies (P13). Decision: entry files stay inside `effects/` (not in the owning contexts) so the registry does not import upward. Remaining for S3: P9 curves (`kernel/curves`), P11 `perRunEvents`, split of `buyableTypes.ts` (20 KB) and `effects.ts` (20 KB), kind traits replacing the `kind ===` chains.
- S4-S11 not started.
