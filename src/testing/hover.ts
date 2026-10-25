/**
 * @module testing
 *
 * Test aid for the DOM tests: reads a tooltip the way a player does, by pointing at the element.
 */

/**
 * The tooltip text shown when the pointer arrives on an element.
 *
 * @remarks
 * Tooltip text is built on hover (see `TipRegistry`), so it cannot be read from the element. Uses the most recently mounted tooltip
 * box (each `mountUi` adds one) and leaves the pointer again afterwards.
 *
 * @param el the element to point at (it or an ancestor must carry a tooltip)
 * @returns the text, or an empty string when no tooltip shows
 */
export function hoverText(el: Element): string {
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  const boxes = document.querySelectorAll<HTMLElement>('.tooltip');
  const box = boxes[boxes.length - 1];
  const text = box && !box.hidden ? (box.textContent ?? '') : '';
  el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
  return text;
}
