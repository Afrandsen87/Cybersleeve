# Plan: Re-sleeve box redesign

Approved mockup: [resleeve.html](resleeve.html). Context: **ui** only (widget, view, text, styles). No game rules, saves or tuning change. Its own small batch, separate from the Automation redesign.

## What changes

The re-sleeve box at the bottom of the Sleeve panel (`buildResleeveRow` in `src/ui/widgets/controls.ts`, styles in `src/ui/styles/sleeve.css`) gets the main screen's chrome, and five states:

1. **Locked, can't afford:** status LOCKED, a one-line description, a dimmed `UNLOCK ₵price` button, and a line saying what you have and how much is left.
2. **Locked, affordable:** the same, with the gold "can buy now" button.
3. **Charging:** the sleeve-level shortfall moves out of the tooltip into the box: a magenta progress bar (held / needed), the percentage as the status, and a "needs N sleeve levels across all actions · you have M" line. With more than one requirement there is one line each, and the bar follows the one furthest off. The button is disabled.
4. **Ready:** full bar, green READY, the button breathes magenta, and an "on arrival: +1 sleeve firmware point" line.
5. **Armed:** a solid magenta box with a three-line ledger (RESETS / KEEPS / GAINS) and CONFIRM and CANCEL side by side.

## Rules

- **Armed expands upwards, not down.** The buttons you click must stay where they are on screen: CONFIRM takes the RE-SLEEVE button's place, and CANCEL sits beside it. The extra ledger lines grow the box upwards. The box already sits at the bottom of the Sleeve panel with the free space above it (`margin-top: auto`); make sure the space is there in every layout. If it isn't, overlay the ledger upwards over the panel content (absolute, bottom-anchored) rather than pushing the button down. The same applies to every state change: the button's bottom edge never moves.
- **One text source.** Today the confirm sentence is one string (`text.resleeve.armed`). Split it into the ledger parts (resets, keeps, gains) in `uiText.ts`. The ledger and the Ready state's "on arrival" line read the same parts, so the words can't drift.
- **Values come from the owners.** The price and affordability come from the buy view (`resleeveBuyView`). Held and needed come from `resleeveRequirements` (`resleeveShortfallView`). The percentage is formatted in the view from those numbers, never re-derived in the widget. "To go" is the price minus credits, clamped at 0, formatted with the shared big-number formatter.
- **Reveal:** nothing new is shown before it matters. The box is still hidden until it is today, and the bar appears only while there is a requirement.
- **Rendering:** build the elements once; `render` flips classes, text and the bar's `transform: scaleX()`. The breathing glow is CSS only.

## Tests

- View tests (no DOM) for the state picked from the inputs: each of the five states, the percentage at 0, partial, exactly met and over, and huge held/needed values. Also NaN or Infinity clamped, and "to go" clamped at 0.
- Extend `resleeveButton.test.ts` and `resleeveShortfall.test.ts`: the confirm and cancel flow is unchanged, and the shortfall line shows in the box.
- Preview: screenshot the Sleeve panel in the locked, charging, ready and armed states. Check that the button doesn't move between Ready and Armed.

## Docs

- `DESIGN.md` (the re-sleeve section) and `docs/contexts/ui.md`.
- `docs/ARCHITECTURE.md` if a file is added.
- No `DECISIONS.md` entry unless the overlay fallback is needed.

Commit subject (player-facing): **Redesign the re-sleeve box**.
