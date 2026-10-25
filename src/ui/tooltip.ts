/**
 * @module ui
 *
 * Hover tooltips that never leave the window. Elements get one through the {@link TipRegistry}.
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

/** The attribute that marks an element as having a tooltip. Its value is unused: the text comes from the {@link TipRegistry}. */
const TIP_ATTRIBUTE = 'data-tip';

/**
 * Holds the tooltip text of each element as a function, so the text is only built for the element that is hovered.
 *
 * @remarks
 * Marking an element writes the `data-tip` attribute once (CSS and the hover handlers find anchors by it); replacing the
 * function afterwards touches no DOM. Called by: `dom.ts` (fills it every frame), {@link installTooltips} (reads it on hover).
 */
export class TipRegistry {
  private readonly providers = new WeakMap<HTMLElement, () => string>();

  /**
   * Sets or removes the tooltip of an element.
   *
   * @param el the element the tooltip belongs to
   * @param provider builds the text when it is needed; `null` removes the tooltip
   */
  set(el: HTMLElement, provider: (() => string) | null): void {
    if (provider === null) {
      this.providers.delete(el);
      if (el.hasAttribute(TIP_ATTRIBUTE)) el.removeAttribute(TIP_ATTRIBUTE);
      return;
    }
    this.providers.set(el, provider);
    if (!el.hasAttribute(TIP_ATTRIBUTE)) el.setAttribute(TIP_ATTRIBUTE, '');
  }

  /**
   * The current text of an element's tooltip.
   *
   * @param el the element
   * @returns the text, or an empty string when the element has none
   */
  textOf(el: HTMLElement): string {
    return this.providers.get(el)?.() ?? '';
  }
}

/** Handle returned by {@link installTooltips}. */
export interface TooltipControl {
  /** Re-reads the text of the tooltip that is showing (if any) so it follows the game. Does no layout work when the text is unchanged. */
  refresh(): void;
}

/**
 * Shows the tooltip of the hovered or focused element in one shared tooltip box.
 *
 * @remarks
 * The text is asked from the {@link TipRegistry} when the pointer arrives and again on every {@link TooltipControl.refresh}, so a
 * tooltip stays current while the game updates it, without the game building any text for elements nobody hovers.
 * Called by: `dom.ts` (`mountUi`). Side effects: appends one element to `doc.body`; adds listeners to `doc`.
 *
 * @param doc the document to attach to
 * @param tips where the tooltip texts come from
 * @returns the handle to refresh the visible tooltip
 */
export function installTooltips(doc: Document, tips: TipRegistry): TooltipControl {
  const box = doc.createElement('div');
  box.className = 'tooltip';
  box.hidden = true;
  doc.body.append(box);

  let current: HTMLElement | null = null;

  const show = (anchor: HTMLElement): void => {
    const text = tips.textOf(anchor);
    if (!text) {
      hide();
      return;
    }
    // Same anchor and same text: nothing to measure or move.
    if (anchor === current && !box.hidden && box.textContent === text) return;
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
    event.target instanceof Element ? event.target.closest<HTMLElement>(`[${TIP_ATTRIBUTE}]`) : null;

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
  return {
    refresh: () => {
      if (current) show(current);
    },
  };
}
