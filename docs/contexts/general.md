# Context: general

Cross-cutting decisions that fit no single context.

Code: `src/core/general/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-24 (by the user, after the first full review)*
- **Offline progress is out of scope for now.** **Balance is not a factor yet** (more mechanics, incl. buyables for every action, are coming): do not "fix" balance oddities.

*Group: Decided 2026-10-28 (by the user, balance and design knowledge)*
- **Balance:** the earlier "balance is not a factor yet, do not fix balance oddities" was meant loosely: the user accepts having to correct numbers later. It no longer applies literally because players are on the live game. Going forward, new content aims for sensible pacing (checked against existing prices, income and reveal thresholds), existing tuning is not rebalanced unasked, and an agent that sees a pacing problem reports it with numbers instead of silently fixing or ignoring it.
