# Cybersleeve – Game Design

Players see skills as **Firmware** and sleeve skills as **Sleeve Firmware**; code, saves and developer docs say skill.

The source of truth for mechanics. It describes the game as it is now; the history of how numbers changed lives in git. Names (credits, Kompromat, ...) are placeholders and may be renamed, so code never hard-codes display names. Every number below is a value in `src/content/gameConfig.ts` (see `docs/CONFIG.md`).

Status markers: **ASSUMPTION** = inferred, needs confirmation. **OPEN** = undecided. Everything else is confirmed by the user.

Last updated: 2026-10-27.

**Where the game is going:** the long-term target (story, layers, corporation phase, big numbers, player-experience rules, anti-goals) is in `docs/VISION.md`. This file stays the description of what is built.

## 1. Concept

Cyberpunk idle/incremental game. The player is a character who performs **actions**. There is no life clock: the player builds up their current **sleeve** (body) and chooses when to **re-sleeve** (the first prestige layer). Later layers, not designed yet: several sleeves at once, each replaying a copy of the previous lifetime; companies that produce ever more sleeves; cities, outposts, planets.

Scope decisions: desktop browsers only; offline progress is out of scope for now; balance matters now that players are on the live game: new content is checked against the pacing of what exists (a price against the income that pays it, a reward against the time it takes), existing tuning is changed only when asked, and a pacing concern is flagged with numbers. Being corrected later is still fine (see `docs/DECISIONS.md`, 2026-10-28). **Infinity is 1e308**: every amount is held at or below it (see 9).

## 2. Resources and the screen

- **Credits**: the main currency, starts at 0, spent on buyables. **Network nodes** (whole numbers) are built by an action, produce credits passively, and some buyables are paid in them. **Firmware points** pay for firmware (see 8).
- **Tabs** (on the same line as the credits, to their right): **Character** (everything below except skills and automation), **Firmware** and **Automation**. The credits stay visible on all. **No tab shows until the first skill point or the first automation point has been earned** (a new game is just the character screen); then Character shows, Firmware once a skill point has been earned and Automation once an automation point has. Firmware and Automation show a badge with N (gold for skill points, purple for automation points) while N points are available and **blink** while they have earned points you have not looked at yet (opening the tab stops it; a new point after a re-sleeve blinks again; after a reload only unspent points blink). **What has been shown stays shown:** a stat, tab, skill or purchase you have seen is remembered for good (it survives re-sleeving). A remembered skill whose requirements are unmet again is readable but faded, a remembered purchase is greyed and cannot be bought until its requirements are met.
- **Purchases appear when they are within reach:** a purchase paid in credits or nodes shows once its price is within **3 orders of magnitude** (`reveal.buyableOrders`) of the most of that currency held in this life (a peak below 1 counts as 1, so a new game shows the cheap ones). The peak only goes up, so a purchase never disappears because the credits that revealed it were spent. Owned purchases, skills and the purchases in an action's square are always shown. Peaks reset by re-sleeving.
- **Linked reveals and skill texts:** Heat and ICE Rating appear at the same moment (when either exists). Inside the Firmware tab every Sleeve Firmware tree (every branch, title and node) is always visible; only a skill's text reads `???` until it is readable. The Sleeve Firmware trees show once a sleeve skill point has been earned. Text about sleeve levels (the Action Speed tip, Study methods, Purge Protocol) waits for the Sleeve levels upgrade; Faster conditioning and Skill transfer wait for the second sleeve run (`revealAfterResleeves`); critical-success skills and purchases wait for Critical success; Back Channel Deals waits for Push malware's Overclock. A masked skill is never highlighted or clickable.
- **Nothing is shown before it matters (a general rule for every stat, skill and purchase):** a stat row, bar, button or tree stays hidden until something exists that makes or changes it. **Heat** shows once an open action makes heat (or an owned Overclock does); **ICE Rating** once an owned purchase boosts it or an open action earns it; **Legend** once the action that earns it is open; the **sleeve XP bars and the Re-sleeve button** once Sleeve levels is bought, and the **Sleeve Firmware** once the first sleeve skill point has been earned. A stat that already moved off its start is never hidden. Rules are data in `ui/view/statReveal.ts`; add an entry there for a new hidden stat.
- **Progress and skill points (2026-10-31):** skill points arrive at total action levels 1, 5, 10, 20, 30 and so on (content `skills`). A re-sleeve needs total sleeve levels of 5 + the number of earlier re-sleeves; the tip lists sleeve levels held and needed. Action levels give +1% speed per level and their XP costs grow by 1.2 per level; sleeve progression is unchanged. Every sleeve skill costs 1 sleeve skill point. ICE Rating lowers heat's effect by the square root of its orders of magnitude over 100 (20% at 1e4, all of it at 1e100). Rarity refinement is a Leverage skill after Black Ledger.
- **Purchases are listed by base price, cheapest first,** in every widget (the price in the content, before cost growth, copies owned or levers): one helper, `sortByBasePrice` in `ui/view/buyableViews.ts`, so editing a price re-sorts the screen. Equal prices keep the content order. In the Upgrades currency rows, bought one-time purchases move to the front in base-price order; maxed repeatables keep their place. Tiles show a price strip (MAX when maxed), gold affordability and an owned-count badge for repeatables.
- **Top bar and panels (2026-10-31):** the top bar shows the credits in large monospace, and the total income per second in green from the first time it is above 0 (network after heat tax plus synthetic sleeves; once shown it stays, also at 0 and after a re-sleeve). Heat is shown in the Sleeve panel, not in the top bar. Panels have `// TAG` headers with a status light (Sleeve `ONLINE`, Network `LINKED` while there are nodes). The Sleeve stats are grouped: ACCESS (Access Level), SKILL (Interface speed, Hacking Proficiency, Critical success), DEFENSE (ICE Rating, Legend and its decay bar, shown only while there is Legend) and RISK (heat with a gauge: a strip whose striped tax zone starts where the tax takes every credit, or a note naming the cap when it is capped, and the cooldown bar giving `-amount / seconds`). The Re-sleeve button sits in a RE-SLEEVE box at the bottom. Under the Network income a red note says what share the heat tax takes, while there are nodes for it to tax. Panel values show at most 4 significant figures; tooltips keep full precision. Colours have one meaning each (cyan information, magenta running, orange heat, red danger or loss, green gain, purple automation, gold affordable), listed at the top of `ui/style.css`.
- **Character layout:** a top band with the Sleeve widget on the left and, to its right, Network and **Upgrades** (SLEEVE row paid in credits, NETWORK row paid in nodes), with the Inventory below them; a line across the screen; below it the 3x2 grid of action cards (one cell is still empty; each card has the run bar across the top, then the reward line and level bars on the left with the square of toggles beside them, see 7); export and import of the save.
- **Test aids** (Reset save, Speed x10, Test drop) are shown only in development builds or with `?debug` in the address. To be removed before release.

## 3. Actions

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

## 4. Levels, XP and speed

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

## 5. The sleeve widget

*Moved to [docs/contexts/sleeve.md](docs/contexts/sleeve.md).*

## 6. Network and passive income

*Moved to [docs/contexts/economy.md](docs/contexts/economy.md).*

## 7. Buyables

Skill Transfer adds Practice Hacking's sleeve level to Grow network's effective level for every derived level calculation. Stored levels, XP, progress, skill-point totals and re-sleeve requirements stay real.

| Buyable | Location and cost | Effect |
|---|---|---|
| Networked Sleeve | Upgrades, NETWORK row; 10,000 nodes once; two Sleeve Firmware | Adds the distinct sleeve skill count to Practice Hacking's effective level. |
| Network Safety Protocols | Upgrades, NETWORK row (affects Grow network runs); 3,500 nodes, ×50 per copy, unlimited; one sleeve skill and Grow network Overclock | Each run has 5% chance to earn 1 base ICE Rating; each additional copy adds 1 percentage point, capped at 100%. |
| Cloaking Protocols | Upgrades, SLEEVE row; 5e11 credits once; one sleeve skill and Grow network Overclock | Multiplies heat tax by 0.97 per distinct sleeve skill. Survives re-sleeve; ordinary credit-paid improvements reset. |

*Moved to [docs/contexts/economy.md](docs/contexts/economy.md).*

### Upgrades: SLEEVE (credits) and NETWORK (nodes)

*Moved to [docs/contexts/economy.md](docs/contexts/economy.md).*

### The square on each action card

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

### Practice Hacking

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

### Grow network

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

### Push malware, Kill servers, Build Legend

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

## 8. Firmware

*Moved to [docs/contexts/skills.md](docs/contexts/skills.md).*

The Firmware tab shows its main branches as side-by-side cards, each with a purpose, installed/total count and segmented progress. Gold firmware-point and magenta sleeve-firmware-point readouts show the points available. Nodes distinguish installed, affordable, available, locked and encrypted firmware; a legend explains these states while any displayed firmware is encrypted. Encrypted nodes count in branch totals because their places are already visible, but disclose no names, descriptions or costs; an entirely encrypted branch hides its purpose.

Hover previews firmware and lights its parent paths; clicking pins the selection in the inspector. **INSTALL buys the selected firmware; clicking a node on this tab only selects it.** The inspector shows the full effect, requirements, what unlocks next, cost and any reason installation is unavailable. Automation still buys on node click. Sleeve Firmware retains its joined tree, with a labelled Sleeve Up! trunk and a persistent frame: installed Sleeve Firmware is kept across re-sleeves. Its existing reveal gates still apply.

### 8b. Automation

*Moved to [docs/contexts/automation.md](docs/contexts/automation.md).* Kompromat autosale is unlocked per rarity; its fork adds auto Back Channel before autosale. Augment dispersal applies permitted rarities evenly to selected unlocked actions; its chain grants up to six selections. Removed placeholders refund their automation points on load.
The Auto Burn panel shows a status line (STANDBY, IDLE, BLOCKED, DRY, HOLDING or BURNING), heat, held leads and the display-only Inventory toggle. Each owned skill reveals its part: the Floor strip and THROTTLE, the Redline notch and REDLINE row, FAILSAFE target chips, RESTART target sub-rows, editable Floor/Redline values, then Reserve. The restart lists show every heat-making Auto-run and Overclock of an action the sleeve can reach; one the sleeve has not unlocked yet has a red border, cannot be picked, and its tooltip says so (a list with none reachable shows a muted line). Floor and Redline stay fixed until Tune Thresholds; Reserve counts leads kept untouched. The heat strip spans 0..max(1.5 x Redline, Floor + 1), with overflow heat pinned at the edge while its label retains the real value. Activity, firing flags and lead availability come only from `autoBurnStatus.ts` through `AutoBurnControls.status()`; the same owner supplies the off/on conditions used by Auto Burn. Full mechanics: [automation context](docs/contexts/automation.md).

## 9. Infinity and big numbers

*Moved to [docs/contexts/kernel.md](docs/contexts/kernel.md).*

## 10. Items, drops, the Inventory and Augments

*Moved to [docs/contexts/items.md](docs/contexts/items.md).* The Inventory uses named stash slots (icon, name, rarity/CONSUMABLE caption, count), a legend of shown sellable rarities, and selected-stack gains on Sell / Sell all. In short: an item and its rarity show in the Inventory only once found (or held); the Augment button waits for the upgrade that drops schematics. Kompromat sells for the larger of a floor per rarity and some seconds (60 for common, x5 per rarity) of this life's peak network income.

## 11. Re-sleeving (first prestige)

*Moved to [docs/contexts/resleeve.md](docs/contexts/resleeve.md).*

## 11b. The Corporation

*Moved to [docs/contexts/corporation.md](docs/contexts/corporation.md).*

## 12. Time

*Moved to [docs/contexts/engine.md](docs/contexts/engine.md).*

## 13. Open questions

1. Confirm the sleeve-XP counter model (each completed run counts as one run; reward multipliers do not change it).
2. The real re-sleeve requirement, and whether buyables should survive it.
3. The design of the infinity prestige.
4. Theme text and names for the actions, buyables and currency; story beats and tone.
5. Offline progress (later; the save needs a timestamp then).
6. Buyables for the other actions, further automation, the rest of the Sleeve Firmware tree (upgrades for synthetic sleeves; what the corporation's own widgets will hold, and more corporation actions).
7. Later layers: several sleeves, companies, cities, planets (the late-game "derivative" copy scaling).
