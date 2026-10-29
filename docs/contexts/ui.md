# Context: ui

Rendering, view models, text, tooltips, layout.

Code: `src/core/ui/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-24 (by the user)*
- **UI:** **vanilla TypeScript** with a small own view layer. Core game logic is framework-free and has no DOM access; views are thin and data-driven.

*Group: Decided 2026-10-25 (by the user, after the second review)*
- All interface wording lives in `src/ui/uiText.ts`; `viewModel.ts` and `dom.ts` hold none. Stat widgets are data-driven rows (`StatRowView`), not hand-written per field.

*Group: Decided 2026-10-25 (by the user, after the second review)*
- The test aids (Reset save, Speed x10) are shown only in development builds or with `?debug` in the address.

*Group: Decided 2026-10-25 (by the user, after the performance review)*
- **Rendering rules.** The screen is drawn by `RenderLoop` on `requestAnimationFrame` (rate-limited by `runtime.renderMs`); the game steps on its own timer. Bars move with `transform: scaleX()` plus a CSS transition of `--render-ms`, never by `width`. Hover texts are built only when shown: view-model tips are getters, `dom.ts` registers them in a `TipRegistry`, and nothing reads them every frame. `buildViewModel` runs inside `engine.snapshot(...)`. Measure before optimising: the game cost about 1% of a core when measured, so new UI work should keep it that way (no per-frame work that scales with the number of buyables beyond what the view model already does).

*Group: Decided 2026-10-26 (by the user, Overclock, Focus and Burn leads)*
- **The square (2026-10-26):** on every action card the run bar spans the full width, and under it a square (the same height as the reward line plus the two level bars) sits beside those. Before Auto-run is bought the whole square is the button that buys it; afterwards it is a 2x2 grid of Auto-run, Overclock, Focus and Augment. A cell whose unlock is not bought is a purchase button, a bought one is a toggle, and a feature the action does not have is an empty dashed cell. These buyables (effect kinds `autoRun`, `overclockUnlock`, `focusUnlock`) are not shown in the card's row of purchases (`BuyableView.inSquare`).

*Group: Decided 2026-10-25 (by the user, icons)*
- **Pixel-art icons**, 16x16, drawn as text grids in `content/icons.ts` and assigned to entities by id (`ENTITY_ICONS`); nothing in `core` knows about them. Style: limited neon palette on dark, drawn crisp (`image-rendering: pixelated`). Current set: network (Grow network), terminal (Practice Hacking), bug (Push malware), server rack (Kill servers), grinning skull (Build Legend), redacted file (Kompromat), chip (Augment schematic), flame (Burn lead), a chip with a stylised C (credits: in the universe credits are held on chips). Shown on action titles, inventory rows and the credits line; buyables, skills and Moles have none yet.

*Group: Decided 2026-10-25 (by the user, icons)*
- **Inventory layout (2026-10-26):** a grid of tiles, one for every possible item and rarity (icon, count underneath, dimmed when 0). Items that cannot be sold are in a section on the left; sellable ones in their own section on the right, where a tile is selected by clicking and sold with the Sell and Sell all buttons beside the grid. Clicking a Burn lead tile uses one. The Back channel (Kompromat for Moles) is a third button beside Sell and Sell all, for the selected common Kompromat.

*Group: Decided 2026-10-26 (by the user, after the full review)*
- **The Re-sleeve button is the Sleeve levels purchase (2026-10-27):** one button at the bottom of the Sleeve widget (`ui/widgets/controls.ts`, `buildResleeveRow`). Until the unlock is owned it shows the buyable (name and price, `ViewModel.resleeveBuy`) and a click buys it through `UiContext.activate`; once owned it is the two-click Re-sleeve action, disabled for the lockout. The buyable is left out of the Sleeve Improvements list (`sectionLayout`, `sleeveView`).
