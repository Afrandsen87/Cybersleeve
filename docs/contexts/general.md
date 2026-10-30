# Context: general

Cross-cutting decisions that fit no single context.

Code: `src/core/general/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-24 (by the user, after the first full review)*
- **Offline progress is out of scope for now.** **Balance is not a factor yet** (more mechanics, incl. buyables for every action, are coming): do not "fix" balance oddities.

*Group: Decided 2026-10-28 (by the user, balance and design knowledge)*
- **Balance:** the earlier "balance is not a factor yet, do not fix balance oddities" was meant loosely: the user accepts having to correct numbers later. It no longer applies literally because players are on the live game. Going forward, new content aims for sensible pacing (checked against existing prices, income and reveal thresholds), existing tuning is not rebalanced unasked, and an agent that sees a pacing problem reports it with numbers instead of silently fixing or ignoring it.

*Group: Decided 2026-10-30 (by the user, design interview)*
- **The long-term design target lives in `docs/VISION.md`** (index) and `docs/vision/*.md` (topic files, loaded only as needed). `DESIGN.md` remains the description of what is built; the vision is not to be implemented without a task that says so.
- Anti-goals: no real-money payments, no random chance as a progression blocker, no hidden information about met mechanics, no permanent soft-lock from suboptimal choices (a free sleeve-skill respec that restarts the run without benefit and is not a re-sleeve is wanted), no random events.
- **Offline progress** stays without a full simulation; the target is a banked boost-time credit (time away earns minutes of faster game speed, reusing the debug Speed x10 mechanism). See `docs/vision/numbers.md`.
