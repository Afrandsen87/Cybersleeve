<!-- Generated from CLAUDE.md by scripts/sync-agents.mjs. Edit CLAUDE.md, then run `npm run agents:sync`. -->

# CyberSleeve – Instructions for Claude

Standing rules for building **Cybersleeve**, an idle/incremental cyberpunk game built step by step over many sessions. Add new standing rules here, phrased as what to do. Mechanic details belong in code comments next to the code; history belongs in `docs/DECISIONS.md` (read the entry before changing that mechanic). `DESIGN.md` describes the game as it is now and is the source of truth for gameplay.

## Orientation

- Inspired by **Derivative Clicker** (reference only, never modify): `C:\Code\DerivativeClicker-gh-pages`; its analysis is in `ARCHITECTURE_DerivativeClicker.md`. Read that analysis before designing economy, prestige, save/load or the tick loop. Cybersleeve reuses the understanding, not the code.
- Layout, commands and folders: `docs/ARCHITECTURE.md`. Tuning variables: `docs/CONFIG.md`.
- Platform: desktop-browser PWA; TypeScript strict + Vite + Vitest + Biome; vanilla TS views. Python on this Windows machine needs `PYTHONUTF8=1`.
- Offline progress is out of scope and balance is not a factor yet: note balance oddities in your report and leave them as they are.

## Definition of done

A change is done when all of these are true:

1. `npm run check` passes (typecheck, Biome, tests, build). If it fails or was not run, say so with the output.
2. New logic has unit tests in the same change, split by feature, with shared setup in one documented kit file. Logic is pure or runs against injected interfaces (clock, storage, `RandomSource`, renderer), so tests need no browser, DOM or real timers. Tests use `src/testing/testConfig.ts`; tests for real content check invariants, never tuning numbers.
3. Every module, class, function and public type has a TSDoc comment (purpose, inputs, outputs, side effects). Callers and callees go in the description as `Called by:` / `Calls:` lines. `docs/ARCHITECTURE.md`, `docs/CONFIG.md` and `DESIGN.md` are updated in the same change. `npm run docs` runs only when the user asks; `docs/architecture.html` is git-ignored and is never edited or staged otherwise.
4. Files stay small and single-purpose (see Context size); no file imports another context's internals; the context's doc slice and test kit are updated.
5. UI changes were looked at in the running preview (see Looking at UI).

## Engineering principles

- **SOLID:** one responsibility per module, depend on abstractions, inject dependencies, extend by adding. Take the narrow area interface you need (`ItemQueries`, `SleeveQueries`, `ShopQueries`, ... in `core/api.ts`), not the whole engine. The engine mutates no state itself; the `GameEngine` delegating facade stays unless it hurts.
- **Build incrementally:** each step small, tested, documented and runnable. For a significant design or technology choice not covered here, ask the user first, then record it in `docs/DECISIONS.md`.
- **Bounded contexts:** code lives in `src/core/<context>/` (map: `docs/contexts/README.md`). A context imports only lower layers (or an edge in the same-layer table of `core/boundaries.test.ts`) and takes narrow `*Queries` interfaces; a new exception needs a reason in that test and the user's say-so.
- **One mechanic, one code path:** a rule (heat tax, crit cover, reward payout, drop share, curves) has exactly one owner function or service in its context. Before writing logic, grep for the rule; reuse or extend the owner. Two paths for one rule is a defect, not a style choice. UI formats values from the owner and never re-derives them.
- **Name the context:** every new mechanic states its context in the PR/report and in its TSDoc, and registers its effect-kind entry from that context.
- **Data over code:** use named identifiers and typed structures for grids and indexes; drive UI from data; define each piece of starting state once and derive variants; keep serialisable data apart from behaviour; declare every dependency and guard third-party calls; delete dead code.
- **Numbers:** big numbers sit behind our own Decimal interface (break_infinity adapter); game code never imports the library. Infinity is 1e308 (`core/infinity.ts`). Outcomes that must hold at any scale: values display and progress sensibly, the loop never stalls on huge counts (closed-form instead of iteration), and overflow triggers the intended prestige instead of corrupting state. Tests state the expected outcome explicitly and cover zero, negatives clamped, huge values, overflow and NaN/Infinity.
- **Tuning lives in content:** every progression number (durations, rewards, XP, thresholds, prices, caps, intervals) lives in `src/content` (`gameConfig.ts`, `actions.ts`, `items.ts`, `buyables/<action>.ts`, `ids.ts`), validated in `core/config.ts` and described in `docs/CONFIG.md`.
- **Runs are batched:** apply runs in closed form, never per-run iteration, and extend `batching.test.ts` so one long tick and many short ones give the same results. Randomness comes only through an injected `RandomSource`, drawn per batch.
- **New mechanics** extend `testing/invariants.ts` when they add state and are covered by the seeded random play in `core/properties.test.ts`.

## Context size

Sessions read code into a limited context, so size is a design constraint.

- Source files: aim for about 10 KB, tests about 12 KB; split by responsibility before 15 KB (`engine.ts` is the one allowed outlier). Check the size of any file you add or grow, and split it in the same change.
- Keep import paths stable when splitting: leave a thin facade or barrel (`viewModel.ts`, `types.ts`, `uiText.ts`, `gameConfig.ts`) and move bodies into a folder.
- One content file per action (`content/buyables/<action>.ts`). Content is data; a new action or buyable adds a file or entry.
- `docs/Review 1/` is the archived output of the first architecture review: git-ignored and denied in `.claude/settings.json`. Never read, cite or link it; its conclusions are in the code, `core/boundaries.test.ts` and `docs/contexts/`.
- Large generated or data files (`docs/architecture.html`, `src/content/icons.ts`, `package-lock.json`, the reference HTML) are denied in `.claude/settings.json`; add new ones there and keep icon/pixel data out of files that logic imports.

## How to work

- **Diagnose before fixing.** For a bug report, a "something feels off" request, or a review, first list the problems found (what, where, why) and wait for the user to pick which to fix. Do not change code until they have chosen. Straightforward feature work does not need this step.
- **Delegate to cheap models.** Reading, searching, summarising docs and surveying code are done by subagents on `model: "haiku"` (or the `Explore` agent); they return short findings and the orchestrator decides. Implementation subagents use `sonnet`. Only the orchestrator runs on the strongest model. A subagent without a `model` inherits the expensive one, so always set it.
- **Parallel work:** every session runs in its own git worktree and branch (`.claude/worktrees/<slug>`), never on `main`. Start with `/agent-task`; it fans work out, merges, runs `npm run check`, serves a preview, and merges into local `main` only after the user approves. Never push (the user pushes, which deploys) and never merge, rebase or delete branches you did not create. Do not commit or push in the main checkout unless asked.
- **Load a context's slice only:** read `docs/contexts/<context>.md` and that context's files and tests, not whole `DESIGN.md`, `ARCHITECTURE.md`, `CONFIG.md` or `DECISIONS.md`. Cross-context work lists the contexts it touches first.
- **Impact check for new or changed mechanics** (report it with the change): no dead option (never worth taking), no option that dominates at every stage, no option with fixed outcome whatever the player does. Reason from the content data and formulas; leave tuning alone. Same-effect, same-growth options are a fake choice.
- **Layer-readiness check:** say what the change assumes about the number of sleeves, corporations and prestige layers. No new global singleton, no hard-coded currency name, no state that is per-sleeve but stored as wallet (or the reverse). Copies scale in closed form from records, never by simulating N copies.
- **Looking at UI.** After a UI change, launch the preview (the `run` skill), screenshot the changed screen, and check it before reporting done. Say what you saw. If you cannot run it, say so.
- **Backup agent file.** After any change to this file, ask the user whether to regenerate `AGENTS.md` (`npm run agents:sync`). Never regenerate it unprompted.
- Write outputs into `C:\Code\CyberSleeve`. The user can run `/retro` to review a session for lessons; it never runs on its own.

## Game rules that apply to all work

- **Every lever names what it scales** (`REWARDS`, `EFFECT_TRAITS`); there is no global reward or output multiplier. Code asks descriptors, never compares kind names.
- **New buyable effect kind** = one union member + ONE entry in `core/effectRegistry.ts`; switches over kinds end in `assertNever`.
- **Actions are gated only by access level;** there are no unlock rules.
- **Nothing is shown before it matters:** a stat, bar, button, purchase, skill or tree stays hidden until something makes or changes it. Before adding or changing any stat, skill, tree, buyable, tooltip or text, follow `docs/REVEAL_RULES.md` (reveal checklist, skill-tree masking, tests). A skill needs a unique icon.
- **Save and re-sleeve:** re-sleeve is a positive list (`CARRIED_OVER_ACTION_FIELDS`, `CARRIED_OVER_BUYABLE_CURRENCIES`); everything else resets. Only the current save version is read; changing a saved field's meaning needs a version bump and migration.
- **Interface text** lives in `src/ui/uiText.ts`; stat widgets are data-driven rows. Test aids (Reset save, Speed x10) appear only in dev builds or with `?debug`.
- **Rendering:** `RenderLoop` on rAF; bars use `transform: scaleX()`; tips are getters built only when shown; no per-frame work that scales with the number of buyables.
- **Corporation, augments, hosting details:** see the header comments of `core/corporation.ts`, the augment code, and `docs/DECISIONS.md`.
- **Hosting:** GitHub Pages via `.github/workflows/deploy.yml`; keep `base: './'` in `vite.config.ts`. One tab plays (Web Lock).

## Commit messages

Commit subjects feed the changelog (`scripts/collate-changelog.mjs`; a hand-written entry in `content/changelog.ts` added in the same push wins instead). Write each subject as ONE short, player-facing line ("Add Unlock resleeving button", "Raise Push malware prices"). Commits that change nothing a player sees start with `chore:`, `docs:`, `test:`, `refactor:`, `ci:` or `build:`. Details go in the body.

## Game in one paragraph

An incremental game where the player is a character who performs actions to skill up, earns credits (placeholder name; never hard-code display names in logic) and buys things. Prestige is re-sleeving into a new body. Later layers add multiple sleeves living copies of your latest life, then organisations that sleeve ever more copies; that copy scaling is the "derivative" factor. Details and current mechanics: `DESIGN.md`.
