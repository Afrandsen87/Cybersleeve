# Cybersleeve – Game Design

The source of truth for mechanics. It describes the game as it is now; the history of how numbers changed lives in git. Names (credits, Kompromat, ...) are placeholders and may be renamed, so code never hard-codes display names. Every number below is a value in `src/content/gameConfig.ts` (see `docs/CONFIG.md`).

Status markers: **ASSUMPTION** = inferred, needs confirmation. **OPEN** = undecided. Everything else is confirmed by the user.

Last updated: 2026-10-26.

## 1. Concept

Cyberpunk idle/incremental game. The player is a character who performs **actions**. There is no life clock: the player builds up their current **sleeve** (body) and chooses when to **re-sleeve** (the first prestige layer). Later layers, not designed yet: several sleeves at once, each replaying a copy of the previous lifetime; companies that produce ever more sleeves; cities, outposts, planets.

Scope decisions: desktop browsers only; offline progress is out of scope for now; balance is not a factor yet (more mechanics, including buyables for every action, are coming), so do not "fix" balance oddities. **Infinity is 1e308**: every amount is held at or below it (see 9).

## 2. Resources and the screen

- **Credits**: the main currency, starts at 0, spent on buyables. **Network nodes** (whole numbers) are built by an action, produce credits passively, and some buyables are paid in them. **Skill points** pay for skills (see 8).
- **Tabs** (on the same line as the credits, to their right): **Character** (everything below except skills and automation), **Skills** and **Automation**. The credits stay visible on all. **No tab shows until the first skill point or the first automation point has been earned** (a new game is just the character screen); then Character shows, Skills once a skill point has been earned and Automation once an automation point has. Skills and Automation show `Skills (N)` / `Automation (N)` while N points are available and **blink** while one waits to be spent.
- **Purchases appear when they are within reach:** a purchase paid in credits or nodes shows once its price is within **3 orders of magnitude** (`reveal.buyableOrders`) of the most of that currency held in this life (a peak below 1 counts as 1, so a new game shows the cheap ones). The peak only goes up, so a purchase never disappears because the credits that revealed it were spent. Owned purchases, skills and the purchases in an action's square are always shown. Peaks reset by re-sleeving.
- **Nothing is shown before it matters (a general rule for every stat, skill and purchase):** a stat row, bar, button or tree stays hidden until something exists that makes or changes it. **Heat** shows once an open action makes heat (or an owned Overclock does); **ICE Rating** once an owned purchase boosts it or an open action earns it; **Legend** once the action that earns it is open; the **sleeve XP bars, the Re-sleeve button and the re-sleeve skills** once Unlock resleeving is bought. A stat that already moved off its start is never hidden. Rules are data in `ui/view/statReveal.ts`; add an entry there for a new hidden stat.
- **Purchases are listed by base price, cheapest first,** in every widget (the price in the content, before cost growth, copies owned or levers): one helper, `sortByBasePrice` in `ui/view/buyableViews.ts`, so editing a price re-sorts the screen. Equal prices keep the content order.
- **Character layout:** a top band with the Sleeve widget on the left and, to its right, Network, **Sleeve Improvements** (sleeve-wide buyables paid in credits) and **Network Exploitation** (those paid in nodes), with the Inventory below them; a line across the screen; below it the 3x2 grid of action cards (one cell is still empty; each card has the run bar across the top, then the reward line and level bars on the left with the square of toggles beside them, see 7); export and import of the save.
- **Test aids** (Reset save, Speed x10, Test drop) are shown only in development builds or with `?debug` in the address. To be removed before release.

## 3. Actions

An action has a base duration, a reward of some kind, and its own XP, level and sleeve level. By default it is manual: the player starts it, a bar fills, on completion the reward is paid and the player must start it again. **Progress is the share of the run done**: when the speed changes mid-run only the rest of the run gets faster or slower. A manual run that completes discards leftover time; an auto-run carries it into the next run.

**Critical highlight:** an action card lights up (magenta border and a mark beside the start button) for one second of game time after it hit a critical success. One success in that second shows `CRITICAL!`; several show the average per second (`N crits/s`). The feed behind it (`core/critFeed.ts`) is not saved and is cleared by re-sleeving.

**Critical success:** every run has a critical chance made of the Critical success buyable's chance, and the chance **may exceed 100%**: the whole part is that many critical successes for sure, the fraction a chance of one more (150% is one for sure and a 50% chance of a second; 240% is two and a 40% chance of a third). On top of that a Zero-day, an Admin key or a banked success adds **+100% chance to one run each** (on distinct runs, so one more sure success each). The batch is settled with binomial draws, never per run. **Each critical success applies the effect once:** it pays 3x the reward (whatever the reward kind) and gives 2x action XP, so a run with two pays 2 x 3 = 6x and gives 2 x 2 = 4x XP, and the completion effects of the critical rule apply once per success. A run with none is ordinary. Heat, drops, the runs counted towards sleeve XP and the ordinary completion effects are unchanged. The rule is data (`criticalSuccess` in the configuration), and an action may replace single fields of it (`criticalSuccess` on the action, including extra completion effects per critical run), so an action's critical success can later do something of its own. No action does yet.

**Overclock and Focus** are two switches that each action buys for itself (see 7, "The square on each action card"): they sit with Auto-run in the square beside the bars of the card, both off at first and both reset by re-sleeving. They add a speed factor to the action's speed (`speed` in 4) and nothing else.
- **Overclock** exists on an action once that action has bought its Overclock unlock AND has an Overclock effect of its own (`ActionDefinition.overclock`, so each action can get a different one; an action without one has no unlock). Each rule is a mix of gains and costs, and every action has its own:
  - **Grow network:** **50% faster**, at **2 heat per minute** while it is running overclocked (charged for the time the action actually ran, in fractions of a point; a manual action that has finished its run and is waiting costs nothing).
  - **Practice Hacking:** pays **200% more** (x3) per run, but every completed run costs **5 nodes** (never below 0 nodes). The bonus is part of the action's reward multiplier, so it scales that reward only, not XP or counted runs.
  - **Push malware:** every completed run **also pays the nodes of a Grow network run** (Grow network's reward with its own reward multipliers, rounded down per run; no XP, heat, drops or critical success for Grow network), and the run makes **three times as much heat**.
  - **Kill servers:** pays **double the ICE Rating** per run (a reward bonus of +100%), and **heat does not cool at all** while the action is running overclocked: the cooldown stands still, Moles are not used and Burn leads cannot be used (the tile is disabled). Heat the action or anything else adds still counts. The **Kill chain** buyable (see 7) adds a chain on top of this: every consecutive completed run while the action stays overclocked and keeps running adds a **link** (at most 20). Each link makes the next run pay **10% more** of the base ICE Rating (added to the Overclock bonus: with 10 links the reward is 1 + 1 + 1 = x3) and take **10% more of the share of nodes** (1% becomes 1.1%, 1.2%, ... up to 3%). The chain is **broken** (back to 0 links) when the action stops (a manual run finishes, or an auto-run cannot pay its next start) or when Overclock is switched off. The reward per link is a **gain** and grows with the strength of Overclock; the node share per link is a price and does not. A chain exists only for an action with a start cost (its runs always come one per batch). The links are saved and reset by re-sleeving.
  - Every copy of the sleeve **Overclock upgrade** makes the **gains** of every Overclock 10% of their base stronger (strength 1, 1.1, 1.2, ...: the speed bonus 50%, 55%, 60%; the reward bonus 200%, 220%, 240%). The **costs and the extra payment** (heat, the 5 nodes, the 3x heat, the Grow network payment) are fixed: more copies never make the price higher.
- **Focus** exists on an action once that action has bought its Focus unlock. At most as many actions can be focused at once as there are **Focus slots**: one is free, and every copy of the sleeve **Focus upgrade** adds one (up to one per action). A focused action runs **25% faster**, whatever the number of slots. Switching on needs a free slot, switching off always works. Focus adds no heat.
- The two multiply with each other and with the other speed factors (an overclocked and focused Grow network runs 1.5 x 1.25 times as fast).

**Access ladder:** actions are gated only by **access level** (starts at 1, +1 per Access upgrade copy). A locked card says why ("Needs access level 3"). A card whose start cost cannot be paid cannot be started.

| Action | Needs access | Base duration | Each completed run |
|---|---|---|---|
| Grow network | 1 | 3 s | +1 network node (rounded down per run) |
| Practice Hacking | 2 | 5 s | +0.01 Hacking Proficiency |
| Push malware | 3 | 6 s | +0.0001 credits per second added to the base payout of every node; +1 heat |
| Kill servers | 4 | 2 min | +1 ICE Rating. Costs **1% of the nodes** (rounded down to whole nodes, so you need at least 100) each time a run starts, also for each auto-run restart. Decommission protocol lowers the share (and keeps it from vanishing), Credit Siphon pays credits for the nodes destroyed, and its Overclock builds a Kill chain (see 3 and 7) |
| Build Legend | 5 | 5 min | +1 Legend; removes 25% of the nodes (rounded down per run); +5 heat per second while it runs |

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
| Heat | 0 | A tax on **the credits per second the network produces** (the whole income, not the payout per node): each point takes 1% of it (capped at 100%), lowered by ICE Rating. With a reduction r, node income stops at `100 / (1 − r)` heat. It never touches run rewards, item payments or building nodes. Heat may hold **fractions of a point** (Overclock adds heat continuously; a Burn lead removes a share of it), but it only ever cools in **whole points**. |
| Legend | 0 | Makes the heat cooldown cycle **10% faster per point** (the cycle time is divided by 1 + 0.1 x Legend). Falls by exactly 1 each 10-minute cycle (a bar shows it) while above 0. |

**Heat cooldown.** A bar fills over **60 s**; each time it completes, heat drops by 1 (more with Purge Protocol), so heat is removed in whole steps only: **while there is less than 1 whole point of heat the bar does not advance**, and a cycle never takes more than the whole points that are left (a step of 5 with 3.5 heat takes 3), so a bigger step cannot strand heat, and a leftover fraction (0.4 of a point) stays until more heat comes in. With 3.5 heat the cooldown stops at 0.5. The bar counts progress in normal-speed time, so a change of speed never makes it jump; time is counted from the start of each step, so heat added by an action starts cooling in the next step.

## 6. Network and passive income

- Every node produces **0.01 credits per second**, continuously, also while no action runs. Per node: `(0.01 + Push malware bonus) × credit lever × Node payout multiplier`. **The heat tax is not part of it:** it takes its share of the whole **credits per second** (nodes × payout per node × share kept), shown as its own line in the Credits per second tip. Each boost in the payout is named with its value in the Payout per node tip.
- The Network widget shows, in order: nodes, payout per node (what one node really pays per second now), credits per second, **Moles** (shown once Back Channel Deals is owned or Moles are held), and, once the skill Synthetic Sleeves is owned, two lines: the **number of synthetic sleeves** and the **credits per second they earn together** (see 11). The payout tip shows the calculation step by step.
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
| Critical success | 50 credits, ×1000 per copy, unlimited | +5% chance per copy (no cap: above 100% a run can have several critical successes) that any completed run, of any action, is a critical success. |
| Faster conditioning | 1,000 credits, ×100 per copy, 90 copies at most | Every action needs 1 run fewer per batch of sleeve XP for each copy, from 100 runs down to a floor of 10. |
| Overclock upgrade | 250,000 credits (1000× the old unlock price), ×1000 per copy, unlimited | Makes the gains of **every** Overclock 10% stronger per copy (the costs stay). Does not unlock anything: each action unlocks its own Overclock. See 3. |
| Focus upgrade | 1,000,000 credits (1000× the old unlock price), ×100,000 per copy, at most 4 | One more action can be focused at once per copy (1 slot is free, so 4 copies give every action a slot). Does not unlock anything: each action unlocks its own Focus. See 3. |
| ICE Rating boost | 150,000 credits, ×100 per copy, unlimited | ICE Rating ×2 per copy. |
| Unlock resleeving | 100,000,000,000 credits, one time | **Not listed with the other purchases: it is the Re-sleeve button**, at the bottom of the Sleeve widget. It appears (showing its name and price) once its price is in reach; one click buys it and the button turns into the Re-sleeve action. It opens **sleeve levels** (sleeve XP is tracked from the start, but its levels read 0 and give nothing until this is bought; the XP bars appear), re-sleeving (see 11) and the **re-sleeve skill tree**. Kept when you re-sleeve. Buying it starts a lockout of `resleeve.lockoutMs` (5 s of game time) in which the button is disabled, so a double click cannot re-sleeve at once. |
| Node payout | 25 **nodes** (spent), ×10 per copy, unlimited | Each node produces 100% more credits (×2 per copy, compounding). |
| Node uplink | 10 **nodes** (spent), ×10 per copy, unlimited | +0.1 base interface speed. |

### The square on each action card
The run bar of an action card spans the full width of the card. Underneath it, beside the reward line and the two level bars (action level, sleeve level), sits a **square** of the same height as those three rows (78 px; cells of 36 px). It holds the toggles of the action:
- **Before Auto-run is bought** the whole square is one big button that buys it (its price is the action's own Auto-run price, listed with the action's purchases below).
- **Once Auto-run is owned** the square becomes a grid of four buttons: **Auto-run** (a toggle), **Overclock**, **Focus** and **Augment** (see 10; it applies one schematic and is disabled while none is held).
- **Overclock and Focus cells** show what the action has: a cell whose unlock is not bought is a purchase button (lit when affordable, the tip shows the price); once bought it is a toggle (lit when on, struck through when off). An action without an Overclock effect has an empty dashed cell there (and in the Augment cell when the game has no schematic).

| Per-action unlock | Cost | Effect |
|---|---|---|
| Overclock (Grow network, Practice Hacking, Push malware, Kill servers) | 25x that action's Auto-run price (Grow network: 250) | Unlocks that action's Overclock switch (see 3 for what each one does). |
| Focus (every action) | 100x that action's Auto-run price (Grow network: 1,000) | Unlocks that action's Focus switch: a focused action runs 25% faster, within the Focus slots. |

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
| Auto-run | 10 credits | Restarts the action itself. |
| Parallel nodes | 75 credits, ×100 per copy, unlimited | Doubles the nodes each run pays (a reward multiplier). |
| Burn leads | 1,000 credits (placeholder) | Each completed run has a 0.5% chance to drop a **Burn lead** (it has **no rarity**: one stack, named just "Burn lead"). Using a lead from the Inventory takes 5% of the current heat away (see 10). |
| Industrial Espionage | 10,000 credits | Each completed run has a 0.5% chance to drop an Augment schematic (see 10). |
| Self-replication | 1e10 credits | Nodes grow every second by (Grow network's plain action level / 1000)% of themselves, compounding, in closed form; the rate is read at the start of each slice. The tip shows the formula and the live numbers. |
| Network synergy | 1e35 credits | Multiplies the base interface speed by `1 + ln(nodes) / 100` (ASSUMPTION: the "+1" keeps it a bonus). |

### Push malware, Kill servers, Build Legend
| Buyable | Cost | Effect |
|---|---|---|
| Auto-run (Push malware) | 15,000 credits | Restarts the action itself. |
| Malware payload | 10,000 credits, ×100 per copy, unlimited | Doubles what each run adds to the node base payout (a reward multiplier). |
| Zero-day exploits (Push malware) | 5,000,000 credits | Each completed run has a 5% chance to drop a **Zero-day** (**no rarity**, like the Burn lead). Switched on in the Inventory, each Zero-day adds +100% critical chance to one completed Push malware run (see 10). |
| Persistence (Push malware) | 1,000,000,000,000 credits, one time | **Triples what a critical success does for Push malware**: the reward multiplier (3x) and the action XP multiplier (2x) of its critical runs become 9x and 6x. Ordinary runs and other actions are unchanged. |
| Ransomware (Push malware) | 5,000,000,000 credits | Every **critical success** of Push malware banks **+100% critical chance for Grow network's next run**; Grow network's next completed runs use the bank, one banked +100% per run (see 10). |
| Hardened payload (Push malware) | 100,000 credits | Adds 10 to the base ICE Rating for every action level of Push malware. The ICE Rating boost multiplies the sum, so the order of buying does not matter. |
| Auto-run (Kill servers) | 1e9 credits | Restarts the action itself. |
| Decommission protocol (Kill servers) | 1e14 credits (placeholder) | Every **plain action level** of Kill servers lowers the share of the nodes a run takes by **1% of its current value**: the share is multiplied by `0.99 ^ level`. The first level is worth the most (1% of the start value), every further one 1% of the new, smaller value, so it works at any level and never reaches zero. While owned, a node cost that rounds down to 0 is raised to **1 node**, so the action stays startable with fewer than 100 nodes (with 0 nodes there is still nothing to give up). One time. |
| Credit Siphon (Kill servers) | 1e12 credits (placeholder) | When a run starts, you are paid **10 seconds of what one node produces** for **every node the start cost destroys**: `nodes destroyed x credits per node per second now x 10`. The rate is the live per-node income, after the node payout multiplier and the heat tax (what one node delivers once the tax has taken its share). Paid at every start, also for each auto-run restart. One time. |
| Cascade failure (Kill servers) | 1e10 credits (placeholder), ×100 per copy, unlimited | The standard reward multiplier: **doubles the ICE Rating each run pays** (it scales that reward only, like Parallel nodes and Malware payload). |
| Kill chain (Kill servers) | 1e17 credits (placeholder); needs the Overclock unlock of Kill servers | Adds the **Kill chain** to this action's Overclock (see 3): up to 20 links, each making the next run pay 10% more ICE Rating and take 10% more of the node share. One time. |
| Black box recorder (Kill servers) | 1e20 credits (placeholder) | Each completed run has a 10% chance to drop an **Admin key** (no rarity, see 10). One time. |
| Auto-run (Build Legend) | 1e15 credits | Restarts the action itself. |

## 8. Skills

Skills are buyables paid in **skill points**, drawn as a **skill tree** on the Skills tab: three branches, each a lane growing sideways (roots on the left, each skill to the right of the one it needs, a line from every parent to its child; a parent is always in the same branch), with a neon colour under each lane: **Cybernetics** (green), **Anonymity** (red, the heat skills) and **Leverage** (brown, Kompromat). All three roots (Overclocked Cortex, Cold Trail, Nose for Secrets) can be started from the first skill point. **The whole tree is always shown**, every icon and every branch title, but what a skill says stays hidden (`???`, a `?` icon) until it is readable: its own gate is owned and every parent is readable, so a child of a hidden skill is hidden too. A readable skill whose parent is not owned shows its real text, dimmed, and cannot be bought yet. The re-sleeve skills are drawn the same way, in one lane. The tree: Cybernetics = Overclocked Cortex, then Bandwidth Leech and Muscle Memory, then Quick Study (after Muscle Memory); Anonymity = Cold Trail, then Obfuscation, then Purge Protocol; Leverage = Nose for Secrets, then Exploit Kompromat and Back Channel Deals. **Points:** none at the start; 1 when the total of all ACTION levels reaches 1, then one more per order of magnitude of that total (2 at 10, 3 at 100, 4 at 1,000, ...); sleeve levels do not count. Each skill costs 1 point for now. Points available = points earned − cost of the skills owned, so nothing is stored. Skills reset by re-sleeving with the action levels they depend on (ASSUMPTION). **A skill is readable only once the purchase that makes it useful is owned** (and its parents are readable): the Kompromat skills (Nose for Secrets, Exploit Kompromat, Back Channel Deals) need Kompromat harvest, and Obfuscation needs Push malware's Overclock.

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
| Obfuscation | Push malware's Overclock makes **2x** the heat per run instead of 3x (the factor is lowered, never raised; other actions are not affected). |
| Purge Protocol | Every heat cooldown cycle removes **1 more heat per sleeve level of Build Legend**. The cycles are not faster, so the cooldown still completes in discrete steps and the bigger step applies from the first cycle after the skill is bought. A late-stage skill, part of removing the heat tax. |

**Moles.** A Mole is one point of heat that cools **200% faster (three times the pace)**, on top of Cold Trail. While there are Moles and heat, every point of heat cooled uses up one Mole; with none left the heat cools at the normal pace. Moles are kept while there is no heat, and reset by re-sleeving.

### 8b. Automation

The **Automation** tab holds features that play part of the game for the player. They are paid for with **automation points**: the only source for now is the sleeve buyable **Automation core** (1,000,000 credits, x100 per copy, unlimited; one point per copy). Nothing is stored for points: points available = points earned (copies owned) - one per unlocked feature. **One point unlocks one feature, and the player chooses which.** Points, unlocks and settings reset by re-sleeving, with the purchases they depend on (ASSUMPTION, like skills). Every feature works in closed form per slice of game time.

| Feature | What it does |
|---|---|
| Auto Burn | A switch and a heat ceiling (default 20, `automation.autoBurnCeiling`, placeholder). While on, whenever heat is above the ceiling it uses **just enough Burn leads at once** to bring it down to the ceiling (`heat x 0.95^k <= ceiling`), or every lead held when that is not enough. It works only while a lead can be used (not while Overclock holds the heat in place). A ceiling of 0 uses every lead as it arrives. |
| Kompromat autosale | **One point unlocks it for every rarity.** A switch per rarity; each slice sells everything held of the switched-on rarities, for every item that can be sold, at the normal price (no tax, no credit lever). Items that cannot be sold (Augment schematics, leads, ...) are never touched. Back Channel Deals needs common Kompromat, so switching common on competes with it. |
| Augment dispersal | A share (0-100%) per action. Each slice every Augment schematic held is applied to the actions by their shares, relative to each other (1 and 1 is 50/50), most common rarity first; schematics that do not divide evenly go to the largest remainders, so none is lost. An action at 0% gets none. With every share at 0 nothing happens and the Augment buttons work as before. |

## 9. Infinity and big numbers

- **Infinity is 1e308** (`core/infinity.ts`). After every step every amount (credits, nodes, XP, ICE Rating, ...) above it, and any overflow, is clamped to 1e308; NaN becomes 0 and never a windfall. Multipliers derived from an amount saturate there. Reaching it calls a listener, the hook for the future **infinity prestige** (OPEN: its design).
- Amounts are `BigNum` behind an interface; level maths stays exact beyond the double range.

## 10. Items, drops, the Inventory and Augments

- **Items** are an entity (`GameConfig.items`): kinds (Kompromat file, Augment schematic) in five **rarities**, most common first: Common, Uncommon, Rare, Legendary, Crisis level. Counts are kept per kind and rarity in the **Inventory** widget (under Network, shown once a drop source is owned or something is held). **The widget is a grid of tiles:** every possible stack is a tile with the item's icon and its count underneath (a stack that is not held is dimmed), the border colour tells the rarities apart, and an item without rarity has one tile. The tiles are in two sections: items that are only kept or used on the **left**, items that can be sold in their own section on the **right**. **An item type is shown only once it is unlocked:** a purchase that drops it is owned, or some of it (any rarity) is held; every rarity of an unlocked item shows, even at 0. The inventory resets by re-sleeving (ASSUMPTION).
- **Drops** are random but computed per batch of runs (binomial and multinomial draws), never run by run, so a long tick and many short ones give the same *rate*. The chance and the rarity weights are data on the buyable's effect.
- **Kompromat is blackmail, not a sale.** In the section for sale a held tile is **selected by clicking it** (click again to deselect; an empty tile cannot be selected), and the buttons beside the grid act on the selected stack: **Sell** sells one, **Sell all** sells the rest (a stack that is sold out is deselected). The selection is a choice of the screen and is not saved. One file pays **100 credits** (common) and three orders of magnitude more per rarity (100,000, 100,000,000, 100,000,000,000, 100,000,000,000,000). A payment is flat: heat and the credit lever do not touch it, and the tip just says "flat". The tip says "Used as blackmail". The code calls it selling.
- **Rarity refinement.** Every whole order of magnitude of (effective) Hacking Proficiency, `floor(log10)` (none below 10), is one *shift*: **1% of each rarity's weight moves to the next rarity**, all amounts worked out first and then moved at once. With 90/9/1/0/0 the first shift gives 89.1/9.81/1.08/0.01/0, so only the second shift lets the last rarity drop. The last rarity keeps what it has; the total never changes. Hacking Proficiency resets by re-sleeving, so the shift starts over.
- **Every item tooltip shows the drop chance of its own stack**, as the chance that ONE completed run of an action drops it: the chance of the drop rule (with Nose for Secrets and the like) times the share of the rarity in the drop ratios as they stand now (Rarity refinement included), e.g. `Drop Chance = 0.45% per Practice Hacking run`. One line for each action that can drop the stack; `Drop Chance = 0%` while no owned buyable drops it, or while the rarity has no share yet. An item without rarity shows its whole chance.
- **Augment schematics** are applied, never sold (`sellable: false`: no *Sell* buttons, and the engine refuses). Every action card has an **Augment** button (top right) that applies **one** schematic to that action: **+3% to the action XP boost of ITS rarity**, additive within a rarity (3 common = +9%); the boosts of different rarities **multiply** (3 common, 3 uncommon and 3 rare give 1.09 × 1.09 × 1.09). Action XP only, never sleeve XP. You **select the rarity in the Inventory** (click its tile), then press the Augment button; only that rarity is used up. Applied augments are saved per action and rarity and reset by re-sleeving. Industrial Espionage drops them at 0.5% of runs with the rarity weights 90/9/1/0/0. The tip shows the calculation with the numbers filled in.
- **Burn leads** are dropped by Grow network (the Burn leads buyable, 0.5% of runs; the item has no rarity, so the Inventory shows one row named "Burn lead" and the drop names no rarity weights; internally the stack is kept under the most common rarity). They are not sold (`sellable: false`); there is no Sell for them: **clicking the Burn lead tile uses one** (the tile is disabled while there is no heat). One lead removes **5% of the CURRENT heat** (so it is worth more the hotter you are: 5% of 200 heat is 10, of 20 heat is 1) and is used up. The button is disabled while there is no heat, and a lead is never used up for nothing. The result is often a fraction of a point, which the cooldown then leaves alone (see 5). The share is data (`items.burnLead.heatFraction`). The inventory resets by re-sleeving like every other item.
- **Zero-days** are dropped by Push malware (the Zero-day exploits buyable, 5% of runs; no rarity, one stack, one row named "Zero-day"). They are not sold (`sellable: false`). **Clicking the Zero-day tile switches a toggle** (lit magenta while on); it cannot be switched on with none held. While it is on, **every completed Push malware run uses one Zero-day up and gets +100% critical chance** (a sure critical success, plus whatever the normal chance adds; see the Critical success buyable): a batch of runs is settled in one step, `min(runs, held)` of them covered. When the last Zero-day is used the toggle **switches itself off**; drops that arrive later do not switch it back on. Zero-days used up are not refunded when the run would be critical anyway. The toggle is saved (and read back as off when none is held) and resets by re-sleeving. Which action it works on is data (`items.zeroDay.actionId`).
- **Admin keys** are dropped by Kill servers (the Black box recorder buyable, 10% of runs; no rarity, one stack, one row named "Admin key"). They are not sold (`sellable: false`). **Clicking the Admin key tile switches a toggle** (the same mechanism as the Zero-day, with its own switch `state.adminKeysOn`, saved; it cannot be switched on with none held). While it is on, **every completed Practice Hacking run uses one Admin key up and gets +100% critical chance** (the usual critical rules), settled in closed form per batch: `min(runs, held)` runs are covered. When the last key is used the toggle switches itself off. **Skill shard drop:** every run an Admin key made critical (not one that was critical by chance, a Zero-day or a banked success) has a **2% chance** (placeholder, `items.adminKey.shard.chance`) to drop one **Skill shard**, drawn once per batch (binomial) and put in the Inventory.
- **Skill shards** have no rarity and are not sold. **Clicking the Skill shard tile uses one**: it lands on a **random unlocked action** (an action the access level allows; drawn through the injected random source) and **delays that action's XP scaling by 1 level**: leaving each of its first levels costs the first level's price, and the growth starts after them. With the default rule (10 XP, then x2): costs 10, 20, 40, 80 become 10, **10**, 20, 40 with one shard, and 10, 10, **10**, 20 with two. Each shard delays by one more level (`items.skillShard.levelsDelayed`). ACTION levels only; sleeve levels are not touched; it stacks with the XP reductions (Quick Study and the like scale the delayed thresholds). The count per action is saved and **resets by re-sleeving** (ASSUMPTION, like Augments).
- **Ransomware's bank** (`state.bankedCriticals`, per action): each critical success of Push malware adds one (+100% chance for one run); when Grow network completes runs, `min(runs, banked)` of them are covered (settled in closed form, like Zero-days) and the bank shrinks by that many. A success that the bank itself caused banks nothing unless that action has links of its own. The bank is saved (whole counts of known actions only) and resets by re-sleeving. Zero-days give Push malware's runs +100% chance, so together they feed Grow network.
- **Test drop** (test aid): drops one item by the current weights whatever the chance; before the harvest is owned it uses the configured rule.
- Known and accepted: selling stops mattering quickly because earnings outgrow it.

## 11. Re-sleeving (first prestige)

- **Positive lists:** only what these name carries over: `CARRIED_OVER_ACTION_FIELDS` (each action's sleeve XP, so its sleeve level, and the run counter towards the next sleeve XP), the record of finished runs and the synthetic sleeves (`runs`, `synths`), the corporation (`corporation`: it is not the character), and the owned buyables paid in a currency of `CARRIED_OVER_BUYABLE_CURRENCIES` (the **re-sleeve skills**). Everything else resets, including anything added later; to carry something over, add it to a list.
- The button needs a second click to confirm, with a Cancel button.
- **The requirement is the Unlock resleeving purchase** (see 7): the Re-sleeve button is hidden until it is owned and disabled for `resleeve.lockoutMs` after buying it (`ResleeveGate`, a `ResleevePolicy`). The purchase itself survives re-sleeving (`CARRIED_OVER_BUYABLE_EFFECTS`), as do the re-sleeve skills; other purchases reset. A game whose content has no such buyable has no gate.

**Every run is written down.** At each re-sleeve the life that ends is recorded, whatever skills are owned: the **credits per second its own network was producing** (after the heat tax; synthetic income is NOT part of it, so nothing compounds) and the **total of its action levels**. The Stats tab lists the latest ten runs (newest first). The record is kept for good (only a new game clears it).

**Re-sleeve points.** One per re-sleeve (`resleeve.pointsPerResleeve`). Like skill points they are not stored: points available = earned - cost of the re-sleeve skills owned. The first re-sleeve gives the first point, and sleeve XP carrying over is what lets the run be done again faster.

**Re-sleeve skills** are a tree on the Skills tab, in a group of their own (shown once Unlock resleeving is bought; the names, texts, prices and tips of the skills read "???" until the first re-sleeve): a skill needs the ones above it bought first (`requires`); locked ones are shown dimmed. They are kept through re-sleeving. All cost 1 point for now.

| Skill | Needs | Effect |
|---|---|---|
| Sleeve Euphoria | nothing | Every ACTION level of an action needs less XP, by an amount that depends on THAT action's own SLEEVE level `L`: reduction = `1 - 0.5^log10(L)`: nothing at level 1, **50% at level 10, 75% at 100**, 87.5% at 1000; concave and never 100% (ceiling 99.9%). It multiplies with the flat reductions (Quick Study) and is not part of their cap. |
| Synthetic Sleeves | Sleeve Euphoria | Run extra sleeves beside the main one (below). |
| Incorporation | Sleeve Euphoria | Founds a corporation: opens the Corporation tab (see 11b). |

**Synthetic sleeves (base behaviour).** Buying the skill gives **one at once**, copied from the **last finished run**; every re-sleeve after that gives one more, copied from the run that just ended. Runs that finished before the skill was bought are never copied. A synthetic sleeve keeps the numbers of its own run for good (each sleeve slot uses the run it belongs to) and earns `credits per second of that run x min(1, current action levels total / that run's action levels total)`; once the current sleeve has caught up, it stays at the full amount, so the base behaviour is a speed-up and not a source of growth (upgrades will change that). A run with a level total of 0 pays in full at once. **Synthetic income is not taxed by heat** (the synths paid their tax on their end) and is not multiplied by the credit lever again (the recorded value already includes it). Its value is read at the start of each slice, like the network income.

## 11b. The Corporation

The Corporation is a tab of its own (**Corporation**, shown once the **Incorporation** re-sleeve skill is owned). It is laid out like the Character tab: the **corporation widget** where the Sleeve widget is, the **Holdings**, **Asset Acquisition** and **Hostile Negotiation** widgets in their places (there is no Inventory here), and a grid of **corporation actions** where the character's actions are. The three widgets beside the corporation widget are **empty for now**. The corporation widget lists **Corporate rank** (a plain integer, 1 by default; a naming scheme comes later; it is the corporation's access level and gates its actions), **Owned corporations** (corporations that have been bought; 0, the mechanics come later) and **Employees** (0). Owned corporations and Employees are placeholders shown as constants until the corporation has state of its own; the rank is real.
- **Asset Acquisition** holds the corporation's purchases, paid in credits and **kept through re-sleeving** (like the corporation). The first is the **Corporate access upgrade** (a copy of the character's Access upgrade): **5,000,000 credits** (placeholder), **x100,000 per copy** (5 orders of magnitude), unlimited; each copy gives **+1 Corporate rank**. A corporation action has a required rank (default 1) and cannot be started below it; its card says "Needs corporate rank N". It is meant to be bought after at least two re-sleeves.

- **Corporation actions are not character actions.** They have no interface speed, **action levels** (the same XP rule as the character's, `progression.actionLevels`; each completed run gives the action's `xpPerRun`, default 1; a level speeds the run up exactly like a character action level, `speed.actionLevel`, linear +5% of the base speed per level; no prestige XP bar because the corporation has no reset) but no sleeve levels, no Overclock or Focus, no heat, no reward and no purchases of their own: a run takes the action's own duration sped up by its action level only, because the corporation scales differently from the character. A run is started by clicking the card (there is no auto-run yet), fills its bar and stops when it completes. What a completed run does is a list of **effects**, each one kind of effect with its own parameters (`CorporationEffect`).
- **Purchases of a corporation action** sit in a row on its card, like a character action's, and are paid in credits and kept through re-sleeving. The first is **Stock acquisition** on Insider backstabbing (10,000,000 credits, a placeholder): each completed run then has a **0.5%** chance (half of the upgrade chance) to acquire **one stock of a competitor**. **Stocks owned** is a row of the **Holdings** widget, shown once the purchase is owned or a stock is held. What stocks do is not designed yet.
- **Insider backstabbing** (the first action): a run takes **30 seconds**; each completed run has a **1% chance** (placeholder, in the data) to **upgrade one random Kompromat file** you hold to the next rarity. The file is picked at random among the files held in the rarities that have a next one, so a stack with 9 times the files is picked 9 times as often; files of the highest rarity are never upgraded, and with nothing to upgrade the run does nothing. The total number of files never changes.
- **The corporation survives re-sleeving** (it is not the character): its state is on the carry-over lists, so a run in progress goes on. A new game wipes it.
- **Incorporation** (re-sleeve skill, needs Sleeve Euphoria) opens the tab. Like every re-sleeve skill it is kept through re-sleeving.

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
6. Buyables for the other actions, further automation, the rest of the re-sleeve tree (upgrades for synthetic sleeves; what the corporation's own widgets will hold, and more corporation actions).
7. Later layers: several sleeves, companies, cities, planets (the late-game "derivative" copy scaling).
