/**
 * @module ui
 *
 * The Automation tab: for each automation feature its settings and its skill lane.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`, `skillTree.ts`, `AutomationControls`.
 */
import type { AutomationControls, AutomationFeature } from '../../core';
import type { AutomationView } from '../viewModel';
import { type UiContext, h, setText } from './domKit';
import { type AutoBurnPanel, mountAutoBurnPanel } from './autoBurnPanel';
import { type SkillTreeWidget, mountSkillTree } from './skillTree';

/** One feature's box in the Automation tab. */
export interface AutomationFeatureHandle {
  readonly box: HTMLElement;
  /** The settings, shown once the feature is unlocked. */
  readonly controls: HTMLElement;
  /** The feature's skill lane. */
  readonly tree: SkillTreeWidget;
}

/** Handles to update the Automation tab. */
export interface AutomationWidget {
  readonly root: HTMLElement;
  readonly points: HTMLElement;
  /** Each feature's box, its unlock button, the controls that show once it is unlocked, and its skill lane. */
  readonly features: ReadonlyMap<AutomationFeature, AutomationFeatureHandle>;
  readonly autoBurn: AutoBurnPanel;
  readonly rarities: ReadonlyMap<string, HTMLButtonElement>;
  /** Automation context: Back Channel buttons, hidden individually by skill ownership. */
  readonly backchannelRarities: ReadonlyMap<string, HTMLButtonElement>;
  /** Automation context: action selection buttons, hidden until the action and feature unlock. */
  readonly targets: ReadonlyMap<string, HTMLButtonElement>;
  /** Automation context: selected count and known rarity summary. */
  readonly dispersalCount: HTMLElement;
  readonly dispersalRarities: HTMLElement;
}

/** A labelled number input. A change (Enter or leaving the field) is passed to `onChange` as a number. */
function _numberField(
  label: string,
  min: number,
  max: number | null,
  onChange: (value: number) => void,
): { row: HTMLElement; input: HTMLInputElement } {
  const row = h('label', 'automation-field');
  row.append(h('span', undefined, label));
  const input = h('input') as HTMLInputElement;
  input.type = 'number';
  input.min = String(min);
  if (max !== null) input.max = String(max);
  input.addEventListener('change', () => onChange(Number(input.value)));
  row.append(input);
  return { row, input };
}

/**
 * Builds the Automation tab: the points, and one box per feature with an unlock button, its controls once unlocked (Auto Burn's switch and
 * ceiling, a switch per rarity for autosale, a selection button per unlocked action for dispersal) and its skill lane (always shown; the first skill is the
 * unlock: there is no separate unlock button). Every press goes to the automation controls of the engine, which decide
 * what is allowed; a skill press goes through `ctx.activate`.
 *
 * Called by: {@link mountUi}.
 *
 * @param ctx what the skill lanes need from the screen (icons, tips, the buy command)
 * @param view the initial view data (decides which switches and inputs and skills exist)
 * @param controls the engine's automation controls
 * @param refresh redraws the screen after a press
 */
export function buildAutomationWidget(
  ctx: UiContext,
  view: AutomationView,
  controls: AutomationControls,
  refresh: () => void,
): AutomationWidget {
  const root = h('aside', 'automation-widget');
  const points = h('div', 'skills-points');
  root.append(h('h2', undefined, view.title), points);
  const features = new Map<AutomationFeature, AutomationFeatureHandle>();
  const burn = controls.autoBurn();
  const autoBurn = mountAutoBurnPanel(ctx, view.autoBurn, burn, refresh);
  const rarities = new Map<string, HTMLButtonElement>();
  const backchannelRarities = new Map<string, HTMLButtonElement>();
  const targets = new Map<string, HTMLButtonElement>();
  const dispersalCount = h('p', 'automation-dispersal-count');
  const dispersalRarities = h('p', 'automation-dispersal-rarities');
  for (const f of view.features) {
    const box = h('section', `automation-feature automation-${f.id}`);
    const body = h('div', 'automation-controls');
    if (f.id === 'autoBurn') body.append(autoBurn.element);
    else if (f.id === 'autosale') {
      for (const r of view.rarities) {
        const b = h('button', 'automation-switch', r.name) as HTMLButtonElement;
        b.addEventListener('click', () => {
          controls.setAutosale(r.id, !controls.isAutosaleOn(r.id));
          refresh();
        });
        rarities.set(r.id, b);
        body.append(b);
      }
      const channelRow = h('div', 'automation-backchannel');
      for (const r of view.backchannelRarities) {
        const b = h('button', 'automation-switch', r.name) as HTMLButtonElement;
        b.hidden = !r.visible;
        b.addEventListener('click', () => {
          controls.setAutoBackchannel(r.id, !controls.isAutoBackchannelOn(r.id));
          refresh();
        });
        backchannelRarities.set(r.id, b);
        channelRow.append(b);
      }
      body.append(channelRow);
    } else {
      body.append(dispersalCount, dispersalRarities);
      for (const a of view.actions) {
        const button = h('button', 'automation-switch', a.name) as HTMLButtonElement;
        button.addEventListener('click', () => {
          controls.setDispersalTarget(a.id, !controls.dispersalTargets().includes(a.id));
          refresh();
        });
        targets.set(a.id, button);
        body.append(button);
      }
    }
    const tree = mountSkillTree(ctx, f.lanes, { mode: 'lanes' });
    box.append(h('h3', 'section-title', f.name), h('p', 'automation-description', f.description), body, tree.element);
    features.set(f.id, { box, controls: body, tree });
    root.append(box);
  }
  return {
    root,
    points,
    features,
    autoBurn,
    rarities,
    backchannelRarities,
    targets,
    dispersalCount,
    dispersalRarities,
  };
}

/** Writes the Automation view into its widget: the points, which features are unlocked, and the current settings. */
export function renderAutomation(widget: AutomationWidget, view: AutomationView): void {
  setText(widget.points, view.pointsText);
  for (const f of view.features) {
    const handle = widget.features.get(f.id);
    if (!handle) continue;
    handle.controls.hidden = !f.unlocked;
    handle.box.classList.toggle('unlocked', f.unlocked);
    handle.tree.render(f.lanes);
  }
  widget.autoBurn.render(view.autoBurn);
  for (const [rows, buttons] of [
    [view.rarities, widget.rarities],
    [view.backchannelRarities, widget.backchannelRarities],
  ] as const) {
    for (const r of rows) {
      const b = buttons.get(r.id);
      if (!b) continue;
      b.hidden = !r.visible;
      b.classList.toggle('on', r.on);
    }
  }
  setText(widget.dispersalCount, view.dispersalCount);
  setText(widget.dispersalRarities, view.dispersalRarities);
  widget.dispersalRarities.hidden = view.dispersalRarities.length === 0;
  for (const a of view.actions) {
    const button = widget.targets.get(a.id);
    if (!button) continue;
    button.hidden = !a.visible;
    button.disabled = a.disabled;
    button.classList.toggle('on', a.selected);
    button.setAttribute('aria-pressed', String(a.selected));
  }
}
