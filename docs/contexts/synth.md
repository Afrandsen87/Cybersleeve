# Context: synth

Synthetic sleeves: copies of finished runs.

Code: `src/core/synth/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Architecture (S9)
`SynthSleeves` (`synth/synthSleeves.ts`) measures each synthetic sleeve against a level total it is given per sleeve (`SynthLevelInput`, constructor argument); the default is the live sleeve's total, so behaviour is unchanged, but a later layer can measure a sleeve against another sleeve. The Hive Interface and corporation-speed formula is `synthBoost` in `kernel/curves.ts`. The sleeves are saved by `synth/synthSave.ts` (a part of the save, see `contexts/save.md`). Tests: `synthLevelInput.test.ts`, `synthLane.test.ts`.

**Dormant sleeves (2026-10-31).** `wallet.synths` and `wallet.runs` are saved whether or not Synthetic Sleeves is owned; ownership only gates what the sleeves DO: `SynthSleeves.count()`, `creditsPerSecond()` and `incomeCeiling()` read 0 while the skill is not owned. Buying the skill gives the first sleeve only when there are none yet, so refunding (save v10) and buying it again restores the old sleeves and income without a duplicate. A re-sleeve while the skill is not owned gives no new sleeves.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Hive Interface** at one tenth of ln(1 + synthetic sleeves) (the user agreed the first value was weak). **Cloning Vats:** two per re-sleeve. **Perfect Copies:** each synthetic sleeve earns at least the network's own income now (a maximum with its recorded income, so a fresh life does not earn less than before). **Synthetic Workers** (was Board Seat): corporation run speed with synthetic sleeves. **Synthetic Procurement:** only the unlock, with an empty Synthetic Sleeves widget on the Corporation tab.

*Group: Decided 2026-10-30 (by the user)*
- **A synthetic sleeve earns the PEAK credits per second of the run it copies** (own network only; see resleeve.md), not the rate at the moment that life ended.
- **Synthetic income is interpolated in orders of magnitude** (decided 2026-10-30, by the user): `(1 + record)^p - 1` with `p = min(1, current levels / recorded levels)` and the current levels include the fraction of each action's current level, so one level no longer jumps a synth from 0 to millions.
- **`SynthSleeves.incomeCeiling()`** is what all synthetic sleeves earn at full action levels (the per-sleeve formula at progress 1, with the Perfect Copies floor); same summing code as `creditsPerSecond`. Shown as "Scales to" in the synthetic sleeves tip.
