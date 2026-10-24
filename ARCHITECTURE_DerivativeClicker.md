# Derivative Clicker – Architecture Overview

Source analysed: `C:\Code\DerivativeClicker-gh-pages` (version 0.341, Jan 2015).
A static, client-only incremental/"clicker" game. No build step, no backend; state lives in a single global `player` object persisted to `localStorage`.

## 1. File map

| File | Lines | Role |
|---|---|---|
| `index.html` | 746 | Main page: layout, 5 jQuery-UI tabs, Underscore `<script type="text/template">` templates, inline `onclick` handlers, script loading, donate-link snippet |
| `newplayer.html` + `guide.css` | 171 | Standalone "How to Play" guide (static) |
| `js/data.js` | 199 | Initial state (`startPlayer`), partial-reset states (`resetPlayer`, `infiniResetPlayer`), constants |
| `js/building.js` | 27 | Three constructors: `Building`, `CurrBuyable`, `Achievement` |
| `js/script.js` | 1160 | All game logic: economy helpers, save/load, resets, rendering, purchases, main tick loop |
| `js/charts.js` | 124 | Highcharts "Money vs Time" graph and its settings |
| `*.css` | – | `derivative_clicker.css` (game), jQuery-UI theme, tooltipster (+noir theme) |
| `changelog.txt`, `README.md` | – | Version history (README is a stub) |
| `img/` | – | bitcoin/dogecoin donate images |

**Dependencies:** jQuery 1.10.2, jQuery UI 1.10.4 (tabs), Underscore (`_.template`), Highcharts, Tooltipster 3.0.5, Google Analytics (`ga(...)`).
Note: `index.html` references local `js/libs/*` which is **not in the repo**; it only works because the same libraries are also loaded again from CDNs (so they are loaded twice).

### Script load order (matters – all globals)
`building.js` → `data.js` → `script.js` → `charts.js`.
`data.js` needs the constructors; `script.js` needs `startPlayer` and the templates in the DOM; `charts.js` needs `player` and `displayNum`.
Quirk: `data.js` uses `versionNum` inside `startPlayer` *before* the `var versionNum = 0.341` line (hoisted → `undefined` at that point; `versionControl` repairs it).

## 2. High-level architecture

```
                       ┌──────────────────────────────┐
                       │ data.js: startPlayer / reset │
                       │ templates / constants        │
                       └──────────────┬───────────────┘
                                      │ deepObjCopy
                                      ▼
   user input ──onclick──►  global `player` state  ◄── load()/importSave()  ◄── localStorage
   (HTML handlers,                    │                  save() (every 60 s) ──►
    #moneyButton click)               │
        │                             │ read/mutate
        ▼                             ▼
  buy*/reset/infiniReset      update()  (self-rescheduling setTimeout tick loop)
        │                             │
        └────────────┬────────────────┘
                     ▼
        update* functions (Underscore templates → $.html())
                     ▼
                    DOM          charts.js samples player.money on its own timer
```

Pattern summary:
- **Single mutable global state** (`player`), plus small globals `globalMult[]`, `upgradeCostFactor[]`, `numTiers`, `enableChart`, `isActive`.
- **Imperative tick loop** (`update`) instead of events; rendering is "re-template and replace innerHTML" per tab.
- **Data-driven buildings:** a flat `player.buildings[35]` array; index math (`5*tier + slot`) encodes meaning everywhere.
- **Prestige layers:** reset (tiers 1–7, "reset currency") and infini-reset (when money overflows to `Infinity`).

## 3. Domain model

### Buildings (`player.buildings[0..34]`, 7 tiers × 5 slots)
Slot within tier (`index % 5`) and what it does:

| Slot | Role | Effect in `buyBuilding` / `update` |
|---|---|---|
| 0 | Derivative *n* (deriv1…7) | Tier 1: produces money/s. Higher tiers: generate slot-0 of tier below on each building period |
| 1 | Proof-generating building (combinatorics, probability, number theory, calculus, algebra, geometry, arithmetic) | Tier 1: converts money → proofs (`costPerProof` = $5). Higher tiers: feed lower tier slot 1 |
| 2 | Proof-cost building (computer, assembly line, factory, factory architect, design school, dean of architecture, chancellor) | Tier 1: +2 money/s. Costs proofs, produces 3× the lower-tier slot 2 |
| 3 | Clicker building (high schooler, undergraduate, graduate student, postdoc, research scientist, lab manager, research lab) | Tier 1: +0.1 money/click. Higher tiers grow lower tier slot 3 on every "click period" (`moneyButtonClick`) |
| 4 | Mathematician line (mathematician, Andrew Wiles, Kurt Gödel, Riemann, Gauss, Euler, Newton) | Tier 1: speeds up tick (`updateInterval`) and feeds reset currency; others feed lower tier slot 4 |

Constructor `Building(factor, moneyCost, proofCost)` → `{owned, manual, factor, moneyCost, proofCost}`. `owned` includes generated units; `manual` counts only bought units (used by `calcMult`).
Cost growth is geometric: price × `factor`^n; bulk price = `calcTotalPrice`.

### Other state groups in `player`
- **Currencies/rates:** `money`, `moneyPerSecond`, `netMoneyPerSecond`, `moneyPerClick`, `moneyPerAutoclick`, `proofs`, `proofsPerSecond`.
- **Upgrades:** `tierUpgrades[7]` / `tierUpgradeCosts[7]` (per-tier multiplier, cost ×1000 each), `upgrades[2]` / `upgradeCosts[2]` (0 = autoclicker ×1.5, 1 = click improver ×100); `mult[7]` derived multipliers.
- **Prestige:** `resetCurr[7]`, `numResets[7]`, `resetCurrTracker`, `resetCurrFactor`, progress trackers `proofsToNextCurr`, `mathematiciansToNextCurr` (+ `…Tracker`), `currBuyables[24]` (`CurrBuyable`: `{owned, cost[6]}`; 4 columns × 6: unlock tiers 5–7 & cost-factor reducers / click improvers / building-tick reducers / autoclick-tick reducers & reset-currency factor reducers).
- **Infini:** `infiniCurr`, `infiniResetDone`.
- **Tick/time:** `updateInterval`, `timeMult`, `minTickLength`, `buildingInterval`, `autoclickInterval`, `clicksToGain`, `clickTracker`.
- **Stats/achievements/settings:** `total*`, `achievements[]` (`Achievement`), `sciNotation`, `chartDelay`, `chartLength`, `numToBuy`, `versionNum`.

### State lifetimes (the three init objects in `data.js`)
- `startPlayer` – full new game.
- `resetPlayer` – merged (`$.extend(true…)`) over `player` on tier reset: wipes money, buildings, upgrades; **keeps** stats, achievements, `resetCurr`, `currBuyables`, settings.
- `infiniResetPlayer` – merged on infini-reset: additionally wipes `resetCurr`, `numResets`, `currBuyables`, trackers, stats; keeps achievements, `infiniCurr`, settings.

## 4. Function / method reference

### 4.1 `js/building.js`
| Symbol | Purpose |
|---|---|
| `Building(factor, moneyCost, proofCost)` | Building record constructor |
| `Building.prototype.add(num)` | `owned += num` (unused by game code) |
| `CurrBuyable(cost, text)` | Reset-currency purchasable; `text` param unused |
| `CurrBuyable.prototype.buy()` | Sets `owned = true` (unused; `buyCurrBuyable` mutates directly) |
| `Achievement(name, text, condition)` | `condition` is a **string** compiled with `new Function("return …")` |

### 4.2 `js/data.js`
Only data: `startPlayer`, `resetPlayer`, `infiniResetPlayer`, `versionNum` (0.341), `upgradeCostFactor` `[1.5, 100]`, `globalMult` `[1×7]`, `numTiers` (7). 31 achievements are defined inline in `startPlayer.achievements`.

### 4.3 `js/script.js` (grouped by responsibility)

**State mutators / economy math**
| Function | What it does |
|---|---|
| `addMoney(m)` | Adds to money (2-dp rounding), tracks `totalMoneyEarned`, clamps ≥ 0 |
| `addMoneyPerSecond`, `addNetMoneyPerSecond`, `addMoneyPerClick` | Rounded increments of rate fields |
| `addProofs(p)` | Adds proofs, decrements `proofsToNextCurr`, charges `costPerProof` |
| `calcMult(tier)` | `player.mult[tier-1] = 1 + tierUpgrades × factor[tier] × Σ manual(tier's 5 buildings)`; factors `[.0005,.002,.005,.01,.02,.04,.06]` |
| `calcGlobalMult()` | `globalMult[i] = 1 + resetCurr[i] × 0.01` |
| `calcTotalPrice(price, factor, n)` | Geometric series sum – cost of buying *n* |
| `checkAchievement(i)` | Evaluates condition once; stamps `achieved`/`time` |
| `factorial(n)` | Utility, unused |

**Utilities**
| Function | What it does |
|---|---|
| `displayNum(num, ifMoney)` | Formats with K/M/B…Sg suffixes or scientific notation (`player.sciNotation`) |
| `getNumToBuy(num)` | Sets buy amount (`-1` → `"Max"`), refreshes labels/inventory |
| `cloneFunc(fn)` | Re-creates a function from its source text (for Achievement conditions) |
| `deepObjCopy(obj)` | Custom deep clone (arrays, objects, functions; loses prototypes) |
| `ifUnlockedTier(tier)` | `currBuyables[tier-5].owned` |
| `ifMoreDerivs(tier)` | Text snippet for reset confirmation (currently unused) |

**Persistence / versioning**
| Function | What it does |
|---|---|
| `init()` | `player = deepObjCopy(startPlayer)` |
| `save()` | Writes `playerStored` + `enableChart` to localStorage, updates "last save", sends GA event |
| `load()` | `$.extend(true, player, stored)` |
| `wipe()` | Confirmed full reset to new game |
| `exportSave()` / `importSave()` | Base64(JSON) export/import; import calls `versionControl(true)` |
| `fixJSON()` | Rehydrates achievement `time` strings into `Date` |
| `versionControl(ifImport)` | Migration ladder keyed on `player.versionNum` (wipes < 0.22; patches 0.3, 0.32, 0.33, 0.34) |

**Settings**
`toggleSciNotation()`, `setMinTickLength()` (prompt; recomputes `timeMult`).

**Prestige**
| Function | What it does |
|---|---|
| `reset(tier)` | Needs 7e9 mathematicians of that tier; confirm dialog; cascades reset currency up tiers (`resetCurrFactor`), merges `resetPlayer`, re-applies factor reducers (buyables 3–5), `updateAll()` |
| `infiniReset()` | Triggered when `money` becomes non-finite; merges `infiniResetPlayer`, `infiniCurr++`, recalcs multipliers |

**Rendering** (each = fill Underscore template with `displayNum` values → `$(sel).html(...)`)
| Function | Target / notes |
|---|---|
| `updateMoney()` | `#info` header table |
| `updateInventory()` | `#firstRows`, `#row5–7` (rows 5–7 only if unlocked); lights buttons (`button` ↔ `buttonLit`) by affordability |
| `updateUpgrades()` | `#upgrades`; hides tier 5–7 rows; button lighting |
| `updateStats()` | `#statContainer` |
| `updateAchievements()` | Diffs earned achievements vs DOM, builds tooltipster-decorated divs, counts |
| `updatePrestige()` | `#prestige`; hysteresis (thresholds 2/1) toggling "to-next" vs "per-tick" displays |
| `updateResetCurrBuyables()` | Marks owned/affordable/locked reset buyables, updates tooltips; handles DOM-vs-data index reordering |
| `updateResetCurrBuyablesTitles()` | Sets the 24 tooltip texts |
| `updateInfini()` | Renders Infini tab and creates/removes the tab dynamically |
| `updateAll()` | Calls all of the above |

**Actions (UI-triggered)**
| Function | What it does |
|---|---|
| `moneyButtonClick(amount)` | Adds click money; every `clicksToGain` clicks triggers click-building cascade (slot 3 → lower tiers); bulk path avoids loops when > 5000 periods. Also used by autoclicker |
| `buyBuilding(i)` | Resolves count ("Max" by loop), pays money/proofs, raises cost, recomputes `mult`, applies per-building rate effects (switch on index 0–4) |
| `buyTierUpgrade(i)` | Per-tier multiplier upgrade (cost ×1000 each) |
| `buyUpgrade(i)` | 0 = autoclicker, 1 = click power |
| `buyCurrBuyable(i)` | Checks chain/cost; applies effect by index (factor reduction, `clicksToGain`, `buildingInterval`, `autoclickInterval`, `resetCurrFactor`) |

**Game loop**
| Function | What it does |
|---|---|
| `update` (function expression) | Main tick (see §5) |
| `inventoryAdder(amount)` | Every `buildingInterval` ticks: higher-tier buildings generate lower-tier ones (slots 0,1,4 ×1; slot 2 ×3), and mathematician line reduces `mathematiciansToNextCurr`; fast path when `amount ≥ 250` |

**Bootstrap**: `$(document).ready(...)` – init tabs, load, `versionControl`, `fixJSON`, capture original reset-buyable titles/HTML, attach tooltips, `calcMult` for all tiers, `calcGlobalMult`, `updateAll`, bind `#moneyButton` click. Then: `setTimeout(update, …)` and `setInterval(save, 60000)`. Window focus/blur set `isActive`.

### 4.4 `js/charts.js`
Inside one `$(function(){…})`: `Highcharts.setOptions`, creates an areaspline "Money vs Time" chart (log y-axis, `displayNum` label/tooltip formatters). Chart `load` event installs `chartTimeoutRunner`, a self-rescheduling timer (`player.chartDelay`) that appends `player.money` (shifts at `player.chartLength`, clears data when `enableChart` false). Handlers: `#chartAxisToggle` (log↔linear), `#submitChartSettings` (validates delay ≥ 500 ms, points 1–10000). Globals: `enableChart`, `chartTimeout`, `chartTimeoutRunner`.

### 4.5 HTML entry points (inline handlers in `index.html`)
`updateInventory/Upgrades/Prestige/Stats` (tab clicks), `getNumToBuy`, `buyBuilding(0..34)`, `buyTierUpgrade`, `buyUpgrade`, `buyCurrBuyable`, `reset(tier)` (`#reset`, `onmousedown`), `wipe`, `save`, `exportSave`, `importSave`, `toggleSciNotation`, `setMinTickLength`, chart-toggle, plus `updateInfini()` on the dynamic Infini tab. Templates: `moneyTable`, `inventory`, `row5–7`, `upgrades`, `stats`, `prestige`, `infini`.

## 5. Tick loop (`update`)

```
update()
 ├─ elapsed since last run; if window inactive, accumulate catch-up "intervalTracker"
 ├─ do { (repeats to simulate missed time while tab hidden)
 │    ├─ addMoney from deriv1 + computers (× mult × globalMult × timeMult)
 │    ├─ addProofs (limited by money)
 │    ├─ every buildingInterval  → inventoryAdder(n)
 │    ├─ every autoclickInterval → moneyButtonClick(autoclickers × n)
 │    ├─ reset-currency from proofs   (loop, or closed-form 7th-root approximation when huge)
 │    ├─ reset-currency from mathematicians (same)
 │    ├─ recompute moneyPerClick / moneyPerSecond / proofsPerSecond / net / autoclick
 │    ├─ counters += timeMult; totalTicks
 │    └─ updateInterval = 1000 × 0.98^ln(mathematicians×mult×global + 1)
 │   } while (inactive catch-up remaining)
 ├─ if money not finite → infiniReset()
 ├─ refresh only the active tab (0 inventory, 1 upgrades, 2 prestige, 4 stats+achievements) + updateMoney()
 ├─ raise timeMult while updateInterval×timeMult < minTickLength
 └─ setTimeout(update, updateInterval × timeMult)
```

## 6. Call graph (condensed)

```
ready ─► load, versionControl, fixJSON, calcMult×7, calcGlobalMult, updateAll
update ─► addMoney, addProofs, inventoryAdder, moneyButtonClick, infiniReset,
          updateInventory | updateUpgrades | updatePrestige | updateStats+updateAchievements, updateMoney
moneyButtonClick ─► addMoney, addMoneyPerClick, updateMoney, updateInventory
buyBuilding ─► calcTotalPrice, addMoney, calcMult, add*PerSecond/Click, updateMoney, updateInventory
buyTierUpgrade/buyUpgrade ─► calcTotalPrice, addMoney, (calcMult), updateUpgrades, updateMoney
buyCurrBuyable ─► calcGlobalMult, updatePrestige, updateResetCurrBuyables
reset ─► displayNum, calcGlobalMult, deepObjCopy(resetPlayer), updateAll, ga
infiniReset ─► deepObjCopy(infiniResetPlayer), calcMult×7, calcGlobalMult, updateAll
importSave ─► init, versionControl, fixJSON, save, calcGlobalMult, updateAll
wipe ─► init, calcGlobalMult, updateAll
update* (render) ─► displayNum, ifUnlockedTier, calcTotalPrice, template()
charts.js ─► player.money, displayNum
```

## 7. Observations and risks

- **Magic index arithmetic** (`5*i+3`, `Math.ceil(index/5.0+0.1)`, `(i%6)*4+⌊i/6⌋`) is the main comprehension and bug risk; the 4×6 reset-buyable grid is stored column-major but laid out row-major in the DOM.
- `updateInventory`/`updatePrestige`/`updateUpgrades` hard-code every field by hand (~35 buildings, 7 tiers); data-driven loops would shrink them massively.
- `data.js` duplicates the buildings and currBuyables lists three times; `resetPlayer`/`infiniResetPlayer` must be kept in sync manually.
- Achievements use string-compiled conditions (`new Function`); `deepObjCopy` + `cloneFunc` exist to keep them working after JSON round-trips (JSON drops functions, so `$.extend` onto a fresh `player` restores them).
- Saves round-trip prototypes away: after `load()`, `Building`/`CurrBuyable` methods are not guaranteed (currently harmless as the methods are unused).
- `reset()` uses `onmousedown`, and `reset` message says "You must have" + number without spaces (cosmetic).
- Implicit globals: `i` in several `for(i = …)` loops, `buttonList` in `updateUpgrades`; `ga()` is called unguarded (breaks if analytics blocked).
- Libraries loaded twice (local `js/libs` missing + CDN copies); `underscore` 1.6.0 from CDN.
- Dead code: `factorial`, `Building.add`, `CurrBuyable.buy`, `ifMoreDerivs`, `CurrBuyable` `text` argument.
- Floating point: money and costs rounded to 2 dp, large-number paths use closed-form approximations with a fudge factor (`1e106` branch) – possible drift at extreme scales.
