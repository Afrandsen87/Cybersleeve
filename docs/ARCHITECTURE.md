# Cybersleeve – Architecture

Maintained alongside the code; it is the source for the future generated HTML overview (sections mirror `ARCHITECTURE_DerivativeClicker.html`: Summary, Files, Architecture, Domain model, State lifetimes, Tick loop, Call graph, Function reference, Risks).

## Commands
| Command | Purpose |
|---|---|
| `npm install` | install dependencies |
| `npm run dev` | dev server |
| `npm test` | run unit tests (Vitest) |
| `npm run test:coverage` | unit tests with a v8 coverage report |
| `npm run typecheck` | strict TypeScript check |
| `npm run lint` / `npm run format` | Biome lint / Biome formatter (writes) |
| `npm run check` | everything in one go: typecheck, Biome check, tests, build. Run before reporting work done |
| `npm run build` | typecheck + production build incl. PWA service worker/manifest into `dist/` |
| `npm run preview` | serve the production build (production build served locally) |
| `npm run docs` | regenerate `docs/architecture.html` (reads TSDoc + imports, runs the tests); only when the user asks; the file is not in git |
| `npm run docs:check` | fail when `docs/architecture.html` no longer matches the sources (on request only; not part of `npm run check`) |
| `node scripts/generate-icons.mjs` | regenerate PWA PNG icons in `public/` |
| `node scripts/collate-changelog.mjs <sha>` | merge the changelog entries added since commit `<sha>` into one (see Deploy changelog). Rewrites `src/content/changelog.ts` in place |

## Deploy changelog

*Moved to [archive/deploy-changelog.md](archive/deploy-changelog.md).*

## Core folders (bounded contexts, since session S0 of `docs/review/execution-plan.md`)

`src/core/` is split into one folder per context: `kernel`, `config`, `effects`, `actions`, `heat`, `crits`, `items`, `economy`, `skills`, `automation`, `sleeve`, `resleeve`, `synth`, `corporation`, `save`, `engine`. `core/types.ts` and `core/index.ts` stay at the root as the stable barrels, so imports from `ui`, `app` and `content` did not change. The target map (which file belongs to which context and why) is `docs/review/file-map.md`; the dependency rules are in `docs/review/target-architecture.md`. `core/boundaries.test.ts` lists the context-to-context imports that exist today and fails on a new one; the list only shrinks. The docs are split per context in `docs/contexts/<context>.md` (index: `docs/contexts/README.md`); `DESIGN.md`, this file, `CONFIG.md` and `DECISIONS.md` keep what is cross-cutting and point to the context docs. File paths in the docs were rewritten to the folder layout by `scripts/split-docs.mjs`. `scripts/move-core.mjs` is the one-off tool that did the move. The two test kits that lived in `core/` (`skillsKit`, `resleeveSkillsKit`) are now in `src/testing/`.

**S3 (kernel and effects).** `kernel/curves.ts` holds the "per order of magnitude" helpers (`orders`, `bigOrders`, `wholeOrders`, `logScaled`) and `kernel/sampling.ts` the `perRunEvents` helper that every per-run chance in a batch goes through (one draw per batch). In `effects/`, the `BuyableEffect` union is split into `effects/kinds/<family>.ts` (`buyableTypes.ts` keeps `BuyableDefinition` and the currencies), and `effects.ts` became a facade over `actionResolver.ts`, `sleeveResolver.ts` (+ `sleeveStatsTypes.ts`) and `queries.ts`. `ownedOfKind.ts` (`ownsKind`, `effectsOfKind`, `ownedEffects`) is the typed way to ask "which buyables of kind X", instead of comparing kind names. Details: `docs/contexts/kernel.md`, `docs/contexts/effects.md`.

**S4 (heat and crits).** `heat/heatModel.ts` holds the cooldown cycle, "cools now", tax share, stop point and Mole speed that `cooldowns.ts`, `heatPace.ts` and the Sleeve tips all use. `crits/criticalCover.ts` and `CriticalSuccesses.maxPerRun` replace two hand-written copies in `DerivedStats`. `testing/gameKit.ts` gained `seededGame`, used by the crit tests. Details: `docs/contexts/heat.md`, `docs/contexts/crits.md`.

**S5b (actions and rewards).** `actions/rewards.ts` owns reward rounding (`wholeRunAmount`); `actions/rewardPayer.ts` (`RewardPayer`) is the one way a run is paid, own, critical or linked. Overclock's `alsoPays` and the `paysActionReward` buyables are one rule list (`DerivedStats.paysActions`) drawn by `LinkedPayouts`. `ActionRunner.completeRuns` became `runBatch` (small named steps), start costs moved to `actions/startCosts.ts`, and `progression.ts` (facade) delegates to `xpReductions.ts` and `sleeveXp.ts`. Details: `docs/contexts/actions.md`.

**S6 (economy, currencies, stats).** `kernel/currencies.ts` holds the currency descriptors (see `docs/contexts/economy.md`). `engine/stats.ts` shrank from 21 KB to a 11 KB facade over `actions/toggleStats.ts`, `actions/runStats.ts`, `crits/critStats.ts`, `items/itemStats.ts`, `economy/incomeStats.ts` and `heat/heatStats.ts`; each takes only the narrow inputs it needs. The heat tax on income has one owner (`Economy.taxedCreditsPerNode`).

## Layering (dependencies point downwards only)

*Moved to [contexts/_layering.md](contexts/_layering.md).*

## SOLID in practice
- **S** – `Progression` (XP/levels, including reduced sleeve XP requirements), `Shop` (purchases in credits or nodes), `effects` (buyable effects), `speed` (multiplier), `serialization`, `GameLoop`, `SaveGame` each have one job; `GameEngine` only orchestrates (see Layering).
- **O** – new speed factors = new `SpeedModifier`; new content = data in `gameConfig.ts`; a new scalar stat = one entry in `fields.ts` (plus the `GameState` field); a new reward kind = one entry in `REWARDS` (the compiler demands it); a new effect kind = a union member and ONE entry in the effect registry (`effectRegistry.ts`; the mapped type demands it, so a forgotten kind does not compile). A kind with a dedicated query (network growth, level bonus, XP reductions, drop chance, back channel) leaves the hooks out and is read by that query. There is no global reward multiplier: a lever applies to one named kind of reward (today only `global.creditMultiplier`, for credits).
- **L** – anything satisfying `BigNum`, `Scheduler`, `KeyValueStore`, `ResleevePolicy`, `Tickable` is substitutable (tests use fakes).
- **I** – small interfaces (`Scheduler`, `Tickable`, `KeyValueStore`, `ResleevePolicy`).
- **D** – the engine receives its collaborators through the constructor; game code never imports break_infinity.js.

## Domain model
`GameState` = the scalars of `fields.ts` (credits, network (nodes), `iceRating`, `nodePayoutBonus` (credits per second added to the base value of a node by Push malware) and `hackingProficiency` as `BigNum`s because multipliers can make them unbounded; heat, `heatCooldownMs`, `legend`, `legendCooldownMs` and `networkRemainder` as plain numbers because their effects saturate or are bounded), `autoRunOff` (auto-run switches), `overclocked` and `focused` (the per-action Overclock and Focus switches), per-action `{xp, sleeveXp, runsTowardSleeveXp, augments, running, progress}`, copies owned per buyable (`purchased: Record<id, number>`), and the `inventory` (`Record<itemId, Record<rarityId, number>>`, whole counts as plain numbers capped at the largest exact integer). Items (`ItemDefinition`) and rarity tiers with their sell values (`RarityDefinition`) are content in `GameConfig.items`. Definitions (`ActionDefinition`, `BuyableDefinition`) are separate from state. Sleeve XP/level is per action. A buyable either belongs to one action (`BuyableDefinition.actionId`, displayed inside that action's card) or, with no `actionId`, to the sleeve (displayed in the Sleeve widget). Sleeve-wide effects (`interfaceSpeed`, `accessLevel`) are resolved by `resolveSleeveStats` into `SleeveStats` (access level, interface speed, heat), exposed as `GameEngine.sleeveStats()`; Interface speed is a `SpeedModifier` (a plain multiplier on every action's speed); heat is a tax on earned credits (`heatTaxFactor` with `sleeve.heatTaxPerPoint`, applied through `Economy` to run payouts and passive income) that cools down by `heatCooldownAmount` every `heatCooldownMs`, in whole points only and only while there is at least one whole point (`coolDownHeat` in `cooldowns.ts`, closed form so long ticks are cheap); access level gates actions (`ActionDefinition.requiredAccessLevel`, `GameEngine.isUnlocked`). An action's `rewardKind` decides whether a run pays credits or network nodes; nodes produce passive credits (`network.creditsPerNodePerSecond`).

### State lifetimes

*Moved to [contexts/save.md](contexts/save.md).*

## Tick loop

*Moved to [contexts/engine.md](contexts/engine.md).*

## Number handling (replaces the reference game's workarounds)

*Moved to [contexts/kernel.md](contexts/kernel.md).*

## The Corporation

*Moved to [contexts/corporation.md](contexts/corporation.md).*

## Re-sleeving and synthetic sleeves

*Moved to [contexts/resleeve.md](contexts/resleeve.md).*

## Persistence

*Moved to [contexts/save.md](contexts/save.md).*

## Known limitations / next steps
- Scope decisions (2026-10-24): desktop browsers only for now (the PWA build still works, but mobile layout and install flow are out of scope); offline progress is deferred (the save has no timestamp yet); balance is not a factor yet, because most actions will get their own buyables later.
- `main.ts` is untested glue (excluded from the coverage report); everything it calls is tested (`throttle`, `tabGuard`, `debugControls`, the game loop, the render loop). Known gaps, decided not to fix yet: the 10-minute `maxDeltaMs` drops the time of a long-hidden tab (offline progress is a later mechanic; the drop is reported to `Diagnostics`, which `main.ts` prints in development builds and with `?debug`); `DerivedStats` recomputes sleeve stats and effects on every call outside a `Snapshot` scope (the screen opens one per refresh; the tick does not, and it is cheap: measured under 0.1 ms per step). Measured 2026-10-25 in headless Chrome: the whole game costs about 1% of a core; the visible "lag" was refresh cadence (about 8 Hz, uneven) and stepped bars, not computation.
- **Kill servers mechanics (units).** `DerivedStats` answers `startCostScale` (Decommission protocol and the chain on the start-cost share), `siphonSeconds`, `chainLinks` and `heatCoolingBlocked`; `ActionRunner` pays the scaled cost and the Credit Siphon at every start, keeps the chain (`GameState.chains`, added to the Overclock by an owned `overclockChain` buyable) in `extendChain` and breaks it when the action stops; `GameEngine.advance` skips `coolDownHeat` while `heatCoolingBlocked()`, and `BurnLeads` takes the same predicate. Admin keys reuse `ZeroDays` (one instance per item: `kind` selects `items.zeroDay` or `items.adminKey` and its toggle; the Admin key also rolls the Skill shard drop per batch); `SkillShards` uses a shard on a random unlocked action (`ActionState.skillShards`), and `LevelRule` takes a `delay` argument that `Progression.xpDelay` supplies for the action levels.
- **Number domains.** Amounts that multipliers can make unbounded are `BigNum`s (credits, nodes, ICE Rating, the two bonuses, XP). Heat, Legend and the cooldown timers are plain numbers because their effects saturate or are bounded. Multipliers derived from a `BigNum` (interface speed, node payout, the speed product) are plain doubles that SATURATE at the game's infinity (1e308) and treat NaN as 1, and a run never takes less than `engine.minRunDurationMs`; so a bonus beyond the double range cannot produce `Infinity`, a zero duration or NaN (`mathSafety.test.ts`).
- **Invariants and properties.** `testing/invariants.ts` lists what must hold for every reachable state (finite non-negative amounts, whole nodes, counters in range). `properties.test.ts` plays seeded random sequences of commands and ticks, on the test content and on the shipped content, and checks the invariants after every step (including that Overclock is on only where it is owned and no more actions are focused than there are slots; the "nodes are whole" check allows for the number type's precision: above about 1e8 it cannot hold every integer exactly), that saving and loading returns the same content, and that 30 s in one tick equals 30 ticks of 1 s.
- `runsTowardSleeveXp` (per action) is a plain JS number (exact up to 2^53 runs).
- Lint and format use Biome, because typescript-eslint does not support TypeScript 7 yet. Revisit if ESLint rules are needed.
- The HTML generator (`scripts/generate-docs.mjs`) parses the sources with the TypeScript compiler API, via a TypeScript 5 devDependency aliased as `typescript5` (TypeScript 7 has no JavaScript API; it is used for nothing else); curated sections (architecture, domain model, tick loop, runtime call graph, risks) live in `scripts/architecture.template.html` and must be edited by hand when the design changes.
