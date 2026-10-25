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

Decided 2026-10-25 (by the user, after the second review):
- **No global reward multiplier.** A lever applies to one named kind of reward and nothing else. Today the only one is `global.creditMultiplier` (credits earned: run rewards paid in credits and passive network income). It never touches nodes, ICE Rating, Infamy, or the interface-speed and node-payout bonuses. A lever for another kind is its own named setting, and which kinds a lever scales is stated in `REWARDS` (`core/rewards.ts`).
- Every reward kind and every buyable effect kind is described once as data (`REWARDS`, `EFFECT_TRAITS`); code asks the descriptor instead of comparing kind names. Resolver `switch`es over effect kinds end in `assertNever` so a new kind cannot be forgotten.
- All interface wording lives in `src/ui/uiText.ts`; `viewModel.ts` and `dom.ts` hold none. Stat widgets are data-driven rows (`StatRowView`), not hand-written per field.
- The test aids (Reset save, Speed x10) are shown only in development builds or with `?debug` in the address.
- Only the current save version is read (nothing has been released). Changing the meaning of a saved field needs a version bump and a migration; adding a scalar does not.
- `npm run check` also runs `npm run docs:check`, which fails when `docs/architecture.html` is stale: run `npm run docs` after code or doc-comment changes.

Decided 2026-10-25 (by the user, after testing):
- **No general output multiplier.** The old `outputMultiplier` also scaled XP and counted runs, and made Practice Hacking's speed grow exponentially; it was removed. A `rewardMultiplier` buyable scales **only the reward its own action pays per run** (e.g. the nodes Grow Network pays). Every future multiplier states exactly what it multiplies; code never applies one multiplier to everything an action does.
- Interface speed earned by Practice Hacking goes through a concave curve with no ceiling (`sleeve.earnedSpeedScale` / `earnedSpeedExponent`, `core/concaveBonus.ts`). Duplicate processors on Practice Hacking was removed.
- **Hacking Proficiency flattens past 1 (2026-10-26):** the curve is unchanged below 1 Hacking Proficiency, and past it continues with a flatter exponent (`sleeve.earnedSpeedKnee: 1`, `earnedSpeedExponentBeyond: 0.1`), joined smoothly (same value and slope at the knee). "Scale the harder" was read, after asking, as flatter.

Decided 2026-10-25 (by the user, access ladder):
- Actions are gated **only by access level** in the real content: Grow network 1, Practice Hacking 2, Push malware 3, Kill servers 4, Build Legend 5. Access upgrade (5 credits, x1000 per copy, unlimited) adds +1 level per copy (`accessLevel` effect is now `{ amount }` and stacks). The Unlock Legend buyable and Kill servers' node-count unlock were removed. The `unlock` rules and the `unlock` effect still exist in the engine (tests use them) but the real content uses none.

Decided 2026-10-25 (by the user, items):
- **Items are an entity** (`GameConfig.items`: kinds and rarity tiers with sell values). Practice Hacking gets the *Kompromat harvest* buyable (second on its card, 500 credits): 5% of completed runs drop a Kompromat file, rarity weights 90/9/1/0/0 over common, uncommon, rare, legendary, crisis. Items sell from the *Inventory* widget (under Network) for 10 credits at common and x10 per rarity. Drop chance and rarity weights are meant to change later, so they are data on the `itemDrop` effect, never constants in code. Random draws go through an injected `RandomSource` and are made per batch of runs (`core/sampling.ts`), never per run. Selling is not taxed by heat or scaled by the credit lever.

- **Re-sleeve is a positive list:** only what `CARRIED_OVER_ACTION_FIELDS` (`core/state.ts`) names carries over (sleeve XP and its run counter); everything else resets. Paying out Kompromat is blackmail, not a sale, and the tooltip says so.

- **Tabs and skills (2026-10-25):** the game has two tabs, Character (everything so far) and Skills (a box of skill buttons; a whole skill tree comes later). Skill points: none at the start, the first when an action reaches level 1, then one per order of magnitude of the total of all ACTION levels (1 at a total of 1, 2 at 10, 3 at 100), 1 point per skill for now. Skills are buyables paid in the `skillPoints` currency (nothing is stored: points available = earned - cost of the skills owned). Back Channel Deals gives Moles (a Network counter) by giving up common Kompromat; Moles make heat cool faster. Skills reset when re-sleeving (assumption).

- **Augment schematics (2026-10-25):** *Industrial Espionage* (Grow network, 10,000 credits) lets Grow network drop the item *Augment schematic*. Every action card has an *Augment* button (top right) that applies one schematic: +1% to the action XP boost of ITS rarity, additively within a rarity, and the rarities multiply (3 common + 3 uncommon + 3 rare = 1.03 x 1.03 x 1.03); action levels only (not sleeve levels); the most common rarity held is used up first; schematics cannot be sold (`sellable: false`); reset by re-sleeving. The amount is data (`items.augment`).

Decided 2026-10-25 (by the user, after the performance review):
- **Rendering rules.** The screen is drawn by `RenderLoop` on `requestAnimationFrame` (rate-limited by `runtime.renderMs`); the game steps on its own timer. Bars move with `transform: scaleX()` plus a CSS transition of `--render-ms`, never by `width`. Hover texts are built only when shown: view-model tips are getters, `dom.ts` registers them in a `TipRegistry`, and nothing reads them every frame. `buildViewModel` runs inside `engine.snapshot(...)`. Measure before optimising: the game cost about 1% of a core when measured, so new UI work should keep it that way (no per-frame work that scales with the number of buyables beyond what the view model already does).

Decided 2026-10-25 (by the user, critical success):
- **Critical success** is a sleeve buyable (50 credits, x1000 per copy): +5% chance per copy that any completed run is critical. A critical run pays 3x its reward and gives 2x action XP, and nothing else changes. The chance is drawn once per batch of runs (`core/critical.ts`, injected `RandomSource`). The multipliers are data (`GameConfig.criticalSuccess`), and an action can replace single fields of the rule or add completion effects for its critical runs (`ActionDefinition.criticalSuccess`), so a critical success can later do something unique per action. No action does yet.

Decided 2026-10-26 (by the user, Overclock, Focus and Burn leads):
- **Overclock** (changed 2026-10-26: per action, see the square below). An action unlocks its own Overclock toggle for 250 credits, if it has an Overclock effect of its own (`ActionDefinition.overclock`, a mix of gains and costs; each action's effect is meant to be unique). **Grow network:** 50% faster, +2 heat per minute while it runs. **Practice Hacking:** pays 200% more (x3), each completed run costs 5 nodes. **Push malware:** each run also pays the nodes of a Grow network run, and makes 3x the heat. The sleeve **Overclock upgrade** (250,000 credits, x1000 per copy, unlimited) makes the GAINS (speed bonus, reward bonus) of every Overclock 10% of their base stronger per copy; costs and the extra payment stay fixed (my reading of "10% increase to the effect"; confirmed). Heat per minute is charged only for time the action actually ran.
- **Heat may be a fraction of a point, but it only cools in whole points**: the cooldown bar waits while there is less than 1 heat. Burn leads and Overclock produce the fractions.
- **Focus** (changed 2026-10-26): an action unlocks its own Focus toggle for 1,000 credits (every action can). A focused action runs 25% faster (`GameConfig.focus.speedBonus`). Focus slots limit how many actions are focused at once: 1 is free (`focus.baseSlots`), and the sleeve **Focus upgrade** (1,000,000 credits, x100,000 per copy, at most 4, so every action can get a slot) adds one per copy. The upgrades cost 1000x what the old sleeve buyables did.
- **The square (2026-10-26):** on every action card the run bar spans the full width, and under it a square (the same height as the reward line plus the two level bars) sits beside those. Before Auto-run is bought the whole square is the button that buys it; afterwards it is a 2x2 grid of Auto-run, Overclock, Focus and Augment. A cell whose unlock is not bought is a purchase button, a bought one is a toggle, and a feature the action does not have is an empty dashed cell. These buyables (effect kinds `autoRun`, `overclockUnlock`, `focusUnlock`) are not shown in the card's row of purchases (`BuyableView.inSquare`).
- **Burn leads:** a Grow network buyable (price is a placeholder, 1,000) lets runs drop the item *Burn lead* (5%; it has no rarity: one stack, shown as just "Burn lead", `ItemDefinition.hasRarity: false`). Using one (clicking its tile in the Inventory) takes 5% of the CURRENT heat and uses it up; leads are not sold (`sellable: false`). The share is data (`items.burnLead.heatFraction`).
- The "nodes are whole" test invariant allows for the number type's precision: `break_infinity` cannot hold every integer above about 1e8 exactly (existing limitation, not yet addressed).

Decided 2026-10-25 (by the user, icons):
- **Pixel-art icons**, 16x16, drawn as text grids in `content/icons.ts` and assigned to entities by id (`ENTITY_ICONS`); nothing in `core` knows about them. Style: limited neon palette on dark, drawn crisp (`image-rendering: pixelated`). Current set: network (Grow network), terminal (Practice Hacking), bug (Push malware), server rack (Kill servers), grinning skull (Build Legend), redacted file (Kompromat), chip (Augment schematic), flame (Burn lead), a chip with a stylised C (credits: in the universe credits are held on chips). Shown on action titles, inventory rows and the credits line; buyables, skills and Moles have none yet.

- **Inventory layout (2026-10-26):** a grid of tiles, one for every possible item and rarity (icon, count underneath, dimmed when 0). Items that cannot be sold are in a section on the left; sellable ones in their own section on the right, where a tile is selected by clicking and sold with the Sell and Sell all buttons beside the grid. Clicking a Burn lead tile uses one. The Back channel (Kompromat for Moles) is a third button beside Sell and Sell all, for the selected common Kompromat.

Working conventions (in use):
- Doc-comment format: **TSDoc**, extracted by `scripts/generate-docs.mjs` into the HTML overview `docs/architecture.html` (in the style of `ARCHITECTURE_DerivativeClicker.html`).
- Folder layout, build/run/test commands: see `docs/ARCHITECTURE.md` (project scaffolded 2026-10-24; code in `src/{numbers,core,content,app,ui}`, tests next to code as `*.test.ts`).
- **No hard-coded tuning:** every number that affects progression (durations, rewards, XP, level thresholds, level worth, prices, caps, intervals) must live in `src/content/gameConfig.ts` (`GameConfig`) and be validated in `core/config.ts`. Describe new variables in `docs/CONFIG.md`. Unit tests use `src/testing/testConfig.ts`, never the real tuning.
- Keep `docs/ARCHITECTURE.md`, `docs/CONFIG.md` and `DESIGN.md` updated in the same change as code.
- Regenerate the HTML overview with `npm run docs` (output: `docs/architecture.html`) after code changes, and update the curated sections in `scripts/architecture.template.html` when the design changes. Doc format is TSDoc with `Called by:` / `Calls:` lines in the description.
- Before reporting work done: run `npm run check` (typecheck, Biome, tests, docs check, build).
- Runs are applied in closed-form batches (no per-run iteration); keep it that way when adding mechanics, and extend `batching.test.ts` so one long tick and many short ones give the same run results.
- Tests for the real content (`content/gameConfig.test.ts`) check invariants, never tuning numbers.
- New mechanics extend `testing/invariants.ts` when they add state, and are covered by the random play in `core/properties.test.ts` (seeded, so failures reproduce).

Decided 2026-10-26 (by the user, after the full review):
- **Infinity is 1e308** (`core/infinity.ts`, `INFINITY`). Every amount is clamped to it by the overflow policy after every slice and every multiplier derived from an amount saturates there (`saturate`); reaching it calls the policy's `onInfinity` listener (the hook for the future infinity prestige, whose design is still open). It is a representational limit, not a tuning value.
- **Buyable effects live in one registry** (`core/effectRegistry.ts`): a new effect kind is a union member plus ONE registry entry (traits, validator, action and sleeve hooks). `effects.ts` has no `switch` over kinds. A kind read only by a dedicated query leaves the hooks out.
- **Unlock rules were removed** (`ActionDefinition.unlock`, the `unlock` effect, `unlockedActions`, `latchUnlocks`): actions are gated by access level only. Only save version 4 is read (version 3 support was removed).
- **One tab plays:** the first tab takes a Web Lock (`app/tabGuard.ts`), later tabs are told so before loading the save. The `storage`-event guard remains only as a fallback.
- **Saves:** the last successfully loaded save is kept as `cybersleeve.save.previous` and used when the main save is unreadable; the player can export the save as text and import it (`app/saveTransfer.ts`). Importing stops autosaving and reloads.
- **The engine mutates no state itself:** `Shop.toggle` switches auto-runs and `BackChannel` turns items into Moles. The 45-method delegating facade of `GameEngine` was kept on purpose (the UI and tests depend on it); flatten it only if it starts to hurt.
- `DESIGN.md` describes the game as it is now (no changelog inside); history lives in git. A docs/CI workflow (`.github/workflows/check.yml`) runs `npm run check`.
- **Hosting (2026-10-26):** the game is deployed to GitHub Pages (`https://afrandsen87.github.io/Cybersleeve/`) by `.github/workflows/deploy.yml` on every push to `main`: it runs `npm run check` and publishes `dist`. Pages source is set to "GitHub Actions" in the repository settings. The relative `base: './'` in `vite.config.ts` must stay so the build works under the sub-path.
- Python on this Windows machine reads files as cp1252 unless `PYTHONUTF8=1`: use UTF-8 explicitly when scripting edits.

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
- The design of the "infinity" prestige (reaching 1e308 only clamps and calls the `onInfinity` hook for now).
