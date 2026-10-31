# Context: automation

Automation points, lanes and features.

Code: `src/core/automation/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Design (from DESIGN.md)

### 8b. Automation

The **Automation** tab holds features that play part of the game for the player. They are paid for with **automation points**: the only source for now is the sleeve buyable **Automation core** (1,000,000 credits, x100 per copy, unlimited; one point per copy). Nothing is stored for points: points available = points earned (copies owned) - the price of the automation skills owned. **Each feature has its own line of automation skills inside its box** (a chain of up to 10 slots drawn like the skill tree, always shown in full, in the colour of its lane: Auto Burn purple, Compromat Autosale yellow, Augment Dispersal cyan; the box's heading is the lane's title). **The first skill of a lane IS the unlock:** there is no separate Unlock button, the player selects the first node and presses INSTALL (1 automation point) and chooses which feature gets the first point, and the controls of the box show once it is owned. The other eight skills of the Auto Burn lane are real (below); Kompromat autosale is a rarity-permission tree, and Augment Dispersal is a nine-node selection and rarity chain. Points, unlocks, automation skills and settings reset by re-sleeving, with the purchases they depend on (ASSUMPTION, like skills) **unless the Daemon Persistence sleeve skill is owned** (section 11): then the Automation core copies, the automation skills and the settings are all carried over together, so points available stay balanced and a new life gets no extra points. Every feature works in closed form per slice of game time.

| Feature | What it does |
|---|---|
| Auto Burn | **The Burn lead becomes an Inventory toggle** (`AutoBurn`, `autoBurn.ts`; rules in `autoBurnRules.ts`, state shapes in `autoBurnTypes.ts`). There is no on/off button in the Automation tab; each switch and input below shows only once its skill is owned (new switches start OFF). Per slice, in this order: (a) with the upper switch and heat REACHING the Redline (rising to it from below; `sleeve.autoBurn.upperArmed` is cleared when it fires and set again once heat is below the threshold, so a player can switch the toggle off while heat stays up) the toggle is switched on once; (b) while the toggle is on and heat is at least 1 (`heatNeedsCooling` in `heat/heat.ts`: the cooldown removes whole points only, so a fraction below 1 counts as cooled and uses no lead), **one lead a second** (a fractional-second counter in the sleeve state, closed form per slice) or, with Hold, just enough leads to bring heat down to the Floor, or below 1 when that is lower (`BurnLeads.leadsNeeded(heatHoldTarget(lower))`), none at or below it; never below the reserve (the available leads are held minus reserve, and 0 while leads cannot be used: an Overclock that stops heat cooling is running, `BurnLeads.usable`); (c) **with the toggle on**, out of leads (available = 0) while heat is above the Floor: the off rules switch heat-making Overclocks and/or the Auto-run of heat-making actions OFF and record what they switched; (d) heat below the Floor with leads available: the on rules switch ON every ticked owned Overclock / Auto-run that is off (the resume checklists in `wallet.automation.autoBurn.resumeOverclocks` / `resumeAutoRuns`, set by `setResumeOverclock` / `setResumeAutoRun`; even ones the player switched off by hand), and when one changed, the toggle on (switching in `autoBurnSwitcher.ts`). Every switch is independent of the others. The off record (`overclocksOff` / `autoRunsOff`) is kept for the re-sleeve carry; a hand switch clears it. "Makes heat" has one owner (`core/heat/heatMakers.ts`, which also lists the Overclocks and Auto-runs Auto Burn may switch: an action with `heatPerRun`/`heatPerSecond` > 0; an Overclock when its `heatPerMinute` > 0 or its action makes heat); the UI reveal rule calls it too. Switching goes through `ActionToggles.setOverclock` and `Shop.setOn`, set explicitly, never flipped. |
| Kompromat autosale | A switch for each skill-allowed rarity sells whole sellable stacks at the normal price. The upper fork adds per-rarity auto Back Channel switches: when manual Back Channel supports the rarity, it consumes those stacks before autosale. Items that cannot be sold are never sold. |
| Augment dispersal | Tick unlocked actions to receive augments, up to the skill-owned selection slot count. Each slice only permitted rarities are applied evenly, most-common-first, using cumulative balancing and largest remainders (configuration order breaks ties). An action without owned Auto-run receives none and consumes nothing; unpermitted rarities remain in inventory. With no targets nothing happens. |

### Kompromat autosale and Back Channel tree

**Kompromat automation:** autosale is allowed separately by rarity skills. One branch forks after rare autosale (slot 3): slots 4 to 6 automate Back Channel for common/uncommon/rare; slots 7 to 8 sell legendary/crisis. Slots 9/10 are absent, keeping all surviving ids stable. Slot 1 retains `unlocksAutomation` with optional `allowsAutosale: common`; later skills use `allowsAutosale {rarity}` or `allowsAutoBackchannel {rarity}`. The permission owner is `automation/rarityPermissions.ts` (`allowedRarities`), exposed through `Automation.allowedRarities(feature)` and shared by save reading and invariant checks. Per slice: Auto Burn, auto backchannel, autosale, then dispersal. Back Channel uses the same `BackChannel.giveUp(..., all)` and manual channel query as the manual command, with constant work per stack and no randomness. Both switch groups default off and retain only known, permitted rarity ids on load. The additive `wallet.automation.autoBackchannel` map follows Daemon Persistence with the other automation settings; no version bump or migration. The purchase reader drops removed ids before automation reads; earned-minus-owned-cost points therefore refund slots 9/10.

| Slot | Permission | Parent |
|---|---|---|
| 1 | Common autosale + lane unlock | root |
| 2 | Uncommon autosale | 1 |
| 3 | Rare autosale | 2 |
| 4 | Common auto Back Channel | 3 |
| 5 | Uncommon auto Back Channel | 4 |
| 6 | Rare auto Back Channel | 5 |
| 7 | Legendary autosale | 3 |
| 8 | Crisis-level autosale | 7 |

Reveal checklist: the lane skills carry no `requires` gate on purpose. A re-sleeve resets the Kompromat and Back Channel purchases, and a `requires` on a kept automation skill would make `dropUnmetRequirements` delete it on load (Daemon Persistence). Like the Auto Burn lane, the lane is shown in full once the Automation tab is open; the switches of a rarity appear only after its skill is owned, and owned auto Back Channel switches remain visible but disabled while the manual Back Channel does not support their rarity. Tests: automationLanes, rarityPermissions, contentAutomationSkills (no `requires`).

Impact: each rarity controls a distinct stock; selling pays currency while Back Channel pays Moles, so neither route universally dominates. Switching both on intentionally gives Back Channel priority. No tuning changed. Layer readiness: wallet settings and the active sleeve's skill ownership follow the existing single-active-sleeve facade; no new singleton or copy simulation is introduced, and corporations/prestige add no special cases.

### Augment dispersal lane

| Slot | Adds |
|---|---|
| 1 | Unlock dispersal, common rarity, one selected action |
| 2 | One selected action |
| 3 | Uncommon rarity |
| 4 | One selected action |
| 5 | One selected action |
| 6 | Rare rarity |
| 7 | One selected action |
| 8 | Legendary rarity |
| 9 | One selected action |

The chain retains ids 1 to 9; slot 10 is absent and refunds through derived points. The root keeps unlocksAutomation as the single feature-unlock owner, adding optional allowsDispersal and dispersalSlots fields. Later nodes use allowsDispersal {rarity} or dispersalSlots {count}; rarityPermissions.ts owns rarity and slot queries. There are six slots in total. No requires gates are attached to automation skills, so Daemon Persistence retains them after manual purchases reset. Selection uses dispersalTargets, a wallet automation array; loading ignores the old dispersal map and clears old selections without a save-version bump. Unknown, locked and over-cap targets are dropped in configuration order. Daemon Persistence carries selections with the automation settings.

Reveal checklist: the first seen common schematic introduces the item and common rarity; permission text for each later rarity waits until that schematic rarity is known. Parent masking propagates down the chain. Selection controls and their count appear only after slot 1 is owned; the rarity summary names only known permitted rarities. Tests use the shared rarityAutomationKit.

Impact: more targets trade concentration on one action for spreading augments; rarity nodes make distinct stock usable. The six-slot endpoint currently exceeds the five configured actions by one; leave tuning unchanged. Layer readiness: selections belong to the shared wallet settings and application mutates the active sleeve through existing Augments queries; no extra singleton, corporation assumption or per-copy simulation.

The Auto Burn panel shows a status line (STANDBY, IDLE, BLOCKED, DRY, HOLDING or BURNING), heat and held leads; the toggle state appears once in the status explanation. Each owned skill reveals its part: the Floor strip and THROTTLE, the Redline notch and REDLINE row, FAILSAFE target chips, RESTART target sub-rows, editable Floor/Redline values, then Reserve. Empty restart lists remain visible with a muted explanation. Floor and Redline stay fixed until Tune Thresholds; Reserve counts leads kept untouched. The heat strip spans 0..max(1.5 x Redline, Floor + 1), with overflow heat pinned at the edge while its label retains the real value. Activity, firing flags and lead availability come only from `autoBurnStatus.ts` through `AutoBurnControls.status()`; the same owner supplies the off/on conditions used by Auto Burn.

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

Leave the section out for a game without automation (the Automation tab then never appears). The points come from `{kind:'automationPoints', perCopy >= 1 whole}` buyables (sleeve-wide: each copy owned gives `perCopy` points, which pay for buyables with `currency: 'automationPoints'`: the skills of the automation lanes; a lane has `branch` = the feature id (`autoBurn`, `autosale`, `dispersal`), its first skill has the effect `{kind:'unlocksAutomation', feature}` and is what unlocks the feature, and the remaining dispersal entries add slots or rarity permissions; the autosale tree uses rarity permissions described below. In the Auto Burn lane, whose eight skills have `{kind:'autoBurnStep', step}` (one of `hold`, `upper`, `offOverclocks`, `offActions`, `onActions`, `onOverclocks`, `thresholds`, `reserve`); real content: `content/buyables/skillBranches/automationLines.ts`, up to 10 stable slots per lane at 1 point each, Auto Burn's slot 8 empty). Real content: **Automation core**, 1,000,000 credits, `costGrowth: 100`, unlimited, `perCopy: 1`. The features themselves (Auto Burn, Kompromat autosale, Augment dispersal) use `items.burnLead`, `items.augment` and the sellable items; there is nothing else to tune.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-30 (by the user)*
- **Auto Burn's off rules act only while the Burn lead toggle is on (decided 2026-10-30, by the user):** with the toggle off, running out of leads switches nothing off. The resume rules (skills 6 and 7) are unchanged and may still switch the toggle on.
- **Auto Burn is the first real automation:** the on/off button is gone; Burn leads become an Inventory toggle and the lane's other eight skills add switches, thresholds and a reserve (table above). Turning back ON switches on what the player ticked in the resume checklists (see the Pick Targets removal below).
- **Pick Targets removed, resume pickers (2026-10-31):** the skill 'choose' only decoupled the off/on switches, so every switch is now independent and the skill is gone (slot 8 empty, ids stay stable; an owned copy is dropped on load and its point comes back, because points are derived). The resume switches no longer restore a record of what was switched off: the player ticks the owned heat-making Overclocks / Auto-runs to resume, and those are switched on even if switched off by hand. Migration piece `migrateAutoBurnResume` (`autoBurnMigration.ts`) is written and tested but not yet wired to a save-version bump.

*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Daemon Persistence:** keeps the Automation core copies together with the automation skills and settings, so points stay balanced (the user's worry was free extra points). The assistant chose to carry the copies rather than store a spent counter. "Lane skills" were renamed **automation skills**.


## Automation tab panel presentation

UI-only projection: `ui/view/automationView.ts` composes `kompromatView`, `dispersalView` and `autoBurnView`; `automationViewTypes.ts` keeps their public contract. `daemonView.ts` takes root masking directly from the built skill lanes. The existing Firmware lanes supply Back Channel dependency masking through one tree-building path. `widgets/automationWidget.ts` composes persistent daemon, Kompromat and Dispersal panels under `widgets/automation/`; both tabs call `firmwareLegend.ts`, and Automation trees use the shared card header/node/edge renderer with select + INSTALL in the shared docked inspector.

Daemon controls and descriptions appear only online. Owned Back Channel rarity switches remain visible but are disabled when the channel owner does not support that rarity; the absent-channel note names its configured grant skill only when readable. Held counts use the inventory count owner. Dispersal permits require both permission and seen schematic rarity; target visibility/capacity remains owner-sourced. Auto Burn states the toggle once, formats heat like the Sleeve panel and right-aligns overflowing heat labels inside the strip. Protocol row styles are shared through `.ab`; rarity selectors are shared with Inventory. Automation icon art derives from lane effect data.

Tests use `testing/kompromatKit.ts`, `dispersalPanelKit.ts` and the existing automation/Auto Burn kits, all based on `testConfig.ts`. Presentation changes add no state, balance lever or assumption about sleeve, corporation or prestige-layer counts. The known sixth-target-slot/five-action content oddity is unchanged.

## Docked Firmware inspector

Automation node hover previews, click pins, and INSTALL uses the existing buy command; repeat click, close or Escape unpins. In the pinned daemon leaving a node restores the pin immediately. Other-daemon previews persist inside that row or pane and restore the pin on row exit. Unpinned previews persist inside their row/pane. Leaving the tab drops hover while retaining UI-only `automationSelected`. Tooltips and masking use the shared tree and inspector. ADDS text and target keys derive from the configured automation effect, never masked fields. Hidden controls receive no preview; rising ownership observed while shown flashes the control, restarting its animation. Keyboard exits follow the same pane/row/outside rules as pointer exits.

`dockedFocus`, `rowHolds` and injected `scrollAnchor` own transient interaction rules. `automation/dockedInspector` measures the tallest shared inspector on the first visible render and when masking or installed-node sets change, holds rows above a moved pane, and compensates scroll for 350ms with a growing bottom spacer. Closing releases holds/spacer. Panel `controlTargets` registries are built once. Tests use `widgetKit`, `automationKit` and `testConfig`; pure anchor tests inject clocks/frames. No game rule or balance changes; no new sleeve, corporation or prestige-layer count assumptions. The sixth-target-slot/five-action content oddity remains.
