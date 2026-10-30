# Cybersleeve – Game Design

The source of truth for mechanics. It describes the game as it is now; the history of how numbers changed lives in git. Names (credits, Kompromat, ...) are placeholders and may be renamed, so code never hard-codes display names. Every number below is a value in `src/content/gameConfig.ts` (see `docs/CONFIG.md`).

Status markers: **ASSUMPTION** = inferred, needs confirmation. **OPEN** = undecided. Everything else is confirmed by the user.

Last updated: 2026-10-27.

**Where the game is going:** the long-term target (story, layers, corporation phase, big numbers, player-experience rules, anti-goals) is in `docs/VISION.md`. This file stays the description of what is built.

## 1. Concept

Cyberpunk idle/incremental game. The player is a character who performs **actions**. There is no life clock: the player builds up their current **sleeve** (body) and chooses when to **re-sleeve** (the first prestige layer). Later layers, not designed yet: several sleeves at once, each replaying a copy of the previous lifetime; companies that produce ever more sleeves; cities, outposts, planets.

Scope decisions: desktop browsers only; offline progress is out of scope for now; balance matters now that players are on the live game: new content is checked against the pacing of what exists (a price against the income that pays it, a reward against the time it takes), existing tuning is changed only when asked, and a pacing concern is flagged with numbers. Being corrected later is still fine (see `docs/DECISIONS.md`, 2026-10-28). **Infinity is 1e308**: every amount is held at or below it (see 9).

## 2. Resources and the screen

- **Credits**: the main currency, starts at 0, spent on buyables. **Network nodes** (whole numbers) are built by an action, produce credits passively, and some buyables are paid in them. **Skill points** pay for skills (see 8).
- **Tabs** (on the same line as the credits, to their right): **Character** (everything below except skills and automation), **Skills** and **Automation**. The credits stay visible on all. **No tab shows until the first skill point or the first automation point has been earned** (a new game is just the character screen); then Character shows, Skills once a skill point has been earned and Automation once an automation point has. Skills and Automation show `Skills (N)` / `Automation (N)` while N points are available and **blink** while one waits to be spent.
- **Purchases appear when they are within reach:** a purchase paid in credits or nodes shows once its price is within **3 orders of magnitude** (`reveal.buyableOrders`) of the most of that currency held in this life (a peak below 1 counts as 1, so a new game shows the cheap ones). The peak only goes up, so a purchase never disappears because the credits that revealed it were spent. Owned purchases, skills and the purchases in an action's square are always shown. Peaks reset by re-sleeving.
- **Linked reveals and gated branches:** Heat and ICE Rating appear at the same moment (when either exists). The whole **Anonymity** skill branch (title and nodes) stays out of the Skills tab until Heat is revealed (`ui/view/branchGates.ts`; this overrides "skills always show every node" for gated branches). Text about sleeve levels (the Action Speed tip, Study methods, Purge Protocol) waits for Unlock resleeving; Faster conditioning and Skill transfer wait for the second sleeve run (`revealAfterResleeves`); critical-success skills and purchases wait for Critical success; Back Channel Deals waits for Push malware's Overclock. A masked skill is never highlighted or clickable.
- **Nothing is shown before it matters (a general rule for every stat, skill and purchase):** a stat row, bar, button or tree stays hidden until something exists that makes or changes it. **Heat** shows once an open action makes heat (or an owned Overclock does); **ICE Rating** once an owned purchase boosts it or an open action earns it; **Legend** once the action that earns it is open; the **sleeve XP bars, the Re-sleeve button and the re-sleeve skills** once Unlock resleeving is bought. A stat that already moved off its start is never hidden. Rules are data in `ui/view/statReveal.ts`; add an entry there for a new hidden stat.
- **Purchases are listed by base price, cheapest first,** in every widget (the price in the content, before cost growth, copies owned or levers): one helper, `sortByBasePrice` in `ui/view/buyableViews.ts`, so editing a price re-sorts the screen. Equal prices keep the content order.
- **Character layout:** a top band with the Sleeve widget on the left and, to its right, Network, **Sleeve Improvements** (sleeve-wide buyables paid in credits) and **Network Exploitation** (those paid in nodes), with the Inventory below them; a line across the screen; below it the 3x2 grid of action cards (one cell is still empty; each card has the run bar across the top, then the reward line and level bars on the left with the square of toggles beside them, see 7); export and import of the save.
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

*Moved to [docs/contexts/economy.md](docs/contexts/economy.md).*

### Sleeve Improvements (credits) and Network Exploitation (nodes)

*Moved to [docs/contexts/economy.md](docs/contexts/economy.md).*

### The square on each action card

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

### Practice Hacking

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

### Grow network

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

### Push malware, Kill servers, Build Legend

*Moved to [docs/contexts/actions.md](docs/contexts/actions.md).*

## 8. Skills

*Moved to [docs/contexts/skills.md](docs/contexts/skills.md).*

### 8b. Automation

*Moved to [docs/contexts/automation.md](docs/contexts/automation.md).*

## 9. Infinity and big numbers

*Moved to [docs/contexts/kernel.md](docs/contexts/kernel.md).*

## 10. Items, drops, the Inventory and Augments

*Moved to [docs/contexts/items.md](docs/contexts/items.md).*

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
6. Buyables for the other actions, further automation, the rest of the re-sleeve tree (upgrades for synthetic sleeves; what the corporation's own widgets will hold, and more corporation actions).
7. Later layers: several sleeves, companies, cities, planets (the late-game "derivative" copy scaling).
