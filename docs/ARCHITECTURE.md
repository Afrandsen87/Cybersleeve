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
| `npm run check` | everything in one go: typecheck, Biome check, doc link check, tests, build. Run before reporting work done |
| `npm run check:links` | every relative Markdown link in `docs/` (not `archive`, `review`), `DESIGN.md` and `CLAUDE.md` must point at an existing file (`scripts/check-links.mjs`) |
| `npm run build` | typecheck + production build incl. PWA service worker/manifest into `dist/` |
| `npm run preview` | serve the production build (production build served locally) |
| `npm run docs` | regenerate `docs/architecture.html` (reads TSDoc + imports, runs the tests); only when the user asks; the file is not in git |
| `npm run docs:check` | fail when `docs/architecture.html` no longer matches the sources (on request only; not part of `npm run check`) |
| `node scripts/generate-icons.mjs` | regenerate PWA PNG icons in `public/` |
| `node scripts/collate-changelog.mjs <sha>` | merge the changelog entries added since commit `<sha>` into one (see Deploy changelog). Rewrites `src/content/changelog.ts` in place |

## Deploy changelog

*Moved to [archive/deploy-changelog.md](archive/deploy-changelog.md).*

## Core folders
One folder per bounded context under `src/core/` (layers and allowed exceptions: `core/boundaries.test.ts`; folder map: `docs/contexts/_folders.md`). The full description, with the test kits, is `docs/contexts/_folders.md`. The docs are split per context in `docs/contexts/<context>.md` (index: `docs/contexts/README.md`).

## Layering (dependencies point downwards only)

*Moved to [contexts/_layering.md](contexts/_layering.md).*

## SOLID in practice
- **S** – `Progression` (XP/levels, including reduced sleeve XP requirements), `Shop` (purchases in credits or nodes), `effects` (buyable effects), `speed` (multiplier), `serialization`, `GameLoop`, `SaveGame` each have one job; `GameEngine` only orchestrates (see Layering).
- **O** – new speed factors = new `SpeedModifier`; new content = data in `gameConfig.ts`; a new scalar stat = one entry in `fields.ts` (plus the `GameState` field); a new reward kind = one entry in `REWARDS` (the compiler demands it); a new effect kind = a union member and ONE entry in the effect registry (`effectRegistry.ts`; the mapped type demands it, so a forgotten kind does not compile). A kind with a dedicated query (network growth, level bonus, XP reductions, drop chance, back channel) leaves the hooks out and is read by that query. There is no global reward multiplier: a lever applies to one named kind of reward (today only `global.creditMultiplier`, for credits).
- **L** – anything satisfying `BigNum`, `Scheduler`, `KeyValueStore`, `ResleevePolicy`, `Tickable` is substitutable (tests use fakes).
- **I** – small interfaces (`Scheduler`, `Tickable`, `KeyValueStore`, `ResleevePolicy`).
- **D** – the engine receives its collaborators through the constructor; game code never imports break_infinity.js.

## Domain model
`GameState` = `{ wallet, sleeve }` (S8): the `Wallet` holds what is shared by every sleeve (credits, inventory, finished runs, synthetic sleeves, last life's purchases, automation, the corporation, the all-time peak statistics), the `SleeveState` holds the one live sleeve (purchases, per-action progress, network, heat, ICE Rating, Legend, Moles, the toggles); the table in [contexts/save.md](contexts/save.md) says which field lives where and what a re-sleeve does to it. Functions that need a few fields take `StateSlice<'a' | 'b'>` (both parts picked by field name). The fields below keep their names; read `credits`, `inventory`, `runs`, `synths`, `automation`, `corporation`, `lastLifePurchases` from `state.wallet` and the rest from `state.sleeve`. It is the scalars of `fields.ts` (credits, network (nodes), `iceRating`, `nodePayoutBonus` (credits per second added to the base value of a node by Push malware) and `hackingProficiency` as `BigNum`s because multipliers can make them unbounded; heat, `heatCooldownMs`, `legend`, `legendCooldownMs` and `networkRemainder` as plain numbers because their effects saturate or are bounded), `autoRunOff` (auto-run switches), `overclocked` and `focused` (the per-action Overclock and Focus switches), per-action `{xp, sleeveXp, runsTowardSleeveXp, augments, running, progress}`, copies owned per buyable (`purchased: Record<id, number>`), and the `inventory` (`Record<itemId, Record<rarityId, number>>`, whole counts as plain numbers capped at the largest exact integer). Items (`ItemDefinition`) and rarity tiers with their sell values (`RarityDefinition`) are content in `GameConfig.items`. Definitions (`ActionDefinition`, `BuyableDefinition`) are separate from state. Sleeve XP/level is per action. A buyable either belongs to one action (`BuyableDefinition.actionId`, displayed inside that action's card) or, with no `actionId`, to the sleeve (displayed in the Sleeve widget). Sleeve-wide effects (`interfaceSpeed`, `accessLevel`) are resolved by `resolveSleeveStats` into `SleeveStats` (access level, interface speed, heat), exposed as `GameEngine.sleeveStats()`; Interface speed is a `SpeedModifier` (a plain multiplier on every action's speed); heat is a tax on earned credits (`heatTaxFactor` with `sleeve.heatTaxPerPoint`, applied through `Economy` to run payouts and passive income) that cools down by `heatCooldownAmount` every `heatCooldownMs`, in whole points only and only while there is at least one whole point (`coolDownHeat` in `cooldowns.ts`, closed form so long ticks are cheap); access level gates actions (`ActionDefinition.requiredAccessLevel`, `GameEngine.isUnlocked`). An action's `rewardKind` decides whether a run pays credits or network nodes; nodes produce passive credits (`network.creditsPerNodePerSecond`).

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
See `docs/contexts/_limitations.md`.

