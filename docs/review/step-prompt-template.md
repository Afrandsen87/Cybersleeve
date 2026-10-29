# Step prompt template (one refactor step)

Copy, fill the `<...>` fields from `migration-plan.md` Step N, and run in a fresh session. Start with `/agent-task`.

---

# Task: Migration step <N> – <context name>

## Load only this
- `CLAUDE.md`.
- `docs/review/target-architecture.md` (the table row for `<context>` and the dependency rules; skip the rest).
- `docs/contexts/<context>.md` if it exists; otherwise the slices named in the plan: DESIGN.md <sections>, CONFIG.md <sections>, DECISIONS.md entries about <topics> (use Grep for headings, read slices only).
- `docs/review/findings-code.md` rows <P-numbers> and, if a design change rides along, `docs/review/findings-design.md` <D-numbers> (only the approved ones).
- Source files: <list from the plan>. Tests: <list>. Do not read other contexts' internals; use their `index.ts`.

## Goal
Move `<context>` to `src/core/<context>/` with a public `index.ts`, fix <P-numbers> with the single owner named in the plan, and split its docs into `docs/contexts/<context>.md`. Behaviour must not change unless the approved design change below says so.

## Approved design change (delete if none)
<D-number and exact text: the DESIGN.md lines to change, the save fields touched, whether a version bump and migration is needed>. If it needs a save bump or migration, stop and ask before doing it.

## Method
1. Record a baseline: `npm run check`, and note passing test counts for the files in scope.
2. Pin behaviour: add or confirm tests that state the current outputs for the rules being unified (zero, negatives clamped, huge values, overflow, NaN/Infinity). Make them pass on the old code first.
3. Move files with `git mv`, update imports, keep the old paths working through the `core/index.ts` barrel.
4. Introduce the shared owner (service/function), switch every parallel path to it, delete the duplicate code and its duplicate tests.
5. Move tests next to the code, switch them to the shared kit in `src/testing/`, merge overlapping files without losing coverage.
6. Shrink the `core/boundaries.test.ts` allow-list for this context; it may only shrink.
7. Split the docs: write `docs/contexts/<context>.md` (responsibility, interface, state, config variables, DESIGN excerpt, DECISIONS history), leave a one-line pointer where the text was, update `docs/ARCHITECTURE.md` and `docs/CONFIG.md` indexes.
8. Delegate reading/surveying to subagents on `model: "haiku"` (or Explore) with narrow file lists; log them in `docs/AGENT_METRICS.md`. Implementation subagents use `sonnet`. Do not fan out unless there are 3+ independent packages with disjoint files.

## Out of scope
Other contexts' files, tuning numbers, `package.json`, the save version (unless an approved change says otherwise), `docs/architecture.html`, `AGENTS.md`.

## Definition of done (CLAUDE.md)
1. `npm run check` passes (typecheck, Biome, tests, build); if it fails or was not run, say so with the output.
2. New logic has unit tests in the same change, split by feature, shared setup in one documented kit file; logic is pure or uses injected interfaces; tests use `src/testing/testConfig.ts`; content tests check invariants, not tuning numbers.
3. Every module, class, function and public type has a TSDoc comment (purpose, inputs, outputs, side effects) with `Called by:` / `Calls:` lines. `docs/ARCHITECTURE.md`, `docs/CONFIG.md` and `DESIGN.md` are updated in the same change. `npm run docs` only if the user asks.
4. Files stay small and single-purpose: source about 10 KB, tests about 12 KB, split before 15 KB.
5. UI changes were looked at in the running preview, with a screenshot and a description of what was seen.
Also: the context folder has an `index.ts`, no file imports another context's non-index file, and a new mechanic or kind added in this step has one registry entry and one code path.

## Report
What moved, which duplicate paths were removed (with file:line), tests moved/merged/removed with counts before and after, `npm run check` output, doc files created, anything deferred, balance oddities noticed (do not change them). Do not commit unless asked; do not push; do not merge into `main` without approval.
