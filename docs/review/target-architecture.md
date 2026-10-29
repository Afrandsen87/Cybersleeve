# Target architecture: bounded contexts

Goal: each mechanic has one owner, one service, one doc slice, one test folder. Folder map (every `src/core` file, old to new) is in `file-map.md`.

## Dependency direction (arrows point to what may be imported)

```
 ui  ------------------------------+        content (data) --> core types only
  |                                 v
 app (loop, persistence, createGame)
  |
 engine/   (facade, api queries, tick order)           L5
  |
 prestige layers:  resleeve  ->  synth  ->  corporation       L4
  |
 domain:  actions -> heat, crits, items, economy, skills,
          automation, sleeve (stats)                          L3
  |
 effects/  (kinds, registry, traits, queries)                L2
  |
 kernel/   (infinity, overflow, fields, sampling, curves,
            snapshot, diagnostics, shared ids)               L1
  |
 numbers/  (BigNum adapter)                                  L0
```
Rules:
- A context imports only lower layers, or same-layer contexts listed under *Allowed deps*, through the target's `index.ts` (its public API). Reaching into another context's file is a violation.
- `save/` sits beside the engine: it may read every context's `serialize/restore` hook, but no context imports `save/`.
- `core` never imports `app/`, `ui/` or `testing/`. Test kits live in `src/testing/`.
- Contexts talk through narrow `*Queries` interfaces (the `api.ts` pattern). The engine wires them; contexts take what they need as constructor arguments.
- Effect-kind entries are written in the context that owns the behaviour (for example heat kinds in `heat/`) and registered into `effects/registry`. "One kind = one union member + one entry" stays true; the entry file moves, the registry table does not grow in one file.

## Contexts

Each has: responsibility; public interface (`index.ts` exports); state it owns; allowed deps.

| Context | Responsibility | Public interface | Owns state | Allowed deps |
|---|---|---|---|---|
| `kernel` | Number safety, clamps, sampling, curve helpers, memo cache, diagnostics, shared id types | `clampInfinity`, `repairBig`, `binomial/multinomial/perRunEvents`, `orders/wholeOrders/logScaled`, `Snapshot` | none | numbers |
| `effects` | Effect kind unions, registry, traits, accumulator, `resolveEffects`, `ownedOfKind` | `EffectQueries`: `resolve(action)`, `resolveSleeve()`, `ownedOfKind(kind)` | none | kernel |
| `actions` | Action definitions, runner, toggles, speed, levels/XP, rewards (`payRun`), Overclock/Focus, linked payouts, completion effects | `ActionQueries`, `ActionCommands`, `RewardPayer` | `actions[...]`, `chains`, `overclocked` | effects, heat, crits, items, economy, sleeve (by interface) |
| `heat` | Heat gain, tax share, cooldown cycle, moles, Legend speed-up, `coolsNow`; the UI reads, never re-derives | `HeatQueries`: `taxShare`, `cycleMs`, `coolsNow`, `moleBonus`, `gain(slice)` | `heat`, `moles` | effects, kernel |
| `crits` | Crit chance, settle, max per run, cover (banked / zero-day / admin key), links, feed | `CritQueries`: `chance`, `cover(id)`, `maxPerRun(id)`; `CriticalSuccesses.settle` | `bankedCriticals`, toggles | effects, items (zero-day/admin key stacks) |
| `items` | Inventory, rarities, drops, rarity shift, burn leads, skill shards, augments, back channel, kompromat sale | `Inventory.take/add/addFirst`, `ItemDrops.roll`, `DropQueries.share(rarity)` | `inventory` | effects, kernel |
| `economy` | Currencies (data registry), shop/price, network, passive income, heat tax on income | `ShopQueries`, `CurrencyRegistry`, `IncomeQueries` | `credits`, `network`, `purchased` | effects, heat (tax share), kernel |
| `skills` | Skill trees, parents, skill points, shards effects, reveal gates for skills | `SkillQueries` | `purchased` (skill ids) | effects, economy |
| `automation` | Automation points, lanes, Auto Burn / Autosale / Dispersal | `AutomationQueries/Commands` | `automation` | items, economy, heat |
| `sleeve` | Sleeve stats (access, ICE, hacking proficiency, Euphoria), sleeve levels, derived `SleeveStats` | `SleeveQueries` | `iceRating`, `legend`, `hackingProficiency` | effects, heat |
| `resleeve` | Re-sleeve gate, carry lists (data), run record, points, reflex archive, retention | `ResleeveQueries`, `Resleever` | `runs`, `lastLifePurchases` | sleeve, economy, items, skills |
| `synth` | Synthetic sleeves as records (cps scalar + level map), copy income, Neural Mirror, Perfect Copies | `SynthQueries`: `count`, `income`, `boost()` | `synths` | resleeve, sleeve |
| `corporation` | Corporation state keyed by id, actions, levels, stocks, rank | `CorporationQueries` | `corporation` map | synth (`boost()`), economy, items |
| `save` | Save text read/write, version, migrations, wipe | `SaveCodec` | none (reads every context's hooks) | all (one-way) |
| `engine` | Tick order, facade `GameEngine`, `api.ts` query/command unions | `GameQueries`, `GameCommands` | none | all lower |

## Object / service design (where a class replaces free functions + type-switches)
1. **`RewardPayer`** (actions): one `payRun(def, runs, multiplier, kind)`; Overclock `alsoPays`, `paysActionReward`, crits call it. Removes P6-P8.
2. **`HeatModel`** (heat): holds the tax formula, cycle length, `coolsNow`, `gain` for tick and run slices. UI view-models take it as an input. Removes P4, P5, P15.
3. **`CriticalCover`** inside `crits`: `claim`, `covered`, `maxPerRun`. Removes P1, P2.
4. **`Inventory.take/addFirst`** plus `DropQueries.share`: removes P12 repeats.
5. **`EffectRegistry` traits**: kind-level traits (`carriedOver`, `synthMultiplier`, `ownedQuery`) replace `if (kind === ...)` chains (see findings-code, kind-logic list). Switches over kinds end in `assertNever`.
6. **`CurrencyRegistry`** (data in `content/`): replaces the closed `Currency` union and the literals in `shop.ts`, `engine.ts`, `resleeveCarry.ts`, `state.ts`.
7. **`SleeveState` vs `Wallet`**: shared things (credits, items, points) vs per-sleeve things. One live sleeve now; records for synths later.
8. Keep: engine mutates no state itself, `GameEngine` as a thin facade, DI everywhere.

## Folder map summary
Files move to `src/core/<context>/`; each folder has `index.ts` (public API), `types.ts` (its types only), implementation files, `*.test.ts`. A `src/core/index.ts` barrel re-exports the old names during migration so imports stay stable until the last step.

## Boundary enforcement
`src/core/boundaries.test.ts` (new, Step 0): reads source imports and fails when a file imports a non-`index` file of another context, or imports upward. Starts with an allow-list of today's violations that each step shrinks to empty. This is what makes parallel mechanics hard to write by accident: the second path would have to reach into another context.

## Test and doc layout per context
```
src/core/<ctx>/<file>.ts, <file>.test.ts
src/testing/<ctx>Kit.ts      shared setup (gameKit, buyableKit, corporationKit, domMountKit, existing kits)
docs/contexts/<ctx>.md       responsibility, interface, state, config variables, DESIGN excerpt, DECISIONS history
docs/contexts/README.md      index: context -> files, doc, kit, owner service
```
`DESIGN.md`, `ARCHITECTURE.md`, `CONFIG.md`, `DECISIONS.md` become thin indexes (under 8 KB each) that link into `docs/contexts/`. Cross-cutting content (concept, screen/reveal, time, commands, hosting, SOLID) stays in the indexes. Archive: ARCHITECTURE "Deploy changelog", CONFIG "Newer re-sleeve skill effects", DECISIONS entries superseded (outputMultiplier, unlock rules, lane renames) into `docs/archive/`.

Doc slice map (from the doc survey; sizes approximate): DESIGN 3 (7.5K) -> actions+heat+crits+items; DESIGN 8 (7.8K) -> skills+heat; DESIGN 10 (7.9K) -> items+augments; DESIGN 11 (7.2K) -> resleeve+synth; DESIGN 11b -> corporation; ARCHITECTURE "Layering" (13.8K) -> split across all; ARCHITECTURE "Tick loop" (7.2K) -> engine+actions+automation; CONFIG `buyables[]` (15.1K) -> per owning context. Automation and re-sleeve are described in three docs each today; one context doc replaces three copies.
