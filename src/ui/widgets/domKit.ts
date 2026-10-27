/**
 * @module ui
 *
 * The smallest DOM helpers every widget uses: creating an element, writing text and bar fills only when they changed, icons,
 * and the experience bar.
 *
 * @remarks
 * Called by: every file in `ui/widgets/` and `ui/dom.ts`. Calls: nothing but the DOM.
 */
import type { GameCommands, GameQueries } from '../../core';
import type { IconSource } from '../pixelIcon';
import type { TipRegistry } from '../tooltip';
import type { UiText } from '../uiText';

/** Everything a widget needs from the screen it is part of. */
export interface UiContext {
  /** The engine to read from and command. */
  readonly engine: GameQueries & GameCommands;
  /** The display text. */
  readonly text: UiText;
  /** The icons shown beside actions, items and the credits. */
  readonly icons: IconSource;
  /** Where hover texts are registered. */
  readonly tips: TipRegistry;
  /** A click on a purchase: the engine decides whether it buys or switches an auto-run. */
  activate(id: string): unknown;
  /** Redraws the whole screen (called after a click changed the game). */
  refresh(): void;
}

/** Handles to update one small experience bar with its label. */
export interface XpBar {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly fill: HTMLElement;
}

/** Builds an empty small experience bar (label above a thin grey/teal bar). */
export function xpBar(): XpBar {
  const label = h('div', 'xp-label');
  const fill = h('div', 'xp-fill');
  const track = h('div', 'xp-bar');
  track.append(fill);
  const root = h('div', 'xp');
  root.append(label, track);
  return { root, label, fill };
}

/**
 * Writes the label and the fill of an experience bar.
 *
 * @param bar the bar to update
 * @param label the text above the bar
 * @param percent how full the bar is, 0 to 100
 */
export function setXpBar(bar: XpBar, label: string, percent: number): void {
  setText(bar.label, label);
  setFill(bar.fill, percent);
}

/**
 * Gives an element an icon drawn before its text (a `::before` box that paints the `--icon` image). Adds no child, so the
 * element's text can still be replaced freely.
 *
 * @param el the element
 * @param url the CSS image value from an {@link IconSource}; `null` leaves the element as it is
 */
export function applyIcon(el: HTMLElement, url: string | null): void {
  if (url === null) return;
  el.classList.add('has-icon');
  el.style.setProperty('--icon', url);
}

/** Sets an element's text only when it changed, so an unchanged frame touches nothing in the DOM. */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/**
 * Sets how full a bar is. The fill is a full-width element scaled from the left (`transform`, which the browser can animate without
 * re-laying out the page), and CSS eases it towards each new value over one refresh interval so it moves smoothly between refreshes.
 * A bar that goes down (a run that finished and starts over) snaps back instead of sliding backwards.
 *
 * @param el the fill element
 * @param rawPercent how full the bar is, 0 to 100 (rounded to two decimals: finer changes are far below a pixel)
 */
export function setFill(el: HTMLElement, rawPercent: number): void {
  const percent = Math.round(rawPercent * 100) / 100;
  const key = String(percent);
  const before = el.dataset['fill'];
  if (before === key) return;
  el.dataset['fill'] = key;
  const snap = before !== undefined && percent < Number(before);
  el.style.transition = snap ? 'none' : '';
  el.style.transform = `scaleX(${percent / 100})`;
}

/**
 * Creates an element.
 *
 * @param tag the tag name
 * @param className the class attribute, if any
 * @param text the text content, if any
 */
export function h(tag: string, className?: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}
