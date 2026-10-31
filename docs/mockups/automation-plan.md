# Plan: Automation tab redesign (draft)

Mockup under review: [automation.html](automation.html). The full plan gets written once the user approves the mockup; this file holds what must go into it.

## Build on what the Firmware batch landed (merge `0f76a4c`)

The Firmware redesign is on main. It has the node states, the install animation, the path lines and an inspector (`ui/view/firmwareInspector.ts`, `ui/widgets/firmwareInspector.ts`, `styles/firmware.css`, `widgets/skillTreeEdges.ts`). The automation trees and the docked inspector reuse these through one code path; don't build a second inspector or a second set of node states. Read them before writing the spec. The Firmware plan said Automation-tab clicks keep buying; the mockup replaces that with select + INSTALL in the docked pane.

## Carried into this batch (agreed, not built separately)

1. **Tree nodes misplaced:** probably already fixed. The Firmware batch added `.lane-grid > .skill-node { position: absolute }`, which outranks `.upgrade { position: relative }`. Check the Automation trees in the preview, and fix only if the nodes are still out of place.
2. **Auto Burn status line repeats the toggle state.** "STANDBY · Inventory toggle is off" is followed by "Inventory toggle OFF". Say it once.
3. **Auto Burn heat formatting.** Heat shows as `1359.349`; use the Sleeve widget's heat formatter. Past the strip's end, the marker label (`1359.349 +`) runs outside the panel: right-align it inside.

## Docked inspector rules (agreed in review)

- **Hover returns to the pinned firmware at once.** With a firmware pinned, leaving any node goes straight back to the pinned one. It must not wait until the mouse leaves the whole lane: nodes passed over on the way to INSTALL would take the pane over and make buying finicky. With nothing pinned, moving from a node into its open row (towards the pane) keeps the preview.
- **The pane follows hover into other lanes.** Hovering a node in another lane moves the pane there. The preview stays while the cursor is in that lane's row or the pane, and the pane returns to the pinned lane when the cursor leaves the row. (Only in the pinned lane does leaving a node revert at once.)
- **Nothing under the cursor moves** (the first try flickered: hovering a lane below the pinned one closed the pinned row, the hovered node slid up out from under the cursor, the pane jumped back, and so on). Three parts:
  - *Height hold:* when the pane leaves a row that sits above the newly opened one, that row keeps the height it had while open (`min-height`). Holds are released when the pane closes altogether; a row below the open one is never held.
  - *Scroll anchoring:* on every hover or click that moves the pane, anchor the node under the cursor (else the row it is in) and, for the width transition (~350 ms, while the narrowed lane rewraps), scroll the page by however far it moved. Turn off the browser's own `overflow-anchor` so the two don't fight.
  - *Bottom spacer:* if anchoring needs to scroll down past the end of the page, grow a spacer at the bottom; reset it when the pane closes. With the height hold, it never needs to scroll above the top.
- Verified in the mockup with scripted hovers: pinned a Kompromat firmware, hovered an Augment node at scroll 0 and scrolled; the node's position stayed the same through the transition.
- **One height, no scrollbar.** The docked pane shows every section for every firmware: REQUIRES and UNLOCKS NEXT say "nothing" when empty, and the cost/INSTALL block is always there (INSTALLED when owned). Its height is the same whichever firmware it shows: a fixed height that fits the longest content, or the tallest firmware measured once when the tab is built. A shorter lane grows to match; the pane never scrolls.

## Not defects (user's design choices after the Auto Burn batch)

- The first row is tagged **REDLINE** (not TRIGGER).
- Rows have no skill-name captions under their tags.
- A red-bordered RESTART chip marks one not unlocked in the current run.

## Noted, left alone

- Dispersal gives 6 target slots for 5 actions: the last Dispersal Target does nothing (content/balance).
