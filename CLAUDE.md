# CyberSleeve – Global Instructions for Claude

This file is read at the start of every session. It holds standing rules for building **Cybersleeve**, a game built step by step over many sessions. Keep it current: when the user gives a new standing rule, add it here.

## Project background

- Cybersleeve is a new game, inspired by an existing incremental/clicker game, **Derivative Clicker** (reference only, never modify it): `C:\Code\DerivativeClicker-gh-pages`.
- A full analysis of that project is in this folder: `ARCHITECTURE_DerivativeClicker.html` (visual) and `ARCHITECTURE_DerivativeClicker.md` (text). Read it before designing anything that touches economy, prestige, save/load or the tick loop.
- Cybersleeve is **not a port**. Reuse the understanding of how the reference works, not its code structure.

## Mandatory engineering rules

Everything built must satisfy **all** of these:

1. **SOLID.** Single responsibility per module/class, depend on abstractions, inject dependencies (clock, storage, RNG, renderer), extend by adding rather than editing. No god objects, no global mutable state.
2. **Testable, with unit tests.** Every unit of logic ships with unit tests in the same change. Game logic must be pure or run against injected interfaces so it can be tested without a browser/DOM/real timers. Tests must run with a single documented command and pass before work is reported as done. Report honestly if tests fail or were not run.
3. **Documented for the HTML overview.** All documentation must be written so it can be rendered in an HTML architecture document like `ARCHITECTURE_DerivativeClicker.html`. That means:
   - Every module, class, function and public type has a doc comment: purpose, inputs, outputs, side effects, which other units it calls/is called by.
   - Use a consistent, machine-extractable doc format (decide once with the user when the language is chosen, record it below) so a generator can build the function reference and call graph.
   - Keep a maintained architecture description (modules, data flow, domain model, state lifetimes, tick/loop flow, risks) that maps onto the HTML sections: Summary, Files, Architecture, Domain model, State lifetimes, Tick loop, Call graph, Function reference, Risks.
   - Update the docs in the same change as the code. Undocumented code is unfinished code.

## Lessons carried over from the reference project

Avoid these (found in the analysis; details in the architecture document):
- Magic index arithmetic (`5*i+3`, column-major vs row-major grids). Use named identifiers / typed structures instead of positional arrays.
- Hand-written per-field render code; drive UI from data.
- Duplicated data definitions (starting state repeated three times). Define once, derive variants.
- Behaviour compiled from strings (`new Function`) and state that loses its methods when saved. Separate pure data (serialisable) from behaviour.
- Implicit globals, unguarded third-party calls (analytics), duplicate library loading, missing vendored dependencies.
- Dead code.

## Big-number and "infinity" mathematics

The reference game plays at astronomical scales (up to 1e303 and beyond, with an overflow-to-Infinity prestige). Some of its odd code exists only to work around JavaScript doubles. **What matters is the outcome, not copying the code.**
- Preserve the gameplay outcomes: numbers display and progress sensibly at any scale, the loop never stalls on huge counts (closed-form instead of iteration when counts explode), and overflow triggers the intended prestige instead of corrupting state.
- Do not copy the workarounds (the 7th-root approximation with the `1e106` fudge factor, 2-decimal rounding, etc.). Choose a number representation deliberately (e.g. arbitrary-precision/mantissa-exponent type behind an interface) and test it, including edge cases: zero, negatives clamped, huge values, overflow, NaN/Infinity handling.
- Behavioural tests for these formulas must state the expected outcome explicitly, so the maths can be changed later without regressions.

## Working agreements

- Build incrementally; each step small, tested, documented, and runnable.
- Before making a significant design or technology choice not covered here, ask the user and then record the decision in the section below.
- Write outputs into this project folder (`C:\Code\CyberSleeve`).
- Do not commit or push unless asked. (This folder is a git repository; nothing has been committed yet.)

## Decisions log

Decided 2026-10-24 (by the user):
- **Platform:** web app delivered as an installable **PWA** (service worker, manifest, offline-capable). **Updated 2026-10-24: the target is desktop browsers for now; mobile is dropped.** The interface will be redesigned for mobile if it is ever needed; the PWA build stays but mobile layout and install flow are not goals. No native wrapper yet.
- **Language/tooling:** **TypeScript** (strict) + **Vite** + **Vitest**. Node v24 / npm 11 are installed.
- **UI:** **vanilla TypeScript** with a small own view layer. Core game logic is framework-free and has no DOM access; views are thin and data-driven.
- **Big numbers:** our own `Decimal`-style **interface**, backed by a proven library (e.g. break_infinity.js / break_eternity.js) behind an adapter so it can be swapped. Game code never imports the library directly.

Decided 2026-10-24 (by the user, after the first full review):
- **Offline progress is out of scope for now.** **Balance is not a factor yet** (more mechanics, incl. buyables for every action, are coming): do not "fix" balance oddities.
- **Tooling:** lint and format with **Biome** (`npm run lint`, `npm run format`); typescript-eslint was not usable because it does not support TypeScript 7 yet. `npm run check` runs typecheck, Biome, tests and build in one go; `npm run test:coverage` gives coverage.
- A temporary **Reset save** button wipes the game and the save (remove before release).
- The folder is now a git repository (initialised 2026-10-24, nothing committed yet).

Proposed, to confirm with the user when scaffolding:
- Doc-comment format: **TSDoc** (in use), extracted by `scripts/generate-docs.mjs` into the HTML overview `docs/architecture.html` (in the style of `ARCHITECTURE_DerivativeClicker.html`).
- Folder layout, build/run/test commands: see `docs/ARCHITECTURE.md` (project scaffolded 2026-10-24; code in `src/{numbers,core,content,app,ui}`, tests next to code as `*.test.ts`).
- **No hard-coded tuning:** every number that affects progression (durations, rewards, XP, level thresholds, level worth, prices, caps, intervals) must live in `src/content/gameConfig.ts` (`GameConfig`) and be validated in `core/config.ts`. Describe new variables in `docs/CONFIG.md`. Unit tests use `src/testing/testConfig.ts`, never the real tuning.
- Keep `docs/ARCHITECTURE.md`, `docs/CONFIG.md` and `DESIGN.md` updated in the same change as code.
- Regenerate the HTML overview with `npm run docs` (output: `docs/architecture.html`) after code changes, and update the curated sections in `scripts/architecture.template.html` when the design changes. Doc format is TSDoc with `Called by:` / `Calls:` lines in the description.
- Before reporting work done: run `npm run check` (typecheck, Biome, tests, build).
- Runs are applied in closed-form batches (no per-run iteration); keep it that way when adding mechanics, and extend `batching.test.ts` so one long tick and many short ones give the same run results.
- Tests for the real content (`content/gameConfig.test.ts`) check invariants, never tuning numbers.

## Game design (high level; details to be mapped out over time)

Detailed mechanics live in `DESIGN.md` (source of truth; read it before implementing gameplay, and update it when the user changes a mechanic). Names such as "credits" are placeholders: never hard-code display names in logic.

- **Genre:** idle/incremental in the vein of Derivative Clicker, cyberpunk theme.
- **The player is a character** who performs actions to skill up. There is **no life clock** (see `DESIGN.md`); the player chooses when to re-sleeve.
- **Prestige = re-sleeving:** you move your consciousness into a new body ("sleeve"); the requirement is still open.
- **Later layers:** multiple sleeves at once, each living a full life as a copy of your most recent lifetime. Further prestige layers produce companies/organisations that sleeve ever more copies: cities, interstellar outposts, planets. This copy scaling is the "derivative" scaling factor of the reference game.
- **Main resource:** **credits**, used to buy things.
- **First milestone:** implemented (three actions, buyables, passive network income, heat, re-sleeving); see `DESIGN.md`. Further mechanics are mapped out with the user before building.

## Open questions for the user

- The real re-sleeve requirement, and whether purchases should survive re-sleeving (see `DESIGN.md` section 4).
- Buyables for the other actions; further automation.
- Story beats and tone.
- The "infinity" prestige that should react to numbers overflowing (the default `OverflowPolicy` only clamps).
