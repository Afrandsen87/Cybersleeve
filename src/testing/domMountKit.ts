/**
 * @module testing
 *
 * Shared setup for the UI tests that mount the whole interface into a DOM (happy-dom).
 *
 * @remarks
 * Before this kit sixteen test files each declared their own idle fast-forward switch and repeated the `mountUi(root, game, speed, () => {})`
 * call. A UI test imports {@link idleSpeed} and {@link mountTestUi} from here. The file must not import the DOM itself: the test file picks
 * the environment (`// @vitest-environment happy-dom`).
 */
import type { GameEngine } from '../core';
import { mountUi, type MountOptions } from '../ui/dom';
import type { SpeedControl } from '../ui/speedControl';

/** A fast-forward switch that is off and does nothing when toggled. Used by: every UI test that mounts the interface. */
export const idleSpeed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

/**
 * Mounts the interface for a test with the idle speed switch and a reset handler that does nothing.
 *
 * Called by: UI tests. Calls: `mountUi`.
 *
 * @param root the element to mount into
 * @param game the engine to show
 * @param options the optional settings of `mountUi` (text, icons, debug controls)
 * @returns the render function `mountUi` returns (call it to redraw)
 */
export function mountTestUi(root: HTMLElement, game: GameEngine, options?: MountOptions): ReturnType<typeof mountUi> {
  return mountUi(root, game, idleSpeed, () => {}, options);
}

/**
 * Clicks a tab in the top bar, as the player does; the interface redraws with that tab shown. Panels that skip drawing while hidden
 * (the Firmware tab) need this before a test reads them.
 *
 * Called by: UI tests. Calls: the tab button's click handler.
 *
 * @param root the element the interface was mounted into
 * @param id the tab id (`TAB_IDS`), e.g. `'skills'` for the Firmware tab
 */
export function openTab(root: HTMLElement, id: string): void {
  root.querySelector<HTMLButtonElement>(`.tab[data-tab="${id}"]`)!.click();
}
