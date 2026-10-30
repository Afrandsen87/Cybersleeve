# Context: app

Composition, loop, hosting, deploy, tooling and process.

Code: `src/core/app/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-24 (by the user)*
- **Platform:** web app delivered as an installable **PWA** (service worker, manifest, offline-capable). **Updated 2026-10-24: the target is desktop browsers for now; mobile is dropped.** The interface will be redesigned for mobile if it is ever needed; the PWA build stays but mobile layout and install flow are not goals. No native wrapper yet.

*Group: Decided 2026-10-24 (by the user)*
- **Language/tooling:** **TypeScript** (strict) + **Vite** + **Vitest**. Node v24 / npm 11 are installed.

*Group: Decided 2026-10-24 (by the user, after the first full review)*
- **Tooling:** lint and format with **Biome** (`npm run lint`, `npm run format`); typescript-eslint was not usable because it does not support TypeScript 7 yet. `npm run check` runs typecheck, Biome, tests and build in one go; `npm run test:coverage` gives coverage.

*Group: Decided 2026-10-24 (by the user, after the first full review)*
- A temporary **Reset save** button wipes the game and the save (remove before release).

*Group: Decided 2026-10-24 (by the user, after the first full review)*
- The folder is now a git repository (initialised 2026-10-24, nothing committed yet).

*Group: Decided 2026-10-25 (by the user, after the second review)*
- `docs/architecture.html` is generated, git-ignored and never regenerated unless the user asks (`npm run docs`); `npm run check` no longer runs `docs:check`. Reason: parallel worktree branches kept conflicting on it.

*Group: Working conventions (in use)*
- Doc-comment format: **TSDoc**, extracted by `scripts/generate-docs.mjs` into the HTML overview `docs/architecture.html` (in the style of `ARCHITECTURE_DerivativeClicker.html`).

*Group: Working conventions (in use)*
- Folder layout, build/run/test commands: see `docs/ARCHITECTURE.md` (project scaffolded 2026-10-24; code in `src/{numbers,core,content,app,ui}`, tests next to code as `*.test.ts`).

*Group: Working conventions (in use)*
- Keep `docs/ARCHITECTURE.md`, `docs/CONFIG.md` and `DESIGN.md` updated in the same change as code.

*Group: Working conventions (in use)*
- Regenerate the HTML overview with `npm run docs` (output: `docs/architecture.html`) after code changes, and update the curated sections in `scripts/architecture.template.html` when the design changes. Doc format is TSDoc with `Called by:` / `Calls:` lines in the description.

*Group: Working conventions (in use)*
- Before reporting work done: run `npm run check` (typecheck, Biome, tests, build).

*Group: Working conventions (in use)*
- New mechanics extend `testing/invariants.ts` when they add state, and are covered by the random play in `core/engine/properties.test.ts` (seeded, so failures reproduce).

*Group: Decided 2026-10-26 (by the user, after the full review)*
- `DESIGN.md` describes the game as it is now (no changelog inside); history lives in git. A docs/CI workflow (`.github/workflows/check.yml`) runs `npm run check`.

*Group: Decided 2026-10-26 (by the user, after the full review)*
- **Hosting (2026-10-26):** the game is deployed to GitHub Pages (`https://afrandsen87.github.io/Cybersleeve/`) by `.github/workflows/deploy.yml` on every push to `main`: it runs `npm run check` and publishes `dist`. Pages source is set to "GitHub Actions" in the repository settings. The relative `base: './'` in `vite.config.ts` must stay so the build works under the sub-path.

*Group: Decided 2026-10-26 (by the user, after the full review)*
- Python on this Windows machine reads files as cp1252 unless `PYTHONUTF8=1`: use UTF-8 explicitly when scripting edits.

*Group: Decided 2026-10-28 (by the user, balance and design knowledge)*
- **Genre knowledge lives in a skill** (`.claude/skills/incremental-design/`), loaded on demand for design work, so agents stop proposing generic game-design ideas. Reference games: Space Idle, Cookie Clicker (without the clicking), CIFI, ISEPS, Derivative Clicker, Revolution Idle (Steam), Underworld Idle.
