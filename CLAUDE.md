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

## Context size is a design constraint

Sessions read code into a limited context, so file and doc size is part of the design. Apply to all new work:
- **Keep files small and single-purpose.** Soft limit about 10 KB per source file and about 12 KB per test file; split by responsibility before a file passes about 15 KB (nothing is above 27 KB today, and `engine.ts` is the one allowed outlier). Stay within one reason to change per file.
- **Keep import paths stable when splitting.** Leave a thin facade or barrel (`viewModel.ts`, `types.ts`, `uiText.ts`, `gameConfig.ts`) and move the bodies into a folder (`ui/view/`, `ui/widgets/`, `content/buyables/`). Callers and tests should not need editing.
- **Narrow interfaces by area.** A unit takes only the area interface it uses (`ItemQueries`, `SleeveQueries`, `ShopQueries`, ... in `core/api.ts`), not the whole engine, so reading it never pulls in the facade.
- **One content file per action** (`content/buyables/<action>.ts`). Content is data; a new action or buyable adds a file or an entry, it does not grow a shared one.
- **Split tests by feature**, with shared setup in one documented kit file (`modesKit.ts`, `skillsKit.ts`). Do not append a feature's tests to a big existing test file.
- **Mechanic details live in code comments next to the code** (the effect type, the content entry), where they are read when needed. `CLAUDE.md` holds only standing rules; `docs/DECISIONS.md` is the on-demand history and is not loaded by default. Do not paste long decision entries here.
- **Keep generated and bulky files out of reads.** `docs/architecture.html`, `src/content/icons.ts`, `package-lock.json` and the reference HTML are denied in `.claude/settings.json`; put any new large generated or data file there, and keep icon/pixel data out of files that logic imports.
- **Check before finishing:** after adding or growing a file, look at its size. If it crossed the limits above, split it in the same change.

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
- Do not commit or push unless asked. (This folder is a git repository.) Exception: in a session worktree, small commits on its own branch are expected (see below).
- **Every session works in its own git worktree and branch** (`.claude/worktrees/<slug>`), never directly on `main`, so parallel sessions do not collide. Use the `/agent-task` skill (`.claude/skills/agent-task/SKILL.md`) to start one. Never merge, rebase or push branches you did not create; the user merges.

## Standing rules (distilled from the decisions log)

Full history, prices and mechanic details: **`docs/DECISIONS.md`** (read the entry for a mechanic before changing it). `DESIGN.md` describes the game as it is now.

Platform and tooling: desktop-browser PWA; TypeScript strict + Vite + Vitest + Biome; vanilla TS views; big numbers behind our own Decimal interface (break_infinity adapter), game code never imports the library. Infinity is 1e308 (`core/infinity.ts`). Offline progress is out of scope and balance is not a factor yet: do not "fix" balance oddities. Python on this Windows machine needs `PYTHONUTF8=1`.

Design rules:
- No global reward or output multiplier: every lever/multiplier names exactly what it scales (`REWARDS`, `EFFECT_TRAITS`); code asks descriptors, never compares kind names.
- New buyable effect kind = union member + ONE entry in `core/effectRegistry.ts`; switches over kinds end in `assertNever`.
- Actions are gated only by access level; no unlock rules.
- Nothing is shown before it matters: any stat, bar, button, skill or purchase stays hidden until something makes or changes it (`ui/view/statReveal.ts`, `ui/view/sleeveGate.ts`). Purchases are listed by base price via `sortByBasePrice` (`ui/view/buyableViews.ts`).
- Re-sleeve is a positive list (`CARRIED_OVER_ACTION_FIELDS`, `CARRIED_OVER_BUYABLE_CURRENCIES`); everything else resets. Only the current save version is read; changing a saved field's meaning needs a version bump and migration.
- Randomness only through an injected `RandomSource`, drawn per batch of runs (closed form), never per run.
- All interface wording in `src/ui/uiText.ts`; stat widgets are data-driven rows. Test aids (Reset save, Speed x10) only in dev builds or with `?debug`.
- Rendering: `RenderLoop` on rAF; bars use `transform: scaleX()`; tips are getters built only when shown; no per-frame work that scales with the number of buyables.
- The engine mutates no state itself; the `GameEngine` delegating facade stays unless it hurts.
- Hosting: GitHub Pages via `.github/workflows/deploy.yml`; `base: './'` in `vite.config.ts` must stay. One tab plays (Web Lock).
- Corporation (`core/corporation*.ts`, `GameConfig.corporation`): its actions are NOT character actions (no interface speed, levels, Overclock, Focus, heat; a run takes exactly `baseDurationMs`); a completed run applies effects through the registry in `corporationEffects.ts`. It survives re-sleeving. The Corporation tab is opened by the Incorporation re-sleeve skill; its widgets are empty until the user designs them.
- Augments are applied by selecting a rarity in the Inventory, then pressing the action's Augment button (`augmentAction(id, rarityId)`).

## Working conventions (in use)

- Doc-comment format: **TSDoc**, extracted by `scripts/generate-docs.mjs` into the HTML overview `docs/architecture.html` (in the style of `ARCHITECTURE_DerivativeClicker.html`).
- Folder layout, build/run/test commands: see `docs/ARCHITECTURE.md` (project scaffolded 2026-10-24; code in `src/{numbers,core,content,app,ui}`, tests next to code as `*.test.ts`).
- **No hard-coded tuning:** every number that affects progression (durations, rewards, XP, level thresholds, level worth, prices, caps, intervals) must live in `src/content` (`gameConfig.ts` for the tuning, `actions.ts`, `items.ts`, `buyables/<action>.ts` for the content, `ids.ts` for ids; together `GameConfig`) and be validated in `core/config.ts`. Describe new variables in `docs/CONFIG.md`. Unit tests use `src/testing/testConfig.ts`, never the real tuning.
- Keep `docs/ARCHITECTURE.md`, `docs/CONFIG.md` and `DESIGN.md` updated in the same change as code.
- Regenerate the HTML overview with `npm run docs` (output: `docs/architecture.html`) **only when the user explicitly asks**. The file is git-ignored; never generate, edit or stage it otherwise, and `npm run check` does not check it. Still keep the TSDoc and `scripts/architecture.template.html` curated sections correct in the same change as code. Doc format is TSDoc with `Called by:` / `Calls:` lines in the description.
- Before reporting work done: run `npm run check` (typecheck, Biome, tests, build).
- Runs are applied in closed-form batches (no per-run iteration); keep it that way when adding mechanics, and extend `batching.test.ts` so one long tick and many short ones give the same run results.
- Tests for the real content (`content/gameConfig.test.ts`) check invariants, never tuning numbers.
- New mechanics extend `testing/invariants.ts` when they add state, and are covered by the random play in `core/properties.test.ts` (seeded, so failures reproduce).

## Game design (high level; details to be mapped out over time)

Detailed mechanics live in `DESIGN.md` (source of truth; read it before implementing gameplay, and update it when the user changes a mechanic). Names such as "credits" are placeholders: never hard-code display names in logic.

- **Genre:** idle/incremental in the vein of Derivative Clicker, cyberpunk theme.
- **The player is a character** who performs actions to skill up. There is **no life clock** (see `DESIGN.md`); the player chooses when to re-sleeve.
- **Prestige = re-sleeving:** you move your consciousness into a new body ("sleeve"); the requirement is still open.
- **Later layers:** multiple sleeves at once, each living a full life as a copy of your most recent lifetime. Further prestige layers produce companies/organisations that sleeve ever more copies: cities, interstellar outposts, planets. This copy scaling is the "derivative" scaling factor of the reference game.
- **Main resource:** **credits**, used to buy things.
- **First milestone:** implemented (three actions, buyables, passive network income, heat, re-sleeving); see `DESIGN.md`. Further mechanics are mapped out with the user before building.
