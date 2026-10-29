# Context: synth

Synthetic sleeves: copies of finished runs.

Code: `src/core/synth/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Architecture (S9)
`SynthSleeves` (`synth/synthSleeves.ts`) measures each synthetic sleeve against a level total it is given per sleeve (`SynthLevelInput`, constructor argument); the default is the live sleeve's total, so behaviour is unchanged, but a later layer can measure a sleeve against another sleeve. The Hive Interface and corporation-speed formula is `synthBoost` in `kernel/curves.ts`. The sleeves are saved by `synth/synthSave.ts` (a part of the save, see `contexts/save.md`). Tests: `synthLevelInput.test.ts`, `synthLane.test.ts`.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-27 (by the user, more re-sleeve skills)*
- **Hive Interface** at one tenth of ln(1 + synthetic sleeves) (the user agreed the first value was weak). **Cloning Vats:** two per re-sleeve. **Perfect Copies:** each synthetic sleeve earns at least the network's own income now (a maximum with its recorded income, so a fresh life does not earn less than before). **Synthetic Workers** (was Board Seat): corporation run speed with synthetic sleeves. **Synthetic Procurement:** only the unlock, with an empty Synthetic Sleeves widget on the Corporation tab.
