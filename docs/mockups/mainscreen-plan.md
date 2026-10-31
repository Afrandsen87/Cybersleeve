# Plan: main screen redesign

Approved mockup: [mainscreen.html](mainscreen.html), with idea 8 (Inventory as a stash) switched **on**. The user approved it with three changes, which the mockup already shows:

- **Legend sits under DEFENSE** with ICE Rating, not under RISK. It speeds heat cooling.
- **No ONE-TIME row.** Upgrades are split by currency only: **SLEEVE** = paid in credits, **NETWORK** = paid in nodes. Every network upgrade costs nodes.
- **A bought one-time upgrade moves to the front of its row and shows MAX.** Rebuyables that reach their max also show MAX but keep their place. That second part is how I read "like the others"; confirm with the user if unsure.

The mockup's numbers are placeholders: the tax threshold 410, the re-sleeve 63% and "needs Access Level 6", the sell values, prices and item names. Glyphs stand in for the real pixel icons, which stay. The work is presentation only: no game rules, saves or tuning change.

Related plan: [autoburn-plan.md](autoburn-plan.md). Both need a heat strip, so whichever lands second turns the first one's strip layout into one shared owner (see Batch A3). Neither copies the other.

## Scope and order

This is too big for one batch. Land it in three batches, one per session, each through `/agent-task` and approved before the next. Each batch states its contexts, which are mostly **ui**, plus small read-only owners in **economy** and **heat** where noted.

| Batch | Contents | Main files |
|---|---|---|
| A | Visual language, panel chrome, number precision, top bar, Sleeve and Network panels with the heat gauge | `style.css` (split), `dom.ts`, `tabBar.ts`, `sleeveView.ts`, `statWidget.ts`, `networkView.ts` |
| B | Upgrades panel (currency rows, tiles), Inventory stash | `buyableViews.ts`, `upgradeButtons.ts`, `sleeveWidgets.ts`, `inventoryView.ts`, `inventoryWidget.ts` |
| C | Action cards as process windows | `actionCards.ts` (split), `actionView.ts`, `squareView.ts`, `fastBar.ts` |

Inside a batch, the packages touch separate files and stylesheets, so they can run in parallel worktrees. `uiText.ts` is shared: each package adds its own block of keys. `uiText.ts` is already 9.3 KB, so new text goes into an area file under the `uiText` facade (see `uiTextParts.ts`).

---

## Batch A: foundations, top bar, Sleeve and Network

### A1. Visual language and chrome (ideas 1 and 2)

- **Split `style.css`** (28 KB) before growing it. Keep `style.css` as the base with tokens, layout and buttons, and move each area into its own file under `src/ui/styles/`: `hud.css`, `panels.css`, `sleeve.css`, `upgrades.css`, `inventory.css`, `actions.css`, `automation.css`. Import them in `main.ts`.
  - Two tests read `style.css` directly: `contentSkillTree.test.ts` and `tooltip.test.ts`. Keep the rules they check in `style.css`, or point the tests at the new file.
- **Colour tokens in `:root`, one meaning each:**
  - `--info` cyan: on / information
  - `--run` magenta: running
  - `--heat` orange
  - `--danger` red: danger / loss
  - `--gain` green
  - `--auto` purple: automation
  - `--afford` gold: affordable
  - `--mono`: the monospace font stack
- Keep the existing `--cyan`, `--magenta` and branch tokens as aliases, so nothing else breaks. Write the colour meanings as a comment block at the top of `style.css`; that comment is the rule for future UI.
- **Monospace for every number and data value** (stat values, prices, counts, XP, rates).
- **Panel chrome:**
  - `// TAG` headers with an optional status LED (`.ph`, `.led`)
  - notched corners (`clip-path`) with bracket accents
  - a faint grid background and a fixed scanline overlay (`pointer-events: none`)
- All of this is CSS plus header markup in the existing widgets.
- **LED pill and LED dot** become shared classes; the Auto Burn plan uses the same classes.

### A2. Number precision (idea 3)

- Panel stat values show 3–4 significant figures (`144.2375` → `144.2`, `652.3491` → `652`). Tooltips keep full precision.
- Do it once: add a panel precision option to the existing formatter in `src/numbers` (grep `formatPlain` and its decimals arguments), and make stat rows use it. Don't round in each widget.
- Tests: zero, negatives, huge values, NaN/Infinity, 0.0002, 1e308.

### A3. Top bar (idea 4)

- **`dom.ts` header:** a big monospace credits readout plus an income rate (`+34.73T/s`, green).
  - The rate is total passive income per second (network after tax plus synthetic sleeves). Read it from **one** owner query. If none exists, add `creditsPerSecond()` in the **economy** context, summing `passiveCreditsPerSecond` and `synthCreditsPerSecond`. The UI must not sum them itself.
  - Show the rate only once it is above 0 (reveal rules).
- **Small heat gauge in the header:** heat value, `TAX n%`, and a mini bar, all from the heat owners (`heatTaxShare`, `heatStopPoint` in `core/heat/heatModel.ts`). It appears together with the heat stat (same reveal rule).
- **Tabs:** terminal style (uppercase monospace, active tab underlined in cyan).
  - The counts become badges: gold for skill points, purple for automation points.
  - `TabView` gets `count: number | null` instead of a count baked into `label`.
  - The blink from `TabAttention` stays as it is today.
- **Shared heat strip owner:**
  - If the Auto Burn plan has already landed, turn its `view/autoBurnStrip.ts` into `view/heatStrip.ts`, a pure function from heat, markers and tax start to percent positions.
  - If it hasn't landed, create `heatStrip.ts` here, and the Auto Burn plan uses it.
  - Either way there is one owner.
  - Tests: heat 0, heat beyond the end (pinned, overflow flag), no tax start (`heatStopPoint` returns `null`, e.g. Blackout cap), NaN.

### A4. Sleeve panel (ideas 5 and 6)

- **Group the stat rows** into ACCESS, SKILL, DEFENSE and RISK, with headers drawn as lines:
  - ACCESS: Access Level
  - SKILL: Interface speed, Hacking Proficiency, Critical success
  - DEFENSE: ICE Rating, **Legend** with its decay bar
  - RISK: Heat with the heat gauge and the cooldown bar
- The grouping is data: give each stat id a group in a table in the view (`sleeveView.ts`), and `statWidget.ts` draws a group header before the first visible row of each group. Hide a group whose rows are all hidden.
- Both `sleeveView.ts` (10 KB) and `statWidget.ts` grow, so move the grouping table and the gauge view into a new `view/sleeveGroups.ts`.
- **Reveal:** each row keeps its current reveal rule (`statReveal.ts`, `docs/REVEAL_RULES.md`). Legend keeps its rule. Today's "Legend cooldown (paused: no legend)" bar is hidden while Legend is 0 instead of saying "paused".
- **Heat gauge:**
  - the strip from A3, with a striped tax zone starting at `heatStopPoint`, and the legend line "all credits taxed ≥ N"
  - when the tax is capped (Blackout), no stop point: the label shows the cap instead
  - the cooldown bar under it with the cycle (`-amount / seconds`), from the values the heat tip already uses
- **Re-sleeve box** at the bottom of the panel, as in the mockup: the title, then the existing shortfall text from the Re-sleeve button (grep `shortfall`; `resleeveShortfall.test.ts`).
  - Show a readiness bar only if a core owner gives a real 0..1 progress. Otherwise leave the bar out; don't invent one.
  - The button itself keeps its current behaviour.
- Status LED `● ONLINE` in the header. The `#0007`-style sleeve number is optional: show it only if a real sleeve id or number exists. Don't hard-code one.

### A5. Network panel (idea 5)

- Under "Credits per second", add a red note when the heat tax takes something: "heat tax takes N% (heat H ≥ S)". Fill it from `heatTaxShare` and `heatStopPoint`. Leave out the "≥ S" part when there is no stop point, and hide the note while the share is 0.
- Value colours follow the language: income in green, the taxed `+0` in red, counts in white or cyan.

### Batch A checks

- `npm run check` passes. Tests cover:
  - the precision formatter
  - `heatStrip`
  - the grouping table: every sleeve stat row has exactly one group; Legend is in DEFENSE
  - the tax note text (zero share, full share, capped)
  - tab counts
  - the `creditsPerSecond` owner, if added
- Docs: the ui slice in `docs/contexts/ui.md`, `docs/ARCHITECTURE.md` (new style files and views), `DESIGN.md` (screen description), and one `docs/DECISIONS.md` entry for the colour language and the Legend-in-DEFENSE grouping.
- Preview: screenshot the Character tab with a mid-game save and with a fresh save, which shows that nothing appears before it matters.
- Commit subject: **Restyle the main screen: HUD, panels and heat gauge**.

---

## Batch B: Upgrades panel and Inventory stash

### B1. Upgrades panel (idea 7 plus the user's changes)

- **Sections become currency rows.** In `buyableViews.ts` `sectionLayout`, `SleeveSectionId` becomes `'sleeve' | 'network'`: `networkNodes` → `network`, everything else → `sleeve`.
  - The one-time / rebuyable split is gone.
  - Section text in `uiText`: `{ sleeve: 'SLEEVE', network: 'NETWORK' }`.
  - The resleeve gate stays out of the list, as today.
  - Update `sleeveViewTypes.ts` and the tests that name the old ids.
- **One panel, `// UPGRADES`, with two labelled rows.** It replaces the Sleeve Improvements and Network Exploitation widgets (`sleeveWidgets.ts`, `dom.ts` layout). This changes the dashboard grid in the top band: Network, Upgrades, and Inventory spanning below.
- **Order within a row:**
  - base price, as today (static, cached per config)
  - except that **bought one-time upgrades go to the front**, in their base-price order
  - The order now depends on what's owned, so the view applies "bought one-time first" on top of the cached layout. The widget reorders DOM nodes **only when the set of bought one-time upgrades changes**, never every frame.
- **MAX:** every maxed buyable shows `MAX` in its price strip, using `BuyableView.maxed` and the text from `uiText`. That covers bought one-time upgrades and rebuyables at their cap.
- **Tile** (`upgradeButtons.ts`; Batch C's mods row reuses it):
  - icon on top
  - a price strip under it: `costText`, gold when `affordable`, teal `MAX` when `maxed`, muted otherwise
  - an owned-count badge (`×N`) when `repeatable` and owned > 0
  - gold glow when affordable, dimmed when not
  - Keep the existing classes and tooltips; this only adds the strip and badge.
- Tests:
  - the currency split (no node-paid buyable in `sleeve`, none credit-paid in `network`)
  - a bought one-time upgrade moves to the front, ahead of cheaper unbought ones
  - a maxed rebuyable keeps its place
  - the layout cache is still computed only once per config
- Impact check: presentation only.

### B2. Inventory stash (idea 8)

- **Items group:** named slots with the item name, a rarity or CONSUMABLE caption in the rarity colour, the count, a left border in the rarity colour, and dimmed at 0. All of it comes from `InventoryRowView` (`label`, `rarityIndex`, `count`).
- **For sale group:**
  - a **rarity legend** (dot + name for each rarity that has any row shown)
  - slots like the items group
  - **Sell buttons that show what they earn**: `SELL 1 +X` and `SELL ALL +Y` for the selected item
    - X = `sellValue(rarity)`
    - Y = count × `sellValue(rarity)`
    - Both are read from the `Inventory.sellValue` owner, through one new view field (e.g. `sellAllText`). The widget doesn't compute them.
  - The selection model (`UiSelection`) stays.
- Usable and toggle items (Burn lead toggle, Augment) keep their current interactions inside the slot.
- `inventoryWidget.ts` is already 10.2 KB: move slot building into `widgets/inventorySlots.ts`.
- Tests: the sell texts (zero count, huge count, unsellable item gives no buttons), the legend lists only the rarities shown, and the slot captions.

### Batch B checks

- `npm run check` passes. Docs (ui slice, ARCHITECTURE, DESIGN, a DECISIONS entry for the currency rows and the bought-first order) are updated. Preview screenshots are taken.
- Commit subject: **Merge the upgrade panels into Sleeve and Network rows and show sell values**.

---

## Batch C: action cards as process windows (idea 9)

- **Split `actionCards.ts` first** (12.7 KB): `widgets/actionCard/titleBar.ts`, `stats.ts`, `controls.ts`, `mods.ts`, keeping `actionCards.ts` as the facade.
- **Title bar:**
  - action icon, name, a muted process id derived from the action id (`grow-network` → `grow_net`-style; pure function, tested)
  - a **state LED**: `AUTO` (purple, pulsing) while running on Auto-run, `RUNNING` (magenta) while running manually, `IDLE` (grey) otherwise, from `running` and the Auto-run cell's `on`
  - `critText` (CRITICAL!) shows in the title bar with the existing timing
- **Stat grid:** tag and value rows instead of pipe strings.
  - SPEED: `speedText · durationText`
  - YIELD: `rewardText` with `rewardMultiplierText`
  - RISK (heat lines, orange) and COST (costs, red)
  - The view must say which extra line is which. Today these are styled strings, so `actionView.ts` / `actionCosts.ts` gain a typed `kind` per extra line. The widget never parses text.
- **Progress bar in the action's colour.** The colour lives in CSS, keyed by `data-action` like the branch colours, with a cyan fallback; no colour in logic. When the bar is full and runs are fast, it streams and shows the rate, from the existing `fastBar.ts` `barText`. Bars keep `transform: scaleX()`.
- **Controls:** the square's four cells become labelled LED toggles: AUTO, OC, FOCUS, AUG, with labels from `uiText`.
  - Their modes (`buy`, `toggle`, `press`, `empty`) behave as today.
  - A `buy` cell shows its price in the tile's price-strip style.
  - An `empty` cell keeps its space but is invisible.
  - Split buttons keep working.
- **Mods row:** the action's buyables use the B1 tile, with price strip, badge and MAX, under a vertical `MODS` label.
- **Idle cards** are desaturated. Running cards get a glow in their colour.
- The empty dashed grid slot stays hidden unless something will fill it (reveal rules).
- Tests: the process id function, the extra-line kinds (heat vs cost), the state LED mapping (auto / manual / idle), and that card rendering adds no per-frame work that grows with the number of buyables (the existing render tests).

### Batch C checks

- `npm run check` passes. Docs are updated. Preview screenshots show running, idle and critical cards.
- Commit subject: **Restyle action cards as process windows**.

---

## Checks for every batch

- No file over about 10 KB (source) or 12 KB (tests) without a split in the same change. TSDoc with `Called by:` / `Calls:` lines.
- Nothing is shown before it matters: run the `docs/REVEAL_RULES.md` checklist for every new header, note, badge and gauge.
- One owner per value: tax share, tax start, sell value, income rate and maxed state all come from their owners. The UI formats them and never works them out again.
- Layer-readiness check: everything reads the current sleeve, as today. No currency names hard-coded in logic (labels come from `uiText`). No new singletons.
- Leave `docs/mockups/` until the last batch lands, then ask the user whether to delete it.
