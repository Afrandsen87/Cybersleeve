/**
 * @module ui
 *
 * The Automation tab: for each automation feature its settings and its skill lane.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`, `skillTree.ts`, `AutomationControls`.
 */
import type { AutoBurnSwitch, AutomationControls, AutomationFeature } from '../../core';
import type { AutomationView } from '../viewModel';
import { type UiContext, h, setText } from './domKit';
import { type ResumeChecklistWidget, mountResumeChecklist } from './resumeChecklist';
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
  /** Auto Burn's switches by name, shown once the skill that adds each is owned. */
  readonly autoBurnSwitches: ReadonlyMap<AutoBurnSwitch, HTMLButtonElement>;
  /** Auto Burn's threshold inputs and reserve input, each with the row that holds it (hidden until its skill is owned). */
  readonly autoBurnLower: { readonly row: HTMLElement; readonly input: HTMLInputElement };
  readonly autoBurnUpper: { readonly row: HTMLElement; readonly input: HTMLInputElement };
  readonly autoBurnReserve: { readonly row: HTMLElement; readonly input: HTMLInputElement };
  /** The checklists under the two resume switches. */
  readonly resumeOverclocks: ResumeChecklistWidget;
  readonly resumeAutoRuns: ResumeChecklistWidget;
  readonly rarities: ReadonlyMap<string, HTMLButtonElement>;
  readonly shares: ReadonlyMap<string, HTMLInputElement>;
}

/** A labelled number input. A change (Enter or leaving the field) is passed to `onChange` as a number. */
function numberField(
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
 * ceiling, a switch per rarity for autosale, a share per action for dispersal) and its skill lane (always shown; the first skill is the
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
  const autoBurnSwitches = new Map<AutoBurnSwitch, HTMLButtonElement>();
  for (const s of view.autoBurn.switches) {
    const b = h('button', 'automation-switch', s.label) as HTMLButtonElement;
    b.addEventListener('click', () => {
      burn.setSwitch(s.name, !burn.rules()[s.name]);
      refresh();
    });
    autoBurnSwitches.set(s.name, b);
  }
  const resumeOverclocks = mountResumeChecklist((id, ticked) => {
    burn.setResumeOverclock(id, ticked);
    refresh();
  });
  const resumeAutoRuns = mountResumeChecklist((id, ticked) => {
    burn.setResumeAutoRun(id, ticked);
    refresh();
  });
  /** Each switch's button, with the checklist of a resume switch right under it. */
  const switchRows = [...autoBurnSwitches].flatMap(([name, button]) =>
    name === 'onActions' ? [button, resumeAutoRuns.element] : name === 'onOverclocks' ? [button, resumeOverclocks.element] : [button],
  );
  // both thresholds are set together (the pair must stay 0 <= lower < upper), so each field sends the other's current value with its own
  const lower = numberField(view.autoBurn.thresholds.lowerLabel, 0, null, (v) => {
    burn.setThresholds(v, burn.rules().upperAt);
    refresh();
  });
  const upper = numberField(view.autoBurn.thresholds.upperLabel, 0, null, (v) => {
    burn.setThresholds(burn.rules().lower, v);
    refresh();
  });
  const reserve = numberField(view.autoBurn.reserve.label, 0, null, (v) => {
    burn.setReserve(v);
    refresh();
  });
  const rarities = new Map<string, HTMLButtonElement>();
  const shares = new Map<string, HTMLInputElement>();
  for (const f of view.features) {
    const box = h('section', `automation-feature automation-${f.id}`);
    const body = h('div', 'automation-controls');
    if (f.id === 'autoBurn')
      body.append(h('p', 'automation-hint', view.autoBurn.hint), ...switchRows, lower.row, upper.row, reserve.row);
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
    } else {
      for (const a of view.actions) {
        const field = numberField(`${a.name}: ${view.shareLabel}`, 0, 100, (v) => {
          controls.setDispersal(a.id, v);
          refresh();
        });
        shares.set(a.id, field.input);
        body.append(field.row);
      }
    }
    const tree = mountSkillTree(ctx, f.lanes);
    box.append(h('h3', 'section-title', f.name), h('p', 'automation-description', f.description), body, tree.element);
    features.set(f.id, { box, controls: body, tree });
    root.append(box);
  }
  return {
    root,
    points,
    features,
    autoBurnSwitches,
    autoBurnLower: lower,
    autoBurnUpper: upper,
    autoBurnReserve: reserve,
    resumeOverclocks,
    resumeAutoRuns,
    rarities,
    shares,
  };
}

/** Sets an input's value from the game unless the player is typing in it (their text is not overwritten). */
function syncInput(input: HTMLInputElement, value: number): void {
  if (input.ownerDocument.activeElement !== input) input.value = String(value);
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
  for (const s of view.autoBurn.switches) {
    const b = widget.autoBurnSwitches.get(s.name);
    if (!b) continue;
    b.hidden = !s.visible; // nothing is shown before its skill is owned
    b.classList.toggle('on', s.on);
  }
  widget.resumeOverclocks.render(view.autoBurn.resumeOverclocks);
  widget.resumeAutoRuns.render(view.autoBurn.resumeAutoRuns);
  const { thresholds, reserve } = view.autoBurn;
  widget.autoBurnLower.row.hidden = !thresholds.visible;
  widget.autoBurnUpper.row.hidden = !thresholds.visible;
  widget.autoBurnReserve.row.hidden = !reserve.visible;
  syncInput(widget.autoBurnLower.input, thresholds.lower);
  syncInput(widget.autoBurnUpper.input, thresholds.upper);
  syncInput(widget.autoBurnReserve.input, reserve.value);
  for (const r of view.rarities) widget.rarities.get(r.id)?.classList.toggle('on', r.on);
  for (const a of view.actions) {
    const input = widget.shares.get(a.id);
    if (input) syncInput(input, a.percent);
  }
}
