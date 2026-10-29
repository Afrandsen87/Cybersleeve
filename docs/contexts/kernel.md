# Context: kernel

Number safety: BigNum adapter use, Infinity (1e308) clamping, sampling, curves, memo cache.

Code: `src/core/kernel/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Interface, state and config (S3)

- **Interface (what other contexts may import):** `infinity.ts` (`INFINITY`, `saturate`), `concaveBonus.ts` (`concaveBonus`), `curves.ts`, `sampling.ts`, `fields.ts` / `overflow.ts` / `snapshot.ts` (scalar fields and the overflow policy). Kernel imports nothing from another context (only `numbers/`).
- **`curves.ts` (P9): the "per order of magnitude" helpers.** `orders(number)` is the continuous `log10`, 0 for values up to 1, NaN and negatives (`Infinity` stays `Infinity`); used by Sleeve Euphoria and Deep Cover (Mole aggregation). `bigOrders(BigNum)` is the same for a `BigNum` but 0 whenever the logarithm is not finite; used by the ICE Rating heat reduction. `wholeOrders(BigNum)` is the floor (`floorLog10`), 0 under 10; used by rarity shifts (step effects, not smooth ones). `logScaled(scale, x)` is `scale * log10(1 + x)`, unclamped; used by Residual Proficiency. Continuous and whole are different meanings on purpose and keep different names. Left as they are, with the reason: `levelRewardFactor` (`1 + c * ln(1 + level / scale)`) is not `concaveBonus` (that one clamps NaN, negatives and overflow to 0 / infinity, this one lets them through, and the argument is divided by `scale` inside), so folding it in would change results at the edges; `earnedSkillPoints` (`floor(log10(total) + 1e-12)`) carries a precision epsilon that no other variant has; the corporation and resleeve `ln(1 + synth count)` factors are natural-log factors, not orders.
- **`sampling.ts` (P11): `perRunEvents(runs, chance, random)`** is the one entry point for "how many of a batch of runs trigger an event". One `binomial` draw per call, none for no runs, no chance or a certain chance. Item drops, linked payouts (Fiber Tap), the heat draw in `ActionRunner`, corporation stocks and item upgrades, Zero-day / Admin key shard drops and critical successes all go through it. `multinomial` (splitting a count over categories) stays separate.
- **Config variables:** none. Everything here is a representational limit (`INFINITY` = 1e308), not tuning.

## Design (from DESIGN.md)

### 9. Infinity and big numbers

- **Infinity is 1e308** (`core/kernel/infinity.ts`). After every step every amount (credits, nodes, XP, ICE Rating, ...) above it, and any overflow, is clamped to 1e308; NaN becomes 0 and never a windfall. Multipliers derived from an amount saturate there. Reaching it calls a listener, the hook for the future **infinity prestige** (OPEN: its design).
- Amounts are `BigNum` behind an interface; level maths stays exact beyond the double range.

## Architecture (from docs/ARCHITECTURE.md)

### Number handling (replaces the reference game's workarounds)
All amounts are `BigNum` (mantissa/exponent). The adapter treats exponent ≥ 9e15 (library saturation) as non-finite, so overflow is detectable. **Infinity is 1e308** (`core/kernel/infinity.ts`, decided 2026-10-26): it sits just under the largest double, so the plain-number multipliers (interface speed, node payout, the speed product) and the `BigNum` amounts overflow at the same place instead of the doubles plateauing silently long before the amounts do. No iteration over huge counts (runs are batched, see Tick loop), no rounding hacks. After every slice the `OverflowPolicy` repairs non-finite scalars and XP; the default clamps every amount above 1e308, and positive overflow, to 1e308 (the largest safe integer for plain-number scalars) and calls an optional `onInfinity` listener when an amount sits at infinity and turns negative overflow and **NaN into 0** (NaN is a bug upstream and must never become a windfall) so the state stays valid and saveable. The real reaction, the "infinity" prestige, is not designed yet: the listener is its hook. Level calculation uses `floorLog10`, exact at powers of ten and valid beyond the double range (tested up to 1e1000).

## Configuration (from docs/CONFIG.md)

### `global` – broad levers (all > 0, 1 = unchanged)
`speedMultiplier`, `creditMultiplier`, `xpMultiplier`, `costMultiplier`. `creditMultiplier` scales credits only (run rewards paid in credits and passive network income); it never changes nodes, ICE Rating, Legend or the interface-speed and node-payout bonuses. There is deliberately no lever that scales every reward kind: a lever for another kind would be its own named setting.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-24 (by the user)*
- **Big numbers:** our own `Decimal`-style **interface**, backed by a proven library (e.g. break_infinity.js / break_eternity.js) behind an adapter so it can be swapped. Game code never imports the library directly.

*Group: Decided 2026-10-26 (by the user, Overclock, Focus and Burn leads)*
- The "nodes are whole" test invariant allows for the number type's precision: `break_infinity` cannot hold every integer above about 1e8 exactly (existing limitation, not yet addressed).

*Group: Working conventions (in use)*
- Runs are applied in closed-form batches (no per-run iteration); keep it that way when adding mechanics, and extend `batching.test.ts` so one long tick and many short ones give the same run results.

*Group: Decided 2026-10-26 (by the user, after the full review)*
- **Infinity is 1e308** (`core/kernel/infinity.ts`, `INFINITY`). Every amount is clamped to it by the overflow policy after every slice and every multiplier derived from an amount saturates there (`saturate`); reaching it calls the policy's `onInfinity` listener (the hook for the future infinity prestige, whose design is still open). It is a representational limit, not a tuning value.
