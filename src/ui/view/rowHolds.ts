/**
 * @module ui
 * Automation context: pure height holds prevent rows above the pointer collapsing.
 * Called by: automation inspector and tests. Calls: nothing.
 */

/** Computes retained minimum heights, releasing lower rows and all holds on close.
 * Called by: automation inspector layout. Calls: nothing.
 * @param order daemon rows in page order
 * @param previousOpen row the pane leaves
 * @param nextOpen row the pane enters, or null when closing
 * @param heights measured row heights before movement
 * @param holds existing retained heights
 * @returns a new map containing only rows above the newly open row
 */
export function rowHolds(
  order: readonly string[],
  previousOpen: string | null,
  nextOpen: string | null,
  heights: ReadonlyMap<string, number>,
  holds: ReadonlyMap<string, number> = new Map(),
): Map<string, number> {
  const nextIndex = nextOpen === null ? -1 : order.indexOf(nextOpen);
  const result = new Map<string, number>();
  if (nextIndex < 0) return result;
  for (const [lane, height] of holds) {
    const index = order.indexOf(lane);
    if (index >= 0 && index < nextIndex) result.set(lane, height);
  }
  if (previousOpen !== null && previousOpen !== nextOpen) {
    const previousIndex = order.indexOf(previousOpen);
    const height = heights.get(previousOpen);
    if (previousIndex >= 0 && previousIndex < nextIndex && height !== undefined && Number.isFinite(height)) {
      result.set(previousOpen, Math.max(result.get(previousOpen) ?? 0, height, 0));
    }
  }
  return result;
}
