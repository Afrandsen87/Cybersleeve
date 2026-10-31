# Context: automation

Automation points, lanes and features.

Code: `src/core/automation/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Design (from DESIGN.md)

### 8b. Automation

The **Automation** tab holds features that play part of the game for the player. They are paid for with **automation points**: the only source for now is the sleeve buyable **Automation core** (1,000,000 credits, x100 per copy, unlimited; one point per copy). Nothing is stored for points: points available = points earned (copies owned) - the price of the automation skills owned. **Each feature has its own line of automation skills inside its box** (a chain of up to 10 slots drawn like the skill tree, always shown in full, in the colour of its lane: Auto Burn purple, Compromat Autosale yellow, Augment Dispersal cyan; the box's heading is the lane's title). **The first skill of a lane IS the unlock:** there is no separate Unlock button, the player just clicks the first node (1 automation point) and chooses which feature gets the first point, and the controls of the box show once it is owned. The other eight skills of the Auto Burn lane are real (below); the other two lanes are still PLACEHOLDERS (1 automation point each, no effect): they will become progressively more complicated versions of that automation. Points, unlocks, automation skills and settings reset by re-sleeving, with the purchases they depend on (ASSUMPTION, like skills) **unless the Daemon Persistence sleeve skill is owned** (section 11): then the Automation core copies, the automation skills and the settings are all carried over together, so points available stay balanced and a new life gets no extra points. Every feature works in closed form per slice of game time.

| Feature | What it does |
|---|---|
| Auto Burn | **The Burn lead becomes an Inventory toggle** (`AutoBurn`, `autoBurn.ts`; rules in `autoBurnRules.ts`, state shapes in `autoBurnTypes.ts`). There is no on/off button in the Automation tab; each switch and input below shows only once its skill is owned (new switches start OFF). Per slice, in this order: (a) with the upper switch and heat REACHING the Redline (rising to it from below; `sleeve.autoBurn.upperArmed` is cleared when it fires and set again once heat is below the threshold, so a player can switch the toggle off while heat stays up) the toggle is switched on once; (b) while the toggle is on and heat is at least 1 (`heatNeedsCooling` in `heat/heat.ts`: the cooldown removes whole points only, so a fraction below 1 counts as cooled and uses no lead), **one lead a second** (a fractional-second counter in the sleeve state, closed form per slice) or, with Hold, just enough leads to bring heat down to the Floor, or below 1 when that is lower (`BurnLeads.leadsNeeded(heatHoldTarget(lower))`), none at or below it; never below the reserve (the available leads are held minus reserve, and 0 while leads cannot be used: an Overclock that stops heat cooling is running, `BurnLeads.usable`); (c) **with the toggle on**, out of leads (available = 0) while heat is above the Floor: the off rules switch heat-making Overclocks and/or the Auto-run of heat-making actions OFF and record what they switched; (d) heat below the Floor with leads available: the on rules switch ON every ticked owned Overclock / Auto-run that is off (the resume checklists in `wallet.automation.autoBurn.resumeOverclocks` / `resumeAutoRuns`, set by `setResumeOverclock` / `setResumeAutoRun`; even ones the player switched off by hand), and when one changed, the toggle on (switching in `autoBurnSwitcher.ts`). Every switch is independent of the others. The off record (`overclocksOff` / `autoRunsOff`) is kept for the re-sleeve carry; a hand switch clears it. "Makes heat" has one owner (`core/heat/heatMakers.ts`, which also lists the Overclocks and Auto-runs Auto Burn may switch: an action with `heatPerRun`/`heatPerSecond` > 0; an Overclock when its `heatPerMinute` > 0 or its action makes heat); the UI reveal rule calls it too. Switching goes through `ActionToggles.setOverclock` and `Shop.setOn`, set explicitly, never flipped. |
| Kompromat autosale | **Its first skill unlocks it for every rarity.** A switch per rarity; each slice sells everything held of the switched-on rarities, for every item that can be sold, at the normal price (no tax, no credit lever). Items that cannot be sold (Augment schematics, leads, ...) are never touched. Back Channel Deals needs common Kompromat, so switching common on competes with it. |
| Augment dispersal | A share (0-100%) per action. Each slice every Augment schematic held is applied to the actions by their shares, relative to each other (1 and 1 is 50/50), most common rarity first; schematics that do not divide evenly go to the largest remainders, so none is lost. An action at 0% gets none, and so does an action whose Auto-run is not owned (switched off still counts): its part of the split is not applied that round and its schematics stay in the inventory, none consumed or lost. With every share at 0 nothing happens and the Augment buttons work as before. |

The Auto Burn panel shows a status line (STANDBY, IDLE, BLOCKED, DRY, HOLDING or BURNING), heat, held leads and the display-only Inventory toggle. Each owned skill reveals its part: the Floor strip and THROTTLE, the Redline notch and REDLINE row, FAILSAFE target chips, RESTART target sub-rows, editable Floor/Redline values, then Reserve. Empty restart lists remain visible with a muted explanation. Floor and Redline stay fixed until Tune Thresholds; Reserve counts leads kept untouched. The heat strip spans 0..max(1.5 x Redline, Floor + 1), with overflow heat pinned at the edge while its label retains the real value. Activity, firing flags and lead availability come only from `autoBurnStatus.ts` through `AutoBurnControls.status()`; the same owner supplies the off/on conditions used by Auto Burn.

### The Auto Burn lane (decided 2026-10-30, by the user)

| Skill | Name | Adds |
|---|---|---|
| 1 | Burn Toggle | `unlocksAutomation` (feature `autoBurn`): Burn leads become an Inventory toggle (one lead a second while on and heat > 0). Before it, clicking the tile uses one lead. |
| 2 | Hold Down | `autoBurnStep: hold`: THROTTLE switch (Floor 20 = `automation.autoBurnCeiling`, fixed until the Tune Thresholds skill). |
| 3 | Redline Trigger | `upper`: REDLINE row switch (70 = `automation.autoBurnUpper`, fixed until skill 9). Independent of Hold. |
| 4 | Cool Overclocks | `offOverclocks`: with the toggle on and out of leads above the Floor, switch heat-making Overclocks off. |
| 5 | Cool Auto-runs | `offActions`: also switch off the Auto-run of heat-making actions. |
| 6 | Resume Auto-runs | `onActions`: heat below the Floor with leads available, switch on the Auto-runs ticked in the checklist under the switch (owned, heat-making; even ones switched off by hand), and the toggle. |
| 7 | Resume Overclocks | `onOverclocks`: also the ticked Overclocks (its own checklist). |
| (8) | removed | Pick Targets is gone and slot 8 stays empty (`AUTO_BURN_EMPTY_SLOTS`) so the saved skill ids of the later skills stay stable. |
| 9 | Tune Thresholds | `thresholds`: edit both thresholds (finite, 0 <= lower < upper). |
| 10 | Lead Reserve | `reserve`: a number of Burn leads always kept (stockpile for a later corporation mechanic). |

Interpretation notes: the toggle does not switch itself off when the leads run out or heat is 0 (it just does nothing then). The on rules switch the toggle on only when they restore something, so a player can leave it off. Settings (switches, thresholds, reserve) are in `wallet.automation.autoBurn` and are carried with Daemon Persistence; the toggle, the second counter, the upper trigger's `upperArmed` flag and the record of what was switched off are in `sleeve.autoBurn` and reset with every re-sleeve. Code asks one query for ownership (`ownsAutoBurnStep`).

## Configuration (from docs/CONFIG.md)

### `automation` – the automation features (optional)

| Field | Type | Meaning |
|---|---|---|
| `autoBurnCeiling` | number >= 0 | Auto Burn's **Floor**: where it starts, and the fixed value until the Tune Thresholds skill. With Hold on, Burn leads bring heat down to it; the off and on rules look at it. Real content: 20 (placeholder) |
| `autoBurnUpper` | finite number > `autoBurnCeiling` | Auto Burn's **Redline** (default 100 when the section gives none): heat reaching it switches the Burn lead toggle on (Redline Trigger). Real content: 70 (placeholder) |

Leave the section out for a game without automation (the Automation tab then never appears). The points come from `{kind:'automationPoints', perCopy >= 1 whole}` buyables (sleeve-wide: each copy owned gives `perCopy` points, which pay for buyables with `currency: 'automationPoints'`: the skills of the automation lanes; a lane has `branch` = the feature id (`autoBurn`, `autosale`, `dispersal`), its first skill has the effect `{kind:'unlocksAutomation', feature}` and is what unlocks the feature, and the rest are `{kind:'placeholder'}` for now, except in the Auto Burn lane, whose eight skills have `{kind:'autoBurnStep', step}` (one of `hold`, `upper`, `offOverclocks`, `offActions`, `onActions`, `onOverclocks`, `thresholds`, `reserve`); real content: `content/buyables/skillBranches/automationLines.ts`, 10 slots per lane at 1 point each, Auto Burn's slot 8 empty). Real content: **Automation core**, 1,000,000 credits, `costGrowth: 100`, unlimited, `perCopy: 1`. The features themselves (Auto Burn, Kompromat autosale, Augment dispersal) use `items.burnLead`, `items.augment` and the sellable items; there is nothing else to tune.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-30 (by the user)*
- **Auto Burn's off rules act only while the Burn lead toggle is on (decided 2026-10-30, by the user):** with the toggle off, running out of leads switches nothing off. The resume rules (skills 6 and 7) are unchanged and may still switch the toggle on.
- **Auto Burn is the first real automation:** the on/off button is gone; Burn leads become an Inventory toggle and the lane's other eight skills add switches, thresholds and a reserve (table above). Turning back ON switches on what the player ticked in the resume checklists (see the Pick Targets removal below).
- **Pick Targets removed, resume pickers (2026-10-31):** the skill 'choose' only decoupled the off/on switches, so every switch is now independent and the skill is gone (slot 8 empty, ids stay stable; an owned copy is dropped on load and its point comes back, because points are derived). The resume switches no longer restore a record of what was switched off: the player ticks the owned heat-making Overclocks / Auto-runs to resume, and those are switched on even if switched off by hand. Migration piece `migrateAutoBurnResume` (`autoBurnMigration.ts`) is written and tested but not yet wired to a save-version bump.

*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Daemon Persistence:** keeps the Automation core copies together with the automation skills and settings, so points stay balanced (the user's worry was free extra points). The assistant chose to carry the copies rather than store a spent counter. "Lane skills" were renamed **automation skills**.
