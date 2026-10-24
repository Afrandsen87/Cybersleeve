/**
 * @module ui
 *
 * Hover tooltips that never leave the window. Any element with a `data-tip` attribute gets one.
 *
 * @remarks
 * The placement maths ({@link placeTooltip}) is pure and tested; {@link installTooltips} is the thin DOM binding.
 */

/** A rectangle in viewport coordinates (as returned by `getBoundingClientRect`). */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Size of the visible window. */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** Gap between the anchor and the tooltip, in px. */
const GAP = 6;
/** Smallest distance kept between the tooltip and the window edge, in px. */
const MARGIN = 8;

/**
 * Chooses where to put a tooltip so that it lies fully inside the window.
 *
 * @remarks
 * Preferred spot: above the anchor, left edges aligned. If there is no room above it goes below; both axes are then
 * clamped to the window (a tooltip larger than the window sticks to the top-left margin).
 * Called by: {@link installTooltips}.
 *
 * @param anchor the element the tooltip belongs to
 * @param size size of the tooltip
 * @param viewport size of the window
 * @returns the top-left corner of the tooltip, in viewport coordinates
 */
export function placeTooltip(
  anchor: Box,
  size: Box | { width: number; height: number },
  viewport: ViewportSize,
): { left: number; top: number } {
  const above = anchor.top - GAP - size.height;
  const below = anchor.top + anchor.height + GAP;
  const top = above >= MARGIN ? above : below;
  const clamp = (value: number, extent: number, available: number): number =>
    Math.max(MARGIN, Math.min(value, available - extent - MARGIN));
  return { left: clamp(anchor.left, size.width, viewport.width), top: clamp(top, size.height, viewport.height) };
}

/**
 * Shows the `data-tip` text of the hovered or focused element in one shared tooltip box.
 *
 * @remarks
 * The text is re-read when the attribute changes, so a tooltip stays current while the game updates it.
 * Called by: `dom.ts` (`mountUi`). Side effects: appends one element to `doc.body`; adds listeners to `doc`.
 *
 * @param doc the document to attach to
 */
export function installTooltips(doc: Document): void {
  const box = doc.createElement('div');
  box.className = 'tooltip';
  box.hidden = true;
  doc.body.append(box);

  let current: HTMLElement | null = null;

  const show = (anchor: HTMLElement): void => {
    const text = anchor.dataset['tip'];
    if (!text) {
      hide();
      return;
    }
    current = anchor;
    box.textContent = text;
    box.hidden = false;
    const view = doc.defaultView;
    const spot = placeTooltip(anchor.getBoundingClientRect(), box.getBoundingClientRect(), {
      width: doc.documentElement.clientWidth,
      height: view?.innerHeight ?? doc.documentElement.clientHeight,
    });
    box.style.left = `${spot.left}px`;
    box.style.top = `${spot.top}px`;
  };
  const hide = (): void => {
    current = null;
    box.hidden = true;
  };
  const anchorOf = (event: Event): HTMLElement | null =>
    event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tip]') : null;

  doc.addEventListener('mouseover', (e) => {
    const anchor = anchorOf(e);
    if (anchor) show(anchor);
  });
  doc.addEventListener('mouseout', (e) => {
    const anchor = anchorOf(e);
    // Moving between children of the same anchor is not leaving it.
    const staying = e.relatedTarget instanceof Node && anchor?.contains(e.relatedTarget);
    if (anchor !== null && anchor === current && !staying) hide();
  });
  doc.addEventListener('focusin', (e) => {
    const anchor = anchorOf(e);
    if (anchor) show(anchor);
  });
  doc.addEventListener('focusout', hide);
  new MutationObserver((records) => {
    if (current && records.some((r) => r.target === current)) show(current);
  }).observe(doc.body, { attributes: true, attributeFilter: ['data-tip'], subtree: true });
}
