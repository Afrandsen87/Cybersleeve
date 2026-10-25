# Cybersleeve – Game Design

The source of truth for mechanics. It describes the game as it is now; the history of how numbers changed lives in git. Names (credits, Kompromat, ...) are placeholders and may be renamed, so code never hard-codes display names. Every number below is a value in `src/content/gameConfig.ts` (see `docs/CONFIG.md`).

Status markers: **ASSUMPTION** = inferred, needs confirmation. **OPEN** = undecided. Everything else is confirmed by the user.

Last updated: 2026-10-26.

## 1. Concept

Cyberpunk idle/incremental game. The player is a character who performs **actions**. There is no life clock: the player builds up their current **sleeve** (body) and chooses when to **re-sleeve** (the first prestige layer). Later layers, not designed yet: several sleeves at once, each replaying a copy of the previous lifetime; companies that produce ever more sleeves; cities, outposts, planets.

Scope decisions: desktop browsers only; offline progress is out of scope for now; balance is not a factor yet (more mechanics, including buyables for every action, are coming), so do not "fix" balance oddities. **Infinity is 1e308**: every amount is held at or below it (see 9).

## 2. Resources and the screen

- **Credits**: the main currency, starts at 0, spent on buyables. **Network nodes** (whole numbers) are built by an action, produce credits passively, and some buyables are paid in them. **Skill points** pay for skills (see 8).
- **Tabs** (centered, at the top): **Character** (everything below except skills) and **Skills**. The credits stay visible on both. The Skills tab shows `Skills (N)` while N points are available.
- **Character layout:** a top band with the Sleeve widget on the left and, to its right, Network, **Sleeve Improvements** (sleeve-wide buyables paid in credits) and **Network Exploitation** (those paid in nodes), with the Inventory below them; a line across the screen; below it the 3x2 grid of action cards (one cell is still empty; each card has the run bar across the top, then the reward line and level bars on the left with the square of toggles beside them, see 7); the re-sleeve button; export and import of the save.
- **Test aids** (Reset save, Speed x10, Test drop) are shown only in development builds or with `?debug` in the address. To be removed before release.

## 3. Actions

An action has a base duration, a reward of some kind, and its own XP, level and sleeve level. By default it is manual: the player starts it, a bar fills, on completion the reward is paid and the player must start it again. **Progress is the share of the run done**: when the speed changes mid-run only the rest of the run gets faster or slower. A manual run that completes discards leftover time; an auto-run carries it into the next run.

**Critical success:** each completed run is drawn as critical with the chance the Critical success buyable gives (one draw per batch of runs, never per run). A critical run is an ordinary run that pays 3x its reward (whatever the reward kind) and gives 2x action XP; heat, drops, the runs counted towards sleeve XP and the ordinary completion effects are unchanged. The rule is data (`criticalSuccess` in the configuration), and an action may replace single fields of it (`criticalSuccess` on the action, including extra completion effects per critical run), so an action's critical success can later do something of its own. No action does yet.

**Overclock and Focus** are two switches that each action buys for itself (see 7, "The square on each action card"): they sit with Auto-run in the square beside the bars of the card, both off at first and both reset by re-sleeving. They add a speed factor to the action's speed (`speed` in 4) and nothing else.
- **Overclock** exists on an action once that action has bought its Overclock unlock AND has an Overclock effect of its own (`ActionDefinition.overclock`, so each action can get a different one; an action without one has no unlock). Each rule is a mix of gains and costs, and every action has its own:
  - **Grow network:** **50% faster**, at **2 heat per minute** while it is running overclocked (charged for the time the action actually ran, in fractions of a point; a manual action that has finished its run and is waiting costs nothing).
  - **Practice Hacking:** pays **200% more** (x3) per run, but every completed run costs **5 nodes** (never below 0 nodes). The bonus is part of the action's reward multiplier, so it scales that reward only, not XP or counted runs.
  - **Push malware:** every completed run **also pays the nodes of a Grow network run** (Grow network's reward with its own reward multipliers, rounded down per run; no XP, heat, drops or critical success for Grow network), and the run makes **three times as much heat**.
  - Every copy of the sleeve **Overclock upgrade** makes the **gains** of every Overclock 10% of their base stronger (strength 1, 1.1, 1.2, ...: the speed bonus 50%, 55%, 60%; the reward bonus 200%, 220%, 240%). The **costs and the extra payment** (heat, the 5 nodes, the 3x heat, the Grow network payment) are fixed: more copies never make the price higher.
- **Focus** exists on an action once that action has bought its Focus unlock. At most as many actions can be focused at once as there are **Focus slots**: one is free, and every copy of the sleeve **Focus upgrade** adds one (up to one per action). A focused action runs **25% faster**, whatever the number of slots. Switching on needs a free slot, switching off always works. Focus adds no heat.
- The two multiply with each other and with the other speed factors (an overclocked and focused Grow network runs 1.5 x 1.25 times as fast).

**Access ladder:** actions are gated only by **access level** (starts at 1, +1 per Access upgrade copy). A locked card says why ("Needs access level 3"). A card whose start cost cannot be paid cannot be started.

| Action | Needs access | Base duration | Each completed run |
|---|---|---|---|
| Grow network | 1 | 3 s | +1 network node (rounded down per run) |
| Practice Hacking | 2 | 5 s | +0.01 Hacking Proficiency |
| Push malware | 3 | 6 s | +0.0001 credits per second added to the base payout of every node; +1 heat |
| Kill servers | 4 | 2 min | +1 ICE Rating. Costs **1% of the nodes** (rounded down to whole nodes, so you need at least 100) each time a run starts, also for each auto-run restart |
| Build Legend | 5 | 5 min | +1 Infamy; removes 25% of the nodes (rounded down per run); +50 heat |

Every completed run gives 1 action XP. Several runs in one batch apply every effect that many times. Runs are computed in closed form, so any speed is exact.

**A reward multiplier** (a buyable) multiplies **only the reward its own action pays per run**, never XP, counted runs, heat or completion effects. There is no general output multiplier and no global reward multiplier; each lever names what it scales. Today the only global lever is `global.creditMultiplier`, which scales credits earned (run rewards paid in credits and passive income) and nothing else.

## 4. Levels, XP and speed

**Level rule.** Levels start at **0** with 0 XP. Every level costs its own full amount, and the XP counted inside a level starts again at 0 at each level-up. Leaving level 0 costs **10 XP**; each further level costs **2 times** the one before, for action levels (`progression.actionLevels`) and sleeve levels (`progression.sleeveLevels`) alike.

| Level reached | Costs on its own | Total XP |
|---|---|---|
| 1 | 10 | 10 |
| 2 | 100 | 110 |
| 3 | 1 000 | 1 110 |
| L | 10^L | 10 (10^L − 1) / 9 |

The stored XP is the running total; the screen shows the part inside the current level against the full cost of that level. Formula: a track with `xp` has gained `floor(log_g(xp (g − 1) / first + 1))` levels.

**Two tracks.** *Action XP / level*: per action, 1 XP per completed run, reset by re-sleeving. *Sleeve XP / level*: **per action**, 1 sleeve XP per **100** completed runs of that action (ASSUMPTION, implemented: whole points from a run counter that keeps its remainder), kept through re-sleeving.

**Speed.**
```
speed        = actionLevelFactor × sleeveLevelFactor (that action's) × interfaceSpeed × global.speedMultiplier
levelFactor  = 1 + level × 0.05            (+5% of the base speed per level)
duration     = baseDuration / speed        (never below engine.minRunDurationMs)
interfaceSpeed = (base + boosts) × networkFactor × hackingMultiplier × skill factor
hackingMultiplier = 1 + scale × ((1 + proficiency)^exponent − 1) / exponent      (concave, no ceiling), up to proficiency = knee
                    past the knee the same curve continues with a flatter exponent (below)
networkFactor = 1 + ln(nodes) / 100 per Network synergy copy, else 1
```
Hacking Proficiency is the total Practice Hacking has paid out, a stored total reset by re-sleeving. The curve uses scale 1 and exponent 0.25 (strong diminishing returns; 1 = straight line, 0 = logarithm); without it the speed fed itself exponentially. **From Hacking Proficiency 1 on the curve flattens further** (knee 1, exponent 0.1 past it): below 1 nothing changes, and past 1 each further point is worth even less. The second piece starts from the value AND the slope the first has at the knee, so the multiplier does not jump or kink there: with `r = (1 + proficiency) / (1 + knee)` the bonus past the knee is `bonus(knee) + scale × (1 + knee)^exponent × (r^beyondExponent − 1) / beyondExponent`. Both numbers are data (`sleeve.earnedSpeedKnee`, `sleeve.earnedSpeedExponentBeyond`); leaving them out gives one curve. The tooltips of Interface speed and Hacking Proficiency say where it changes. The level used for speed is the action level plus any level bonus from Skill transfer. Speed is built from pluggable modifiers, so new factors add without editing the old.

## 5. The sleeve widget

Each stat has a hover tip; hovering the label or the value shows it.

| Stat | Starts at | Meaning |
|---|---|---|
| Access level | 1 | Gates actions. Its tip names the next unlock. |
| Interface speed | 0.1 | A plain multiplier on every action's speed (so a run takes ten times its base time at the start). |
| Hacking Proficiency | 0 | Shown under Interface speed; its tip shows the multiplier it gives. Counts raised by Muscle Memory. |
| ICE Rating | 1 | Lowers the effect of heat by **0.5% per order of magnitude** (100% at 1e200). Raised by Kill servers (+1 per run), multiplied by the ICE Rating boost buyable. |
| Heat | 0 | A tax on **the credits network nodes produce**: each point takes 1% of that income (capped at 100%), lowered by ICE Rating. With a reduction r, node income stops at `100 / (1 − r)` heat. It never touches run rewards, item payments or building nodes. Heat may hold **fractions of a point** (Overclock adds heat continuously; a Burn lead removes a share of it), but it only ever cools in **whole points**. |
| Infamy | 0 | Makes the heat cooldown cycle **10% longer per point**. Falls by exactly 1 each 10-minute cycle (a bar shows it) while above 0. |

**Heat cooldown.** A bar fills over **60 s**; each time it completes, heat drops by 1, so heat is removed in whole points only: **while there is less than 1 heat the bar does not advance**, and a leftover fraction (0.4 of a point) stays until more heat comes in. With 3.5 heat the cooldown stops at 0.5. The bar counts progress in normal-speed time, so a change of speed never makes it jump; time is counted from the start of each step, so heat added by an action starts cooling in the next step.

## 6. Network and passive income

- Every node produces **0.01 credits per second**, continuously, also while no action runs. Per node: `(0.01 + Push malware bonus) × credit lever × Node payout multiplier × (share kept after the heat tax)`.
- The Network widget shows, in order: nodes, payout per node (what one node really pays per second now), credits per second, and **Moles** (shown once Back Channel Deals is owned or Moles are held). The payout tip shows the calculation step by step.
- **Nodes are whole numbers:** nodes gained per run round down per run; prices in nodes round up; percentage costs round down and must be at least 1; saves floor the count; Self-replication carries its fractional growth between ticks.
- Nodes finished during a tick start producing on the next tick (ASSUMPTION, implemented). The network resets by re-sleeving.

## 7. Buyables

Defined as data. Action buyables sit in their action's card as square buttons; a buyable's card only decides where it is shown, its effect may reach further. Name, price and description appear in a hover tip. A rebuyable lights up when it has been bought before and the next copy is affordable. Unavailable buyables (missing `requires`) are hidden. Buyables reset by re-sleeving, all copies (ASSUMPTION).

**Auto-run is a toggle:** once owned, a click on its cell of the square switches it on or off (it starts on; an off button is struck through, the tip says ON/OFF). Each restart of an auto-run pays the start cost again.

### Sleeve Improvements (credits) and Network Exploitation (nodes)
Sorted by base price within *Rebuyable* (no heading in the widget), *One-time* and *Paid in nodes*.

| Buyable | Cost | Effect |
|---|---|---|
| Access upgrade | 5 credits, ×1000 per copy, unlimited | +1 access level per copy (copies stack). |
| Interface boost | 10 credits, ×1000 per copy, unlimited | +0.05 base interface speed. |
| Critical success | 50 credits, ×1000 per copy, unlimited | +5% chance per copy (capped at 100%) that any completed run, of any action, is a critical success. |
| Faster conditioning | 1,000 credits, ×100 per copy, 90 copies at most | Every action needs 1 run fewer per batch of sleeve XP for each copy, from 100 runs down to a floor of 10. |
| Overclock upgrade | 250,000 credits (1000× the old unlock price), ×1000 per copy, unlimited | Makes the gains of **every** Overclock 10% stronger per copy (the costs stay). Does not unlock anything: each action unlocks its own Overclock. See 3. |
| Focus upgrade | 1,000,000 credits (1000× the old unlock price), ×100,000 per copy, at most 4 | One more action can be focused at once per copy (1 slot is free, so 4 copies give every action a slot). Does not unlock anything: each action unlocks its own Focus. See 3. |
| ICE Rating boost | 15,000 credits, ×100 per copy, unlimited | ICE Rating ×2 per copy. |
| Node payout | 25 **nodes** (spent), ×10 per copy, unlimited | Each node produces 100% more credits (×2 per copy, compounding). |
| Node uplink | 10 **nodes** (spent), ×10 per copy, unlimited | +0.1 base interface speed. |

### The square on each action card
The run bar of an action card spans the full width of the card. Underneath it, beside the reward line and the two level bars (action level, sleeve level), sits a **square** of the same height as those three rows (78 px; cells of 36 px). It holds the toggles of the action:
- **Before Auto-run is bought** the whole square is one big button that buys it (its price is the action's own Auto-run price, listed with the action's purchases below).
- **Once Auto-run is owned** the square becomes a grid of four buttons: **Auto-run** (a toggle), **Overclock**, **Focus** and **Augment** (see 10; it applies one schematic and is disabled while none is held).
- **Overclock and Focus cells** show what the action has: a cell whose unlock is not bought is a purchase button (lit when affordable, the tip shows the price); once bought it is a toggle (lit when on, struck through when off). An action without an Overclock effect has an empty dashed cell there (and in the Augment cell when the game has no schematic).

| Per-action unlock | Cost | Effect |
|---|---|---|
| Overclock (Grow network, Practice Hacking, Push malware) | 250 credits each | Unlocks that action's Overclock switch (see 3 for what each one does). |
| Focus (every action) | 1,000 credits each | Unlocks that action's Focus switch: a focused action runs 25% faster, within the Focus slots. |

The prices are the same for every action for now. The sleeve-wide **Overclock upgrade** and **Focus upgrade** (above) scale what these toggles do.

### Practice Hacking
| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 100 credits | Restarts the action itself. |
| Kompromat harvest | 500 credits | 5% of completed runs drop a Kompromat file, rarity 90 / 9 / 1 / 0 / 0 over common, uncommon, rare, legendary, crisis (see 10). |
| Rarity refinement | 10,000 credits; needs the harvest | Increases the rarity of Kompromat drops based on Hacking Proficiency (see 10 for how). Its tooltip says just that. |
| Skill transfer | 1,000,000 credits | Adds Practice Hacking's **sleeve level** to Grow network's level, for speed only (not its XP). |
| Study methods | 1e15 credits | Every sleeve level of the **other** actions needs 0.01% less XP per sleeve level of Practice Hacking, at most 25%. Practice Hacking itself is not affected. |

### Grow network
| Buyable | Cost | Effect |
|---|---|---|
| Auto-run | 50 credits | Restarts the action itself. |
| Parallel nodes | 75 credits, ×100 per copy, unlimited | Doubles the nodes each run pays (a reward multiplier). |
| Burn leads | 1,000 credits (placeholder) | Each completed run has a 5% chance to drop a **Burn lead** (it has **no rarity**: one stack, named just "Burn lead"). Using a lead from the Inventory takes 5% of the current heat away (see 10). |
| Industrial Espionage | 10,000 credits | Each completed run has a chance to drop an Augment schematic (see 10). |
| Self-replication | 1e10 credits | Nodes grow every second by (Grow network's plain action level / 1000)% of themselves, compounding, in closed form; the rate is read at the start of each slice. The tip shows the formula and the live numbers. |
| Network synergy | 1e35 credits | Multiplies the base interface speed by `1 + ln(nodes) / 100` (ASSUMPTION: the "+1" keeps it a bonus). |

### Push malware, Kill servers, Build Legend
| Buyable | Cost | Effect |
|---|---|---|
| Auto-run (Push malware) | 15,000 credits | Restarts the action itself. |
| Malware payload | 10,000 credits, ×100 per copy, unlimited | Doubles what each run adds to the node base payout (a reward multiplier). |
| Hardened payload (Push malware) | 10,000 credits | Adds 10 to the base ICE Rating for every action level of Push malware. The ICE Rating boost multiplies the sum, so the order of buying does not matter. |
| Auto-run (Kill servers) | 1e9 credits | Restarts the action itself. |
| Auto-run (Build Legend) | 1e15 credits | Restarts the action itself. |

## 8. Skills

Skills are buyables paid in **skill points**, shown as buttons on the Skills tab (a whole skill tree comes later). **Points:** none at the start; 1 when the total of all ACTION levels reaches 1, then one more per order of magnitude of that total (2 at 10, 3 at 100, 4 at 1,000, ...); sleeve levels do not count. Each skill costs 1 point for now. Points available = points earned − cost of the skills owned, so nothing is stored. Skills reset by re-sleeving with the action levels they depend on (ASSUMPTION).

| Skill (names are made up) | Effect |
|---|---|
| Overclocked Cortex | Interface speed ×1.05 |
| Bandwidth Leech | Node payout ×1.1 (compounds with the Node payout buyable) |
| Cold Trail | Heat cools down 5% faster |
| Muscle Memory | Hacking Proficiency counts 5% higher wherever it is used (hacking multiplier, drop-ratio shifts, and the value shown on screen) |
| Quick Study | Every ACTION level needs 1% less XP (sleeve levels unchanged), with the same overall cap as Study methods |
| Nose for Secrets | Doubles the Kompromat base drop chance (the result is at most 100%) |
| Exploit Kompromat | Node payout ×(1 + 1% per uncommon Kompromat file held) |
| Back Channel Deals | Adds a **Back channel** button beside Sell and Sell all: with the common Kompromat stack selected, each press gives up one file for **5 Moles** |

**Moles.** A Mole is one point of heat that cools **200% faster (three times the pace)**, on top of Cold Trail. While there are Moles and heat, every point of heat cooled uses up one Mole; with none left the heat cools at the normal pace. Moles are kept while there is no heat, and reset by re-sleeving.

## 9. Infinity and big numbers

- **Infinity is 1e308** (`core/infinity.ts`). After every step every amount (credits, nodes, XP, ICE Rating, ...) above it, and any overflow, is clamped to 1e308; NaN becomes 0 and never a windfall. Multipliers derived from an amount saturate there. Reaching it calls a listener, the hook for the future **infinity prestige** (OPEN: its design).
- Amounts are `BigNum` behind an interface; level maths stays exact beyond the double range.

## 10. Items, drops, the Inventory and Augments

- **Items** are an entity (`GameConfig.items`): kinds (Kompromat file, Augment schematic) in five **rarities**, most common first: Common, Uncommon, Rare, Legendary, Crisis level. Counts are kept per kind and rarity in the **Inventory** widget (under Network, shown once a drop source is owned or something is held). **The widget is a grid of tiles:** every possible stack is a tile with the item's icon and its count underneath (a stack that is not held is dimmed), the border colour tells the rarities apart, and an item without rarity has one tile. The tiles are in two sections: items that are only kept or used on the **left**, items that can be sold in their own section on the **right**. The inventory resets by re-sleeving (ASSUMPTION).
- **Drops** are random but computed per batch of runs (binomial and multinomial draws), never run by run, so a long tick and many short ones give the same *rate*. The chance and the rarity weights are data on the buyable's effect.
- **Kompromat is blackmail, not a sale.** In the section for sale a held tile is **selected by clicking it** (click again to deselect; an empty tile cannot be selected), and the buttons beside the grid act on the selected stack: **Sell** sells one, **Sell all** sells the rest (a stack that is sold out is deselected). The selection is a choice of the screen and is not saved. One file pays **10 credits** (common) and an order of magnitude more per rarity (100, 1,000, 10,000, 100,000). A payment is in full: heat and the credit lever do not touch it. The tip says "Used as blackmail". The code calls it selling.
- **Rarity refinement.** Every whole order of magnitude of (effective) Hacking Proficiency, `floor(log10)` (none below 10), is one *shift*: **1% of each rarity's weight moves to the next rarity**, all amounts worked out first and then moved at once. With 90/9/1/0/0 the first shift gives 89.1/9.81/1.08/0.01/0, so only the second shift lets the last rarity drop. The last rarity keeps what it has; the total never changes. Hacking Proficiency resets by re-sleeving, so the shift starts over.
- **Every item tooltip shows the drop chance of its own stack**, as the chance that ONE completed run of an action drops it: the chance of the drop rule (with Nose for Secrets and the like) times the share of the rarity in the drop ratios as they stand now (Rarity refinement included), e.g. `Drop Chance = 0.45% per Practice Hacking run`. One line for each action that can drop the stack; `Drop Chance = 0%` while no owned buyable drops it, or while the rarity has no share yet. An item without rarity shows its whole chance.
- **Augment schematics** are applied, never sold (`sellable: false`: no *Sell* buttons, and the engine refuses). Every action card has an **Augment** button (top right) that applies **one** schematic to that action: **+1% to the action XP boost of ITS rarity**, additive within a rarity (3 common = +3%); the boosts of different rarities **multiply** (3 common, 3 uncommon and 3 rare give 1.03 × 1.03 × 1.03). Action XP only, never sleeve XP. The **most common rarity held** is used up first. Applied augments are saved per action and rarity and reset by re-sleeving. Industrial Espionage drops them with the same placeholder numbers as Kompromat (5%, 90/9/1/0/0). The tip shows the calculation with the numbers filled in.
- **Burn leads** are dropped by Grow network (the Burn leads buyable, 5% of runs; the item has no rarity, so the Inventory shows one row named "Burn lead" and the drop names no rarity weights; internally the stack is kept under the most common rarity). They are not sold (`sellable: false`); there is no Sell for them: **clicking the Burn lead tile uses one** (the tile is disabled while there is no heat). One lead removes **5% of the CURRENT heat** (so it is worth more the hotter you are: 5% of 200 heat is 10, of 20 heat is 1) and is used up. The button is disabled while there is no heat, and a lead is never used up for nothing. The result is often a fraction of a point, which the cooldown then leaves alone (see 5). The share is data (`items.burnLead.heatFraction`). The inventory resets by re-sleeving like every other item.
- **Test drop** (test aid): drops one item by the current weights whatever the chance; before the harvest is owned it uses the configured rule.
- Known and accepted: selling stops mattering quickly because earnings outgrow it.

## 11. Re-sleeving (first prestige)

- **Positive list:** only what `CARRIED_OVER_ACTION_FIELDS` names carries over: each action's sleeve XP (so its sleeve level) and the run counter towards the next sleeve XP. Everything else resets, including anything added later; to carry something over, add it to the list.
- The button needs a second click to confirm, with a Cancel button.
- **OPEN:** the real requirement (for now always allowed, through a replaceable `ResleevePolicy`), and whether purchases should survive.

## 12. Time

- The game keeps running while the window is unfocused: the loop measures real elapsed time and simulates the whole gap. Gaps over 10 minutes are capped; offline progress is not implemented.
- **Tick size does not matter:** a long tick is cut into slices of at most 1 s (at most 64), so one long tick and many short ones give the same result including feedback such as interface speed rising with every run.
- One tab plays: a second tab or window is told the game is taken before it loads the save.
- The save is written every 10 s, when the page is hidden and when it closes. The last good save is kept as a fallback; the player can copy the save as text and paste one back (Export save / Import save).

## 13. Open questions

1. Confirm the sleeve-XP counter model (each completed run counts as one run; reward multipliers do not change it).
2. The real re-sleeve requirement, and whether buyables should survive it.
3. The design of the infinity prestige.
4. Theme text and names for the actions, buyables and currency; story beats and tone.
5. Offline progress (later; the save needs a timestamp then).
6. Buyables for the other actions, further automation, the skill tree.
7. Later layers: several sleeves, companies, cities, planets (the late-game "derivative" copy scaling).
