# Approved scope after the Phase 1 checkpoint (2026-10-29)

Supersedes the design rides in `migration-plan.md` where they differ. Anything not listed here is **dropped** (the user will address it another way later; do not do it, do not re-ask).

## (a) Context map: approved as in `target-architecture.md`
Sleeve and corporation are designed so that more than one *can* exist, with no assumption that it will. In practice: key state by id (one entry today), no new global singletons, no behaviour or UI for a second one, and no rule about assigning sleeves to corporations (D2 assignment is dropped).

## (b) Design findings
| Id | Decision | Scope |
|---|---|---|
| D1 | Do | Wallet vs `SleeveState` split, optional sleeve id on queries. STRUCT + SAVE (Step 9). |
| D2 | Do, structure only | Corporation state keyed by id; synth income takes its level input per record, not from the live sleeve. No assignment rule, no new gameplay. SAVE rides on Step 9. |
| D3 | Do, as redesigned | See below. |
| D4, D5, D7, D8, D9-D12 | Dropped | Skill-point measuring, Cascade failure, corporation auto-run, corporation currency, reveal/doc gaps, near-duplicates: not done. (D9 doc drift items that are code-comment fixes inside a step are fine.) |
| D6 | Study methods only | Redesign the scaling; **user reviews before any code**. Other parts of D6 (placeholder options) dropped. |

### D3: re-sleeve needs a total of sleeve levels
Interpretation (confirm before Step 10): the Nth re-sleeve needs the sum of all actions' sleeve levels to reach a threshold `T(N)` that rises with N (sleeve levels carry over, so the total only grows). Until then the Re-sleeve button is disabled and its tip states the shortfall. Each re-sleeve still gives its re-sleeve point; points stay "one per re-sleeve" (derived from `runs.length`), so **no save bump or migration is needed**: the gate is derived from existing state (`runs.length`, the sleeve XP that already carries over). `T(N)` lives in content (`resleeve.sleeveLevelsPerResleeve`, a list or a base+step) and `docs/CONFIG.md`. Touches DESIGN.md section 11 ("Re-sleeve points" and the button), `core/resleeveGate.ts` (a second gate policy next to the Unlock purchase), `resleever.ts`. An existing save already past a threshold is simply allowed. Reveal: the shortfall text appears only once Unlock resleeving is owned. Pacing note for the report: the first re-sleeve is today instant after the purchase plus lockout; set `T(1)` low so the first one is not delayed.

### D6: Study methods redesign — proposal for review
Problem [V]: effect is `perLevel 0.0001` (0.01% per Practice Hacking sleeve level), cap 25%. A sleeve level costs `10 x 2^L` XP and 1 XP needs 10-100 runs, so PH sleeve levels in the tens give a 0.1-0.3% cut. And a cut of `r` is only worth `log2(1/(1-r))` extra levels, because costs double per level.

Proposed: **the other actions' sleeve XP requirement is divided by `1 + L`** where `L` is Practice Hacking's sleeve level. As a reduction: `r = L / (L + 1)`. One parameter (`halfAt`, 1) so `r = L / (L + halfAt)`. Never reaches 100%. **Update 2026-10-29: no ceiling** (the user does not want it capped); apply it as a divisor after the shared 0.99 clamp. If it still feels small once played, the lever changes from XP cost to extra levels; see `execution-plan.md` S7.

| PH sleeve level L | cut r | extra sleeve levels on each other action |
|---|---|---|
| 0 | 0% | 0 |
| 1 | 50% | 1.0 |
| 2 | 67% | 1.6 |
| 5 | 83% | 2.6 |
| 10 | 91% | 3.5 |
| 20 | 95% | 4.4 |
| 100 | 99% (cap) | 6.6 |

Why this shape: useful at the first PH sleeve level (the buyable is bought late, at 1e15 credits, so it should pay at once); concave like Sleeve Euphoria (levels cost doubling, so the benefit is log-like in L, not linear); one readable sentence for the tip ("needs 1/(1+L) of the XP"). Alternative if you want stronger late growth: a geometric form `r = 1 - 0.8^L` (20% at L=1, 67% at 5, 89% at 10, ceiling by L about 20); it is linear in extra levels but hits the 99% ceiling early.

Touches: `content/buyables/practiceHacking.ts` (effect fields `perLevel`, `maxReduction` become `halfAt`), `core/buyableTypes.ts` and `effectRegistry.ts` entry for `sleeveXpReduction` (validation), `core/progression.ts` sleeve reduction, DESIGN.md line 149, CONFIG.md `buyables[]`, tests in `buyableEffects.test.ts`/`progression` tests (state: 0 at L=0, 50% at L=1, monotone, never 1, NaN/huge L safe). Reveal: unchanged (still waits for Unlock resleeving). No save change: the buyable id and ownership are unchanged. Balance note: the 1e15 price is not touched; with this curve it becomes a strong buy, so check the price against income when you review. Lands in Step 8 (or earlier if you want it standalone).

## (c) Instruction edits: approved
Apply `claude-md-proposal.md` after Step 3 as planned; then ask about `npm run agents:sync`.

## (d) Code findings P1-P15: all approved
(P15 stays "document, no change unless a third heat source appears".)

## Changes to the migration plan
- Step 6: remove "D5 Cascade".
- Step 8: remove D4; D6 becomes the Study methods redesign above, after your review.
- Step 9: D1 + D2 structure (keyed corporation, per-record level input).
- Step 10: D3 as redesigned (a gate, no migration). Remove the "derived-points migration".
- Step 11: remove D7 and D8 and the assignment rule; keep the keyed-by-id state.


## After the second review
- D3: accepted as written for now; the gate means the skill point from re-sleeving dominates other choices. Staying longer in a sleeve is to be made meaningful by other mechanics later.
- D6: curve `L/(L+1)` accepted, ceiling removed (see above).
- Execution order: `execution-plan.md` (12 sessions) replaces the 15 steps' order.
