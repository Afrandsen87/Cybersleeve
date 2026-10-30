/**
 * @module ui
 *
 * The fast-forward switch as the UI sees it.
 */

/**
 * The fast-forward switch as the UI sees it (satisfied by `SpeedToggle`). Lives in its own file so that `dom.ts` and the widgets that take it
 * (`widgets/controls.ts`) do not import each other.
 *
 * Called by: `dom.ts` (`mountUi`), `widgets/controls.ts` (the test aids bar). Implemented by: `app/speedToggle.ts`.
 */
export interface SpeedControl {
  readonly enabled: boolean;
  readonly factor: number;
  toggle(): boolean;
}
