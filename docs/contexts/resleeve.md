# Context: resleeve

Re-sleeving (first prestige): gate, carry-over lists, run record, re-sleeve skills.

Code: `src/core/resleeve/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Design (from DESIGN.md)

### 11. Re-sleeving (first prestige)

- **Positive lists:** only what these name carries over: `CARRIED_OVER_ACTION_FIELDS` (each action's sleeve XP, so its sleeve level, and the run counter towards the next sleeve XP), the record of finished runs and the synthetic sleeves (`runs`, `synths`), the corporation (`corporation`: it is not the character), and the owned buyables paid in a currency of `CARRIED_OVER_BUYABLE_CURRENCIES` (the **re-sleeve skills**). Everything else resets, including anything added later; to carry something over, add it to a list. **The Retention skills add to the lists** (`core/resleeve/resleeveCarry.ts`, each only while its skill is owned): the Automation tab (Daemon Persistence), a share of Hacking Proficiency and of ICE Rating. A record of the life's action-card purchases is written at every re-sleeve for Reflex Archive.
- The button needs a second click to confirm, with a Cancel button.
- **The requirement is the Unlock resleeving purchase** (see 7): the Re-sleeve button is hidden until it is owned and disabled for `resleeve.lockoutMs` after buying it (`ResleeveGate`, a `ResleevePolicy`). The purchase itself survives re-sleeving (the `carriedOverResleeve` effect trait), as do the re-sleeve skills; other purchases reset. A game whose content has no such buyable has no gate.
- **A second requirement: sleeve levels (S9, accepted design D3).** The Nth re-sleeve also needs the total of ALL actions' sleeve levels to reach `base + perResleeve x (N - 1)` (`resleeve.sleeveLevelsNeeded`, content; N counts the re-sleeve about to happen, i.e. `runs.length + 1`). Sleeve levels carry over, so the total only grows; a save already past a threshold is simply allowed. Points stay one per re-sleeve, so nothing is saved or migrated (derived from `runs.length`). Until it is met the button is disabled and its tip says how many sleeve levels are needed in total and how many are held. Reveal: the tip exists only once Unlock resleeving is owned. A game without the field has no such gate. Real content: `base 1, perResleeve 1` (placeholders; the first re-sleeve is hardly delayed).

**Every run is written down.** At each re-sleeve the life that ends is recorded, whatever skills are owned: the **credits per second its own network was producing** (after the heat tax; synthetic income is NOT part of it, so nothing compounds) and the **total of its action levels**. The Stats tab lists the latest ten runs (newest first). The record is kept for good (only a new game clears it).

**Re-sleeve points.** One per re-sleeve (`resleeve.pointsPerResleeve`). Like skill points they are not stored: points available = earned - cost of the re-sleeve skills owned. The first re-sleeve gives the first point, and sleeve XP carrying over is what lets the run be done again faster.

**Re-sleeve skills** are a tree on the Skills tab, in a group of their own (shown once Unlock resleeving is bought; the names, texts, prices and tips of the skills read "???" until the first re-sleeve). They are kept through re-sleeving. There are **16**, in **four lanes**, each with its own root that can be bought from the first point; a skill needs the one above it (`parents`) and a price never falls down a lane (1, 2, 3, ...). Finishing the whole tree takes **38 re-sleeves**; the design intent is that once the player has most of it they stop re-sleeving, because their synthetic sleeves are copies of them, and prestige moves to the Corporation tab. Lane colours and titles are data (`ui/uiText.ts`, `ui/style.css`).

| Lane | Skill (points) | Effect |
|---|---|---|
| **Retention** (what a re-sleeve no longer wipes) | Reflex Archive (1) | At every re-sleeve the purchases on the actions' cards (paid in credits) that the life owned are written down (`lastLifePurchases`, whatever skills are owned). While this skill is owned, a new life buys them back as soon as they are affordable: as many copies as last life had, cheapest base price first, at normal prices. What a life did not rebuy is not remembered by the next. |
| | Daemon Persistence (2) | The Automation tab survives: Automation core copies, the automation skills and the settings (Auto Burn ceiling, autosale switches, dispersal shares) are carried over together. |
| | Residual Proficiency (3) | A new life starts with Hacking Proficiency `scale x log10(1 + old)` (`scale` 1, a first try to be tuned: 3 after a life that ended at 1,000). Reached on the 6th re-sleeve at the earliest. |
| | Residual Firewall (4) | A new life starts with the old ICE Rating to the power `share` (0.5, a first try): half its orders of magnitude (1e100 becomes 1e50); never below the starting 1. |
| **Reach** | Sleeve Euphoria (1) | Every ACTION level of an action needs less XP, by an amount that depends on THAT action's own SLEEVE level `L`: reduction = `1 - 0.5^log10(L)`: nothing at level 1, **50% at level 10, 75% at 100**, 87.5% at 1000; concave and never 100% (ceiling 99.9%). It multiplies with the flat reductions (Quick Study) and is not part of their cap. |
| | Deep Conditioning (2) | Faster conditioning can be bought 5 more times (95), and its floor of runs per batch of sleeve XP falls to 5 with them. |
| | Clearance Escalation (3) | Allows one more Access upgrade (a 5th copy, access level 6), meant to open the sixth action. The Access upgrade is capped at 4 copies without it. |
| | Overdrive Cap (3) | Several Focus slots may sit on one action (section 3); the Focus cell splits into add and remove. |
| **Synthetics** | Synthetic Sleeves (1) | Run extra sleeves beside the main one (below). |
| | Cloning Vats (2) | Every re-sleeve gives **two** synthetic sleeves instead of one (the one bought with Synthetic Sleeves stays single). |
| | Hive Interface (2) | Interface speed x `1 + ln(1 + synthetic sleeves) / 10` (1.24 at 10 sleeves, 1.35 at 30). |
| | Neural Mirror (3) | Every re-sleeve also writes down the **action level of every action**. An action whose level is below the highest level any synthetic sleeve reached on it earns **25% more action XP** per run (action XP only) until it catches up. The Stats tab lists each run's level per action under its row. |
| | Perfect Copies (5) | Every synthetic sleeve earns **at least** what the sleeve's own network earns now (after heat tax, without synthetic income, so there is no feedback loop): with enough synthetic sleeves the credits per second are multiplied by one plus their number. The end of the tree: from here re-sleeving stops paying. |
| **Corporation** | Incorporation (1) | Founds a corporation: opens the Corporation tab (see 11b). |
| | Synthetic Workers (2) | Corporation actions run faster: x `1 + ln(1 + synthetic sleeves) / 10`, on top of their action level. |
| | Synthetic Procurement (3) | Unlocks the option to buy synthetic sleeves on the Corporation tab. Only the unlock exists so far: it shows an empty **Synthetic Sleeves** widget there (what it does is not designed yet). |

**Synthetic sleeves (base behaviour).** Buying the skill gives **one at once**, copied from the **last finished run**; every re-sleeve after that gives one more, copied from the run that just ended. Runs that finished before the skill was bought are never copied. A synthetic sleeve keeps the numbers of its own run for good (each sleeve slot uses the run it belongs to) and earns `credits per second of that run x min(1, current action levels total / that run's action levels total)`; once the current sleeve has caught up, it stays at the full amount, so the base behaviour is a speed-up and not a source of growth (the skills of the Synthetics lane change that: Cloning Vats, Hive Interface, Neural Mirror, Perfect Copies). A run with a level total of 0 pays in full at once. **Synthetic income is not taxed by heat** (the synths paid their tax on their end) and is not multiplied by the credit lever again (the recorded value already includes it). Its value is read at the start of each slice, like the network income.

## Architecture (from docs/ARCHITECTURE.md)

### Re-sleeving and synthetic sleeves
**Re-sleeve skills** (16, four lanes in `content/buyables/resleeveBranches/`: retention, reach, synthetics, corporation; ids in `content/resleeveSkillIds.ts`). Their effect kinds are in `core/resleeve/resleeveEffectTypes.ts` (the `ResleeveEffect` part of `BuyableEffect`) with one registry entry each in `core/resleeve/resleeveEffects.ts` (spread into `EFFECTS`, like `heatEffects.ts`). `BuyableCaps` (`buyableCaps.ts`) resolves how many copies of a buyable may be owned: its `maxPurchases` plus the `buyableCapBonus` skills (Clearance Escalation: Access upgrade; Deep Conditioning: Faster conditioning, whose floor of runs falls one run per extra copy in `Progression.runsPerSleeveXp`); the `Shop`, save loading and the invariants all ask it. `focusStacking` (Overdrive Cap) sets `SleeveStats.focusStacking`; `GameState.focusStacks` holds the slots beyond the first per action, `DerivedStats.focusStatus` counts the slots (`count`, `canAdd`, `canRemove`; the speed bonus is `(1 + bonus)^count - 1`) and `ActionToggles.addFocus` / `removeFocus` change them; the Focus cell then carries a `split` view and the card draws two half buttons over it. Synthetics: `SynthSleeves` reads `synthsPerResleeve` (Cloning Vats, `addForResleeve`) and `perfectCopies` (each sleeve earns at least the network's own income, passed in as a function so it needs no `DerivedStats`); `interfaceSpeedPerLnSynths` (Hive Interface) is a sleeve hook; `synthXpBoost` (Neural Mirror) sets `SleeveStats.synthXpFactor` and `DerivedStats.xpPerRun` applies it while the action's level is below `bestSynthActionLevel` (runs are cut at level thresholds, so the factor is constant inside a batch); `Resleever` writes `SleeveRunRecord.actionLevels`. Corporation: `Corporation.workersFactor` (Synthetic Workers) divides the run time, `synthPurchaseUnlocked` (Synthetic Procurement) opens an empty widget. Retention: `resleeveCarry.ts` (`recordLastLife`, `carryRetention`, called by `resetForResleeve`) and `ReflexArchive` (`reflexArchive.ts`, a `Steppable` the engine calls each slice after the automation: it buys back `lastLifePurchases` cheapest first through `Shop.canBuy` / `buy`). Tests share setup in `core/resleeveSkillsKit.ts`.

`ResleeveGate` (`resleeveGate.ts`) and `SleeveLevelGate` (`sleeveLevelGate.ts`) are `ResleevePolicy`s, combined by `allOf` (`resleeve.ts`) in `createGame`; the engine asks the combined policy (`canResleeve`, `resleeveRequirement` -> `ViewModel.resleeveShortfall`, the button tip). `ResleeveGate`: re-sleeving needs the Unlock resleeving buyable (effect `unlockSleeveLevels`) and an empty lockout (`resleeveLockoutMs`, counted down in `GameEngine.advance`); `Progression` reads 0 sleeve levels until it is owned. The Re-sleeve button (`controls.ts`) is the purchase of that buyable until it is owned (`ViewModel.resleeveBuy`). In the UI, `ui/view/statReveal.ts` and `ui/view/sleeveGate.ts` decide what stays hidden. `ui/view/branchGates.ts` hides a whole skill branch (lane marked `hidden`, shape kept) until a stat from `statReveal.ts` is revealed; heat and ICE Rating are one linked rule. `Resleever` (`resleever.ts`) performs a re-sleeve on the live state: it writes the ending life down as a `SleeveRunRecord` (the network's own credits per second after the heat tax, and the total of the action levels), calls `resetForResleeve` (which keeps what the positive lists in `state.ts` name), appends the record to `GameState.runs` and, when the player owns the skill with the `synthSleeves` effect, gives a synthetic sleeve for it. `SynthSleeves` (`synthSleeves.ts`) answers how many sleeves there are and what they earn (`synthCreditsPerSecond`: the run's income times `min(1, current level total / recorded total)`); `NetworkSystem.payPassiveIncome` adds that income untaxed by heat. `Shop` calls a purchase listener after every purchase, which is how buying the skill gives the first sleeve. Re-sleeve points are derived like skill points (`Shop.pointsAvailable(state, currency)`: `runs.length x resleeve.pointsPerResleeve` minus the cost of the skills owned). Sleeve Euphoria (`euphoriaReduction`, `sleeveEuphoria.ts`) enters `Progression.actionXpReduction(state, actionId)`.

### Carry as data and shared formulas (S9)
What a re-sleeve carries is registry data, not kind-name checks: the `carriedOverResleeve` trait (sleeve-levels unlock, corporate rank, corporation effects) decides which owned buyables survive, and a `carry(effect, ctx)` hook on an `EffectDefinition` carries a retention skill's part (Daemon Persistence: automation and its purchases via the `automationPurchase` trait; Residual Proficiency; Residual Firewall), all in `resleeveEffects.ts`; `carryRetention` just calls the hooks of owned buyables. A new retention skill is one registry entry. `kernel/curves.ts` `synthBoost(perLn, synths, copies)` is the one `(1 + perLn x ln(1 + synths))^copies` formula used by Hive Interface and the corporation speed skill. Tests: `carryTraits.test.ts`, `sleeveLevelGate.test.ts`, `ui/resleeveShortfall.test.ts`; the old 18 KB `resleeveTree.test.ts` is split by topic over `resleevePoints`, `runRecord`, `synthSleevesPlay`, `sleeveEuphoriaPlay`, `resleeveSaving` on `testing/resleeveTreeKit.ts`.

## Configuration (from docs/CONFIG.md)

### Newer re-sleeve skill effects

Effects of buyables paid in `resleevePoints` (the lanes Retention, Reach, Synthetics and Corporation of the re-sleeve tree; `content/buyables/resleeveBranches/`). Each is sleeve-wide and applies once whatever the copies. All numbers are data on the skill.

| Effect | Fields | What it does (real content) |
|---|---|---|
| `buyableCapBonus` | `targetId` (a buyable), `extra` (integer >= 1) | The target can be bought `extra` more times than its `maxPurchases`. Faster conditioning's floor of runs per sleeve-XP batch falls one run per extra copy. Real: Clearance Escalation (Access upgrade, 1; its `maxPurchases` is 4), Deep Conditioning (Faster conditioning, 5) |
| `focusStacking` | none | Several Focus slots may sit on one action; every slot multiplies its speed by `1 + focus.speedBonus` again. Real: Overdrive Cap |
| `synthsPerResleeve` | `count` (integer >= 2) | A re-sleeve gives `count` synthetic sleeves instead of one. Real: Cloning Vats, 2 |
| `interfaceSpeedPerLnSynths` | `perLn` (> 0) | Interface speed x `1 + perLn x ln(1 + synthetic sleeves)`. Real: Hive Interface, 0.1 |
| `synthXpBoost` | `factor` (> 1) | An action below the level a synthetic sleeve reached on it earns `factor` x the action XP per run. Real: Neural Mirror, 1.25 |
| `perfectCopies` | none | Every synthetic sleeve earns at least the credits per second of the sleeve's own network now. Real: Perfect Copies |
| `corporationSpeedPerLnSynths` | `perLn` (> 0) | Corporation runs take `1 / (1 + perLn x ln(1 + synthetic sleeves))` of their time. Real: Synthetic Workers, 0.1 |
| `unlocksSynthPurchase` | none | Opens the empty Synthetic Sleeves widget on the Corporation tab. Real: Synthetic Procurement |
| `autoRepurchase` | none | A new life buys back last life's action-card purchases (credits) as soon as they are affordable, cheapest first. Real: Reflex Archive |
| `keepsAutomation` | none | The Automation tab (core copies, automation skills, settings) survives a re-sleeve. Real: Daemon Persistence |
| `carriesProficiency` | `scale` (> 0) | A new life starts with Hacking Proficiency `scale x log10(1 + old)`. Real: Residual Proficiency, 1 (to be tuned) |
| `carriesIceRating` | `share` (in (0, 1]) | A new life starts with the old ICE Rating to the power `share` (never below the start). Real: Residual Firewall, 0.5 (to be tuned) |

The Access upgrade is capped at 4 copies in the real content (`maxPurchases: 4`, access level 5).

### `resleeve`
| Field | Meaning |
|---|---|
| `pointsPerResleeve` | Re-sleeve points given for each re-sleeve (integer >= 1; real content: 1) |
| `lockoutMs` | Game time in ms after buying the Unlock resleeving buyable during which re-sleeving is refused (>= 0, optional, default 0; real content: 5000) |
| `sleeveLevelsNeeded` | Optional `{ base, perResleeve }` (numbers >= 0): the Nth re-sleeve needs `base + perResleeve x (N - 1)` sleeve levels in total over all actions; leave out for no such gate (real content: 1 and 1, placeholders) |
| `runsShown` | How many of the latest finished sleeve-runs the Stats tab lists (integer >= 1; real content: 10) |

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-25 (by the user, items)*
- **Re-sleeve is a positive list:** only what `CARRIED_OVER_ACTION_FIELDS` (`core/save/state.ts`) names carries over (sleeve XP and its run counter); everything else resets. Paying out Kompromat is blackmail, not a sale, and the tooltip says so.

*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Shape:** the re-sleeve tree is 16 skills in four lanes with their own roots (Retention, Reach, Synthetics, Corporation), prices rising down each lane (1, 2, 3, ...; Residual Firewall 4; Perfect Copies 5), 38 points in all. One point per re-sleeve, so the intent is that the player stops re-sleeving near the end and prestige moves to the Corporation tab. Succession was dropped: Perfect Copies is the end. Synthetic Sleeves and Incorporation no longer need Sleeve Euphoria (a parent must be in its own lane).

*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Reflex Archive** (widened by the user to all action-card variables): rebuys what the LAST life owned on action cards (credits, not nodes; not sleeve-wide purchases, which the assistant chose to leave out), as many copies as before, cheapest first, as soon as affordable. The record is rewritten at every re-sleeve, so what a life does not rebuy is forgotten.

*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Residual Proficiency / Residual Firewall:** the user asked for a log of proficiency ("try something") and, in a separate later skill, a share of ICE Rating. First tries, to be tuned: proficiency `1 x log10(1 + old)`, ICE `old ^ 0.5` (half of its orders of magnitude, since ICE works per order of magnitude). Residual Proficiency lands on the 6th re-sleeve at the earliest through its place in the lane, with no special gate.

*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Clearance Escalation:** the Access upgrade is capped at 4 copies (access level 5), the skill allows a 5th. No sixth action exists yet. **Deep Conditioning** ("lower the floor to five"): 5 more Faster conditioning copies and the floor falls one run per extra copy; both use the generic `buyableCapBonus`.

*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Neural Mirror** (reframed by the user): 25% more action XP while an action is below the best level a synthetic sleeve reached on it, so every re-sleeve now writes down every action's level (`SleeveRunRecord.actionLevels`, shown in the Stats tab). Old records without levels give no bonus.
