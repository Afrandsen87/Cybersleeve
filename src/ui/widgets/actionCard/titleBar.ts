/**
 * @module ui
 *
 * The title bar of an action card (a process window): icon and name, the muted process id, the critical mark and the state LED.
 *
 * @remarks
 * Called by: `actionCards.ts`. Calls: `domKit.ts`. Draws only view fields: the state and the process id come from `ActionView`.
 */
import type { IconSource } from '../../pixelIcon';
import type { UiText } from '../../uiText';
import type { ActionView } from '../../viewModel';
import { applyIcon, h, setText } from '../domKit';

/** Handles to update the title bar of one card. */
export interface TitleBar {
  /** The bar, to place at the top of the card's start button. */
  readonly root: HTMLElement;
  /** The action name, with the action icon drawn before it. */
  readonly title: HTMLElement;
  readonly id: HTMLElement;
  /** The mark that lights up for a second when the action hits a critical success. */
  readonly crit: HTMLElement;
  /** The state LED (`data-state` is `auto`, `running` or `idle`; CSS draws the colour and the pulse). */
  readonly led: HTMLElement;
}

/**
 * Builds the title bar of one card once.
 *
 * Called by: `mountActionCards`. Calls: {@link h}, {@link applyIcon}.
 *
 * @param actionId the action (its icon is looked up by id)
 * @param icons the icons
 */
export function buildTitleBar(actionId: string, icons: IconSource): TitleBar {
  const root = h('div', 'proc-bar');
  const title = h('div', 'action-title');
  applyIcon(title, icons.urlFor(actionId));
  const id = h('span', 'proc-id');
  const crit = h('span', 'crit-badge');
  crit.hidden = true;
  const led = h('span', 'led proc-led');
  root.append(title, id, crit, led);
  return { root, title, id, crit, led };
}

/**
 * Writes one card's title bar from its view: name, process id, the critical mark and the state LED. Touches the DOM only for what changed.
 *
 * Called by: `mountActionCards` (render). Calls: {@link setText}.
 *
 * @param bar the bar to update
 * @param a the action's view
 * @param text the display text (the LED wording)
 */
export function renderTitleBar(bar: TitleBar, a: ActionView, text: UiText): void {
  setText(bar.title, a.name);
  setText(bar.id, a.processId);
  bar.crit.hidden = a.critText === null;
  setText(bar.crit, a.critText ?? '');
  setText(bar.led, text.action.state[a.state]);
  if (bar.led.dataset.state !== a.state) bar.led.dataset.state = a.state;
}
