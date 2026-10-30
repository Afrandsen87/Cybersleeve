# Context: config

Configuration types and their validation.

Code: `src/core/config/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Decisions (from docs/DECISIONS.md)


*Group: Working conventions (in use)*
- **No hard-coded tuning:** every number that affects progression (durations, rewards, XP, level thresholds, level worth, prices, caps, intervals) must live in `src/content/gameConfig.ts` (`GameConfig`) and be validated in `core/config/config.ts`. Describe new variables in `docs/CONFIG.md`. Unit tests use `src/testing/testConfig.ts`, never the real tuning.

*Group: Working conventions (in use)*
- Tests for the real content (`content/gameConfig.test.ts`) check invariants, never tuning numbers.
