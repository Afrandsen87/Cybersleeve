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
