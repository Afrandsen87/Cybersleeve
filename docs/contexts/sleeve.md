# Context: sleeve

Sleeve stats: access level, ICE Rating, Hacking Proficiency, sleeve levels, Sleeve Euphoria.

Code: `src/core/sleeve/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Design (from DESIGN.md)

### 5. The sleeve widget

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

## Configuration (from docs/CONFIG.md)

### `sleeve` – starting values of the global sleeve stats
| Field | Meaning |
|---|---|
| `baseAccessLevel` | Access level of a new sleeve (integer >= 1, default 1). Actions with a higher `requiredAccessLevel` stay locked |
| `baseInterfaceSpeed` | Interface speed of a new sleeve (> 0, default 0.1): a multiplier on the speed of every action, shown on screen as a plain number |
| `earnedSpeedScale` | Slope at 0 of the curve applied to the interface speed earned by actions (> 0, default 1: the first runs count in full) |
| `earnedSpeedKnee?` | Hacking Proficiency at which the curve changes shape (>= 0, default 1). Only matters together with `earnedSpeedExponentBeyond`. Real content: 1 |
| `earnedSpeedExponentBeyond?` | The shape past the knee (<= 1, same meaning as `earnedSpeedExponent`). The curve continues from the value AND the slope it has at the knee, so nothing jumps: `bonus(knee) + scale x (1 + knee)^exponent x (r^beyond - 1) / beyond` with `r = (1 + earned) / (1 + knee)`. Below `earnedSpeedExponent` it flattens the curve past the knee; leave it out for one curve all the way. Real content: 0.1 |
| `earnedSpeedExponent` | Shape of that curve (<= 1, default 0.25). The applied bonus is `scale * ((1 + earned)^exponent - 1) / exponent`: 1 = straight line, 0 = logarithm (`scale * ln(1 + earned)`), in between = diminishing returns with no ceiling. Lower is stricter |
| `baseHeat` | Heat of a new sleeve (>= 0, default 0). Actions add heat (`heatPerRun`, `heatPerSecond`); the cooldown removes it |
| `heatTaxPerPoint` | Share of the credits network nodes produce that one point of heat takes (>= 0, default 0.01 = 1%). ICE Rating lowers the effect. Node credits stop at `1 / heatTaxPerPoint` heat without ICE Rating |
| `heatCooldownMs` | Length of one heat cooldown cycle (> 0, default 60000 = 60 s). The cycle only advances while heat is above 0 |
| `heatCooldownAmount` | Heat removed each time a cooldown cycle completes (> 0, default 1). The skill Purge Protocol (`heatCooldownAmountFromSleeveLevel`) adds `perLevel` per sleeve level of its source action |
| `baseIceRating` | ICE Rating of a new sleeve (>= 1, default 1) |
| `iceRatingReductionPerOrder` | Share of heat's effect removed per order of magnitude of ICE Rating (>= 0, default 0.005 = 0.5%, so 100% at 1e200) |
| `legendHeatSpeedup` | Each Legend point makes heat cool this much faster: the cycle is divided by `1 + this x Legend` (>= 0, default 0.1 = 10%) |
| `legendDecayPeriodMs` | Legend falls by exactly 1 each time this many ms have passed, in whole steps like the heat cooldown (> 0, default 600000 = 10 min) |

Current sleeve buyables (placeholder prices): **Interface boost** (10 credits, +0.05 interface speed, so 0.1 becomes 0.15, one-time), **Access upgrade** (5 credits, `costGrowth: 1000`, unlimited, +1 access level per copy). Required access levels: Grow network 1, Practice Hacking 2, Push malware 3, Kill servers 4, Build Legend 5.

