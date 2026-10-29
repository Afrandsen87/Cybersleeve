# Context: automation

Automation points, lanes and features.

Code: `src/core/automation/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Design (from DESIGN.md)

### 8b. Automation

The **Automation** tab holds features that play part of the game for the player. They are paid for with **automation points**: the only source for now is the sleeve buyable **Automation core** (1,000,000 credits, x100 per copy, unlimited; one point per copy). Nothing is stored for points: points available = points earned (copies owned) - the price of the automation skills owned. **Each feature has its own line of automation skills inside its box** (a chain of 10 skills drawn like the skill tree, always shown in full, in the colour of its lane: Auto Burn purple, Compromat Autosale yellow, Augment Dispersal cyan; the box's heading is the lane's title). **The first skill of a lane IS the unlock:** there is no separate Unlock button, the player just clicks the first node (1 automation point) and chooses which feature gets the first point, and the controls of the box show once it is owned. The other nine skills of each lane are PLACEHOLDERS for now (1 automation point each, no effect): they will become progressively more complicated versions of that automation. Points, unlocks, automation skills and settings reset by re-sleeving, with the purchases they depend on (ASSUMPTION, like skills) **unless the Daemon Persistence re-sleeve skill is owned** (section 11): then the Automation core copies, the automation skills and the settings are all carried over together, so points available stay balanced and a new life gets no extra points. Every feature works in closed form per slice of game time.

| Feature | What it does |
|---|---|
| Auto Burn | A switch and a heat ceiling (default 20, `automation.autoBurnCeiling`, placeholder). While on, whenever heat is above the ceiling it uses **just enough Burn leads at once** to bring it down to the ceiling (`heat x 0.95^k <= ceiling`), or every lead held when that is not enough. It works only while a lead can be used (not while Overclock holds the heat in place). A ceiling of 0 uses every lead as it arrives. |
| Kompromat autosale | **Its first skill unlocks it for every rarity.** A switch per rarity; each slice sells everything held of the switched-on rarities, for every item that can be sold, at the normal price (no tax, no credit lever). Items that cannot be sold (Augment schematics, leads, ...) are never touched. Back Channel Deals needs common Kompromat, so switching common on competes with it. |
| Augment dispersal | A share (0-100%) per action. Each slice every Augment schematic held is applied to the actions by their shares, relative to each other (1 and 1 is 50/50), most common rarity first; schematics that do not divide evenly go to the largest remainders, so none is lost. An action at 0% gets none. With every share at 0 nothing happens and the Augment buttons work as before. |

## Configuration (from docs/CONFIG.md)

### `automation` – the automation features (optional)

| Field | Type | Meaning |
|---|---|---|
| `autoBurnCeiling` | number >= 0 | Where Auto Burn's heat ceiling starts: while on, Burn leads are used whenever heat is above it. The player changes it. Real content: 20 (placeholder) |

Leave the section out for a game without automation (the Automation tab then never appears). The points come from `{kind:'automationPoints', perCopy >= 1 whole}` buyables (sleeve-wide: each copy owned gives `perCopy` points, which pay for buyables with `currency: 'automationPoints'`: the skills of the automation lanes; a lane has `branch` = the feature id (`autoBurn`, `autosale`, `dispersal`), its first skill has the effect `{kind:'unlocksAutomation', feature}` and is what unlocks the feature, and the rest are `{kind:'placeholder'}` for now; real content: `content/buyables/skillBranches/automationLines.ts`, 10 skills per lane at 1 point each). Real content: **Automation core**, 1,000,000 credits, `costGrowth: 100`, unlimited, `perCopy: 1`. The features themselves (Auto Burn, Kompromat autosale, Augment dispersal) use `items.burnLead`, `items.augment` and the sellable items; there is nothing else to tune.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Daemon Persistence:** keeps the Automation core copies together with the automation skills and settings, so points stay balanced (the user's worry was free extra points). The assistant chose to carry the copies rather than store a spent counter. "Lane skills" were renamed **automation skills**.
