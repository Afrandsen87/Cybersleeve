/**
 * @module ui
 *
 * The Corporation tab: laid out like the Character tab, with the corporation widget where the Sleeve is, the other three widgets in their
 * places (empty for now) and the corporation's actions where the character's actions are.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`, `statWidget.ts`, `GameCommands.startCorporationAction`.
 */
import type { CorporationActionView, CorporationView } from '../viewModel';
import { ACTION_GRID_SLOTS } from './actionCards';
import { applyIcon, h, setFill, setText, type UiContext } from './domKit';
import { buildStatWidget, renderStats } from './statWidget';
import { START_RUN_ICON_ID } from '../pixelIcon';

/** The Corporation tab. */
export interface CorporationPanel {
  /** The panel to place in the page. */
  readonly root: HTMLElement;
  /** Writes the view into the panel. */
  render(view: CorporationView): void;
}

/** Handles to update one corporation action card. */
interface CorporationCard {
  readonly root: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly start: HTMLButtonElement;
  readonly title: HTMLElement;
  readonly info: HTMLElement;
  readonly bar: HTMLElement;
}

/**
 * Builds one corporation action card: the same run bar and start button as a character action, and nothing else (a corporation action
 * has no levels, no toggles and no purchases of its own).
 *
 * Called by: {@link mountCorporationPanel}.
 *
 * @param ctx what the widget needs from the screen
 * @param view the action as the first refresh sees it
 */
function buildCard(ctx: UiContext, view: CorporationActionView): CorporationCard {
  const { engine, text, icons } = ctx;
  const root = h('div', 'action corporation-action');
  const button = h('button', 'action-main') as HTMLButtonElement;
  const title = h('div', 'action-title');
  applyIcon(title, icons.urlFor(view.id));
  const info = h('div', 'action-info');
  const bar = h('div', 'bar-fill');
  const track = h('div', 'bar');
  track.append(bar);
  button.append(title, info, track);
  button.addEventListener('click', () => engine.startCorporationAction(view.id));
  const start = h('button', 'start-run') as HTMLButtonElement;
  start.setAttribute('aria-label', text.controls.startRun);
  applyIcon(start, icons.urlFor(START_RUN_ICON_ID));
  if (!start.classList.contains('has-icon')) start.textContent = '▶';
  start.addEventListener('click', () => engine.startCorporationAction(view.id));
  root.append(button, start);
  return { root, button, start, title, info, bar };
}

/**
 * Builds the Corporation tab once.
 *
 * Called by: {@link mountUi}. Calls: {@link buildCard}, `buildStatWidget`.
 *
 * @param ctx what the widget needs from the screen
 * @param initial the corporation as the first refresh sees it (decides which cards exist)
 */
export function mountCorporationPanel(ctx: UiContext, initial: CorporationView): CorporationPanel {
  const { text, tips } = ctx;
  const widget = buildStatWidget('corporation-widget', initial.title, initial.stats);
  // The widgets beside the corporation widget keep the places of the Character tab's widgets, and have nothing in them yet.
  const empty = (className: string, title: string): HTMLElement => {
    const el = h('aside', `${className} corporation-empty`);
    el.append(h('h2', undefined, title));
    return el;
  };
  const right = h('div', 'dashboard-right');
  right.append(
    empty('network-widget', text.titles.holdings),
    empty('upgrades-widget', text.titles.assetAcquisition),
    empty('exploitation-widget', text.titles.hostileNegotiation),
  );
  const dashboard = h('div', 'dashboard');
  dashboard.append(widget.root, right);

  const actions = h('section', 'actions');
  const cards = new Map<string, CorporationCard>();
  for (const a of initial.actions) {
    const card = buildCard(ctx, a);
    cards.set(a.id, card);
    actions.append(card.root);
  }
  for (let i = initial.actions.length; i < ACTION_GRID_SLOTS; i++) actions.append(h('div', 'action empty'));

  const layout = h('div', 'layout');
  layout.append(dashboard, h('hr', 'divider'), actions);
  const root = h('div', 'tab-panel corporation-panel');
  root.append(layout);

  return {
    root,
    render(view) {
      renderStats(widget, view.stats, tips);
      for (const a of view.actions) {
        const card = cards.get(a.id);
        if (!card) continue;
        setText(card.title, a.name);
        setText(card.info, a.infoText);
        tips.set(card.info, () => a.tip);
        card.button.disabled = !a.startable;
        card.start.disabled = !a.startable || a.running; // greyed out until the run is over
        setFill(card.bar, a.progressPercent);
        card.root.classList.toggle('running', a.running);
      }
    },
  };
}
