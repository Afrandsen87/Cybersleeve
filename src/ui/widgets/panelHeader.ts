/**
 * @module ui
 *
 * The header of a panel: the title (drawn as `// TITLE` by CSS) and an optional status LED on the right.
 *
 * @remarks
 * Called by: `statWidget.ts`, `sleeveWidgets.ts`, `inventoryWidget.ts`. Calls: `domKit.ts`.
 */
import { h, setText } from './domKit';

/** A panel header with its status LED. */
export interface PanelHeader {
  readonly root: HTMLElement;
  /** The LED; hidden while there is no status. */
  readonly led: HTMLElement;
}

/**
 * Builds a panel header once: a `.ph` row holding the title in an `h2` and a hidden `.led`.
 *
 * Called by: the panel builders. Calls: {@link h}.
 *
 * @param title the panel title as written in `uiText` (the `// ` prefix and the upper case come from CSS)
 */
export function buildPanelHeader(title: string): PanelHeader {
  const root = h('div', 'ph');
  const led = h('span', 'led on');
  led.hidden = true;
  root.append(h('h2', undefined, title), led);
  return { root, led };
}

/**
 * Writes the LED text of a header; `null` hides the LED.
 *
 * Called by: `renderStats`. Calls: {@link setText}.
 *
 * @param header the header to update
 * @param status the LED text from the view, or `null` for no LED
 */
export function setPanelStatus(header: PanelHeader, status: string | null): void {
  header.led.hidden = status === null;
  if (status !== null) setText(header.led, status);
}
