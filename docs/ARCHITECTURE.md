# Cybersleeve – Architecture (milestone 1)

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
| `npm run docs` | regenerate `docs/architecture.html` (reads TSDoc + imports, runs the tests) |
| `node scripts/generate-icons.mjs` | regenerate PWA PNG icons in `public/` |

## Layering (dependencies point downwards only)
```
main.ts ── ui/dom.ts ── ui/viewModel.ts
   │            │              │
   ▼            ▼              ▼
app/ (createGame, loop, persistence)  ──►  core/  ──►  numbers/ (BigNum interface)
                                     content/ (data)        │
                                                            ▼
                                              BreakInfinityNum (only file importing break_infinity.js)
```
- `numbers/` – `BigNum`/`NumberFactory` interfaces, the break_infinity.js adapter, `formatBigNum`.
- `core/` – pure game rules, no DOM, no timers, no storage. Time enters only via `GameEngine.tick(deltaMs)`. `GameEngine` is a thin facade over small units: `DerivedStats` (all read-only calculations), `ActionRunner` (unlock rules, start costs, run progress, closed-form completion), `NetworkSystem` (passive income, growth), `cooldowns.ts` (heat and Infamy decay), `Progression`, `Shop`, `Economy` (formulas) and `OverflowPolicy`. The outside world depends only on two narrow interfaces in `api.ts`: `GameQueries` (read-only; used by the view model) and `GameCommands` (what a player can do: `startAction`, `activateBuyable`, `resleeve`, `newGame`). Scalar state (credits, network, heat, ...) is described once as data in `fields.ts`; that table drives the initial state, re-sleeving, saving/loading and overflow repair. `rewards.ts` maps each reward kind to the scalar it pays. State is exposed only as a read-only `GameStateView` (`DeepReadonly<GameState>`, derived, never hand-copied).
- `content/` – `gameConfig.ts`: the single tuning file (actions, buyables, progression, speed, global levers, engine, runtime). See `docs/CONFIG.md`. Add content and retune here.
- `app/` – composition root (`createGame`), timer loop with injected `Scheduler`, `SpeedToggle` (x10 test fast-forward), `SaveGame` with injected `KeyValueStore` (`createBrowserStore` falls back to memory when `localStorage` is blocked), `createNewGameHandler` (the temporary "Reset save" button).
- `ui/` – `viewModel` (pure, tested) and `dom` (thin binding; covered by a happy-dom smoke test, `dom.test.ts`). `dom` only places what the view model says and sends commands; it holds no game rules (whether a click buys or switches an auto-run is `GameCommands.activateBuyable`). Every frame writes only what changed. Desktop layout: a 3x2 grid of action cells (unused cells are empty placeholders) with the **Sleeve widget** (global stats + global buyables) to its right.

## SOLID in practice
- **S** – `Progression` (XP/levels, including reduced sleeve XP requirements), `Shop` (purchases in credits or nodes), `effects` (buyable effects), `speed` (multiplier), `serialization`, `GameLoop`, `SaveGame` each have one job; `GameEngine` only orchestrates (see Layering).
- **O** – new speed factors = new `SpeedModifier`; new content = data in `gameConfig.ts`; a new scalar stat = one entry in `fields.ts` (plus the `GameState` field); a new reward kind = one entry in `REWARD_TARGETS`; a new effect kind = a union member, one validator in `EFFECT_CHECKS` (the compiler demands it) and its case in `effects.ts`.
- **L** – anything satisfying `BigNum`, `Scheduler`, `KeyValueStore`, `ResleevePolicy`, `Tickable` is substitutable (tests use fakes).
- **I** – small interfaces (`Scheduler`, `Tickable`, `KeyValueStore`, `ResleevePolicy`).
- **D** – the engine receives its collaborators through the constructor; game code never imports break_infinity.js.

## Domain model
`GameState` = the scalars of `fields.ts` (credits, network (nodes), `circumvention`, `nodePayoutBonus` and `interfaceSpeedBonus` as `BigNum`s because multipliers can make them unbounded; heat, `heatCooldownMs`, `infamy`, `infamyCooldownMs` and `networkRemainder` as plain numbers because their effects saturate or are bounded), `unlockedActions` (node-count unlocks that stay), `autoRunOff` (auto-run switches), per-action `{xp, sleeveXp, runsTowardSleeveXp, running, progressMs}`, copies owned per buyable (`purchased: Record<id, number>`). Definitions (`ActionDefinition`, `BuyableDefinition`) are separate from state. Sleeve XP/level is per action. A buyable either belongs to one action (`BuyableDefinition.actionId`, displayed inside that action's card) or, with no `actionId`, to the sleeve (displayed in the Sleeve widget). Sleeve-wide effects (`interfaceSpeed`, `accessLevel`) are resolved by `resolveSleeveStats` into `SleeveStats` (access level, interface speed, heat), exposed as `GameEngine.sleeveStats()`; Interface speed is a `SpeedModifier` (a plain multiplier on every action's speed); heat is a tax on earned credits (`heatTaxFactor`, applied in `GameEngine` to run payouts and passive income) that cools down by `heatCooldownAmount` every `heatCooldownMs` while above 0 (`coolDownHeat` in `cooldowns.ts`, closed form so long ticks are cheap); access level gates actions (`ActionDefinition.requiredAccessLevel`, `GameEngine.isUnlocked`). An action's `rewardKind` decides whether a run pays credits or network nodes; nodes produce passive credits (`network.creditsPerNodePerSecond`).

### State lifetimes
| Field | Re-sleeve | New game |
|---|---|---|
| per action: sleeveXp, runsTowardSleeveXp | kept | reset |
| credits (to `startingCredits`), network, action xp/progress, purchases (all copies) | reset | reset |

## Tick loop
`setTimeout` (50 ms; keeps firing in background tabs) → `GameLoop.step` (real elapsed time × `timeScale`, capped at 10 min) → `GameEngine.tick(delta)` → the tick is cut into slices of at most `engine.maxSliceMs` (at most `engine.maxSlicesPerTick` slices); for each slice: passive network income (`nodes × rate × slice × heat-tax factor`, nodes owned at the start of the slice) → network growth → heat cooldown and Infamy decay (closed form) → for each action (skipped while locked by access level): apply auto-run, advance progress, then complete runs **in batches** (below) → `OverflowPolicy.apply` → `render()` (skipped while `document.hidden`). A step that throws is reported (`onError`, default `console.error`) and the loop carries on.
**Batches (closed form).** All runs between two level changes are identical in speed and reward, so they are applied at once: `n = min(runs that fit in the time left, Progression.runsBeforeLevelChange)`. A batch pays `Economy.creditsForRuns` (an arithmetic series when runs add heat, because each run raises the tax on the next), adds `n × heat`, and records `n × XP` and `n × output multiplier` counted runs. A tick therefore costs about one batch per level gained, not one iteration per run; `maxBatchesPerTick` is only a safety net. A manual run that completes drops leftover time; an auto-run carries it into the next batch.

**Tick granularity and slicing.** Within a slice passive income and heat cooling use the nodes and heat at the start of the slice, and heat added by runs starts cooling in the next slice. Systems that feed back on themselves (interface speed rising with every run, heat cooling while the network pays) would drift if a long tick were computed in one go, so a tick longer than `engine.maxSliceMs` is cut into slices that run one after another. Result: one long tick and many short ones agree (`batching.test.ts` checks interface speed within 2% over 5 minutes and passive income under cooling within 1% over 50 minutes, and that without slicing the first would be clearly off). The cost of a tick is bounded by `engine.maxSlicesPerTick`; beyond that the slices simply get longer and the agreement degrades gracefully. Runs of actions with a start cost still complete one per batch (a share-of-balance cost has no exact closed form because of rounding), so `maxBatchesPerTick` caps them per slice.

## Number handling (replaces the reference game's workarounds)
All amounts are `BigNum` (mantissa/exponent). The adapter treats exponent ≥ 9e15 (library saturation) as non-finite, so overflow is detectable. No iteration over huge counts (runs are batched, see Tick loop), no rounding hacks. After every slice the `OverflowPolicy` repairs non-finite scalars and XP; the default clamps overflow to `NumberFactory.maxValue()` (the largest safe integer for plain-number scalars) and turns negative overflow and **NaN into 0** (NaN is a bug upstream and must never become a windfall) so the state stays valid and saveable. The real reaction, the "infinity" prestige, is not designed yet. Level calculation uses `floorLog10`, exact at powers of ten and valid beyond the double range (tested up to 1e1000).

## Persistence
`serializeState`/`deserializeState` (versioned JSON, numbers as strings, defensive parsing; format v3 stores sleeve XP per action plus the network and (optional fields) heat and the heat cooldown progress; v1 and v2 saves are still readable and their global sleeve XP moves to the first action) behind `SaveGame` on an injected `KeyValueStore` (`localStorage` in the browser). Autosave every 10 s and when the page is hidden.

Loading is defensive: negative amounts become 0, non-finite times are dropped, the run counter is reduced modulo `runsPerSleeveXp`, copy counts are capped at a safe integer, and a buyable whose `requires` are not owned is discarded. A save that exists but cannot be read (corrupt, or from a newer version) is copied to `cybersleeve.save.unreadable` before the game starts over, so the next autosave cannot destroy it. The temporary "Reset save" button calls `GameEngine.newGame()` (a full wipe, including sleeve XP) and `SaveGame.clear()`; it keeps that backup.

## Known limitations / next steps
- Scope decisions (2026-10-24): desktop browsers only for now (the PWA build still works, but mobile layout and install flow are out of scope); offline progress is deferred (the save has no timestamp yet); balance is not a factor yet, because most actions will get their own buyables later.
- `main.ts` is untested glue (excluded from the coverage report); `ui/dom.ts` has a smoke test only. Known gaps, decided not to fix yet: two browser tabs overwrite each other's saves; the 10-minute `maxDeltaMs` also drops time of a long-hidden tab; the save version was not bumped when optional fields were added; `heatPerRun` and the `addHeat` completion effect both add heat.
- `runsTowardSleeveXp` (per action) is a plain JS number (exact up to 2^53 runs).
- Lint and format use Biome, because typescript-eslint does not support TypeScript 7 yet. Revisit if ESLint rules are needed.
- The HTML generator (`scripts/generate-docs.mjs`) parses the sources with the TypeScript compiler API, via a TypeScript 5 devDependency aliased as `typescript5` (TypeScript 7 has no JavaScript API; it is used for nothing else); curated sections (architecture, domain model, tick loop, runtime call graph, risks) live in `scripts/architecture.template.html` and must be edited by hand when the design changes.
