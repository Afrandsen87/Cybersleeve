/**
 * @module ui
 * Automation context: persistent daemon chrome with reveal-safe offline guidance.
 * Called by: automationWidget. Calls: DOM helpers, mountSkillTree.
 */
import type { AutomationFeatureView } from '../../view/viewTypes';
import { type UiContext, h, setClass, setHidden, setText } from '../domKit';
import { mountSkillTree } from '../skillTree';
import type { SkillTreeOptions } from '../skillTree';

/** Builds a daemon's fixed chrome and card tree. Called by: automationWidget. Calls: mountSkillTree.
 * @param ctx UI commands and wording
 * @param initial initial feature structure
 * @param controls mounted protocol controls
 * @returns persistent daemon handles and renderer
 */
export function mountDaemonPanel(
  ctx: UiContext,
  initial: AutomationFeatureView,
  controls: HTMLElement,
  interaction: SkillTreeOptions = {},
) {
  const box = h('section', `automation-feature automation-${initial.id} panel`);
  box.style.setProperty('--lane', `var(--branch-${initial.id})`);
  const header = h('h3', 'ph');
  const tag = h('span', 'daemon-state');
  header.append(h('span', undefined, initial.name), tag);
  const description = h('p', 'automation-description', initial.description);
  const note = h('p', 'daemon-offline');
  const tree = mountSkillTree(ctx, initial.lanes, { mode: 'lanes', cards: true, ...interaction });
  box.append(header, description, note, controls, tree.element);
  return {
    box,
    controls,
    tree,
    /** Updates chrome without rebuilding. Called by: renderAutomation. Calls: DOM helpers. */
    render(view: AutomationFeatureView): boolean {
      setText(tag, view.unlocked ? ctx.text.automation.online : ctx.text.automation.offline);
      setClass(tag, 'online', view.unlocked);
      setClass(box, 'unlocked', view.unlocked);
      setHidden(controls, !view.unlocked);
      setHidden(description, !view.unlocked);
      setHidden(note, view.unlocked);
      setText(note, view.offlineNote);
      return tree.render(view.lanes);
    },
  };
}
