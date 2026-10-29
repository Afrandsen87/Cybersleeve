# Context: economy

Credits, network nodes, passive income, the shop and price growth, purchase reveal.

Code: `src/core/economy/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Design (from DESIGN.md)

### 6. Network and passive income

- Every node produces **0.01 credits per second**, continuously, also while no action runs. Per node: `(0.01 + Push malware bonus) × credit lever × Node payout multiplier`. **The heat tax is not part of it:** it takes its share of the whole **credits per second** (nodes × payout per node × share kept), shown as its own line in the Credits per second tip. Each boost in the payout is named with its value in the Payout per node tip.
- The Network widget shows, in order: nodes, payout per node (what one node really pays per second now), credits per second, **Moles** (shown once Back Channel Deals is owned or Moles are held), and, once the skill Synthetic Sleeves is owned, two lines: the **number of synthetic sleeves** and the **credits per second they earn together** (see 11). The payout tip shows the calculation step by step.
- **Nodes are whole numbers:** nodes gained per run round down per run; prices in nodes round up; percentage costs round down and must be at least 1; saves floor the count; Self-replication carries its fractional growth between ticks.
- Nodes finished during a tick start producing on the next tick (ASSUMPTION, implemented). The network resets by re-sleeving.

### 7. Buyables

Defined as data. Action buyables sit in their action's card as square buttons; a buyable's card only decides where it is shown, its effect may reach further. Name, price and description appear in a hover tip. A rebuyable lights up when it has been bought before and the next copy is affordable. Unavailable buyables (missing `requires`) are hidden. Buyables reset by re-sleeving, all copies (ASSUMPTION).

**Auto-run is a toggle:** once owned, a click on its cell of the square switches it on or off (it starts on; an off button is struck through, the tip says ON/OFF). Each restart of an auto-run pays the start cost again.

### Sleeve Improvements (credits) and Network Exploitation (nodes)
Sorted by base price within *Rebuyable* (no heading in the widget), *One-time* and *Paid in nodes*.

| Buyable | Cost | Effect |
|---|---|---|
| Access upgrade | 5 credits, ×1000 per copy, **at most 4 copies** (access level 5) | +1 access level per copy (copies stack). The re-sleeve skill Clearance Escalation allows a 5th copy (access level 6), which is meant for the sixth action (not designed yet). |
| Interface boost | 10 credits, ×1000 per copy, unlimited | +0.05 base interface speed. |
| Critical success | 50 credits, ×1000 per copy, unlimited | +5% chance per copy (no cap: above 100% a run can have several critical successes) that any completed run, of any action, is a critical success. |
| Faster conditioning | 1,000 credits, ×100 per copy, 90 copies at most | Every action needs 1 run fewer per batch of sleeve XP for each copy, from 100 runs down to a floor of 10. The re-sleeve skill Deep Conditioning allows 5 more copies and lowers the floor with them, to 5. |
| Overclock upgrade | 250,000 credits (1000× the old unlock price), ×1000 per copy, unlimited | Makes the gains of **every** Overclock 10% stronger per copy (the costs stay). Does not unlock anything: each action unlocks its own Overclock. See 3. |
| Focus upgrade | 1,000,000 credits (1000× the old unlock price), ×100,000 per copy, at most 4 | One more action can be focused at once per copy (1 slot is free, so 4 copies give every action a slot). Does not unlock anything: each action unlocks its own Focus. See 3. |
| ICE Rating boost | 150,000 credits, ×100 per copy, unlimited | ICE Rating ×2 per copy. |
| Unlock resleeving | 100,000,000,000 credits, one time | **Not listed with the other purchases: it is the Re-sleeve button**, at the bottom of the Sleeve widget. It appears (showing its name and price) once its price is in reach; one click buys it and the button turns into the Re-sleeve action. It opens **sleeve levels** (sleeve XP is tracked from the start, but its levels read 0 and give nothing until this is bought; the XP bars appear), re-sleeving (see 11) and the **re-sleeve skill tree**. Kept when you re-sleeve. Buying it starts a lockout of `resleeve.lockoutMs` (5 s of game time) in which the button is disabled, so a double click cannot re-sleeve at once. |
| Node payout | 25 **nodes** (spent), ×10 per copy, unlimited | Each node produces 100% more credits (×2 per copy, compounding). |
| Node uplink | 10 **nodes** (spent), ×10 per copy, unlimited | +0.1 base interface speed. |

## Configuration (from docs/CONFIG.md)

### `reveal` – when purchases appear (optional)

| Field | Type | Meaning |
|---|---|---|
| `buyableOrders` | number >= 0 (`Infinity` shows everything) | A purchase paid in credits or nodes shows once its next price is within this many orders of magnitude of the most of that currency held this life (`peakCredits`, `peakNetwork`; a peak below 1 counts as 1). Owned purchases, skills and the purchases in an action's square always show. Real content: 3. Leave the section out to show everything (the unit tests do) |

### `network`
| Field | Meaning |
|---|---|
| `creditsPerNodePerSecond` | Credits each network node produces per second of game time (>= 0, default 0.01). Multiplied by `global.creditMultiplier`. Paid every tick, also while no action runs |

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-26 (by the user, after the full review)*
- **Reveal, price order and the Sleeve levels gate (2026-10-27):** stats, bars, buttons and trees stay hidden until something makes or changes them (`ui/view/statReveal.ts`, `ui/view/sleeveGate.ts`); purchases are sorted by base price in one helper (`sortByBasePrice`). Sleeve levels is a one-time 100e9-credit buyable with the `unlockSleeveLevels` effect: until owned, sleeve XP is tracked but `Progression.sleeveLevelAt` returns 0; it gates re-sleeving through `ResleeveGate` (a `ResleevePolicy`) with a lockout (`resleeve.lockoutMs`, game time, counted down in `advance` in the state scalar `resleeveLockoutMs`) and survives re-sleeving through the positive list `CARRIED_OVER_BUYABLE_EFFECTS`. Content without the buyable has no gate (unit-test configs). Push malware prices were raised (Hardened payload 100k, Zero-day exploits 5M, Ransomware 5e9, Persistence 1e12). The ICE tip names the purchase behind the per-level bonus.
