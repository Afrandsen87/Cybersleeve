/**
 * @module ui
 *
 * The Skills tab: the skill tree bought with skill points, and the tree of re-sleeve skills.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `skillTree.ts`.
 */
import type { SkillsView } from '../viewModel';
import { type UiContext, h, setText } from './domKit';
import { mountSkillTree } from './skillTree';

/** The Skills tab. */
export interface SkillsPanel {
  /** The tab's panel, to place in the page. */
  readonly root: HTMLElement;
  /** Writes the skills view into the panel. */
  render(view: SkillsView): void;
}

/**
 * Builds the Skills tab once.
 *
 * Called by: {@link mountUi}. Calls: {@link mountSkillTree}.
 *
 * @param ctx what the panel needs from the screen
 * @param initial the skills as the first refresh sees them (decides which skill buttons exist)
 */
export function mountSkillsPanel(ctx: UiContext, initial: SkillsView): SkillsPanel {
  // The skills (bought with skill points): a tree of branches, every node always shown.
  const skillsWidget = h('aside', 'skills-widget');
  const skillsPoints = h('div', 'skills-points');
  const skillsTree = mountSkillTree(ctx, initial.lanes);
  skillsWidget.append(h('h2', undefined, initial.title), skillsPoints, skillsTree.element);

  // The re-sleeve skills: the same kind of tree, in one lane.
  const resleeveWidget = h('aside', 'skills-widget resleeve-skills');
  const resleevePoints = h('div', 'skills-points');
  const resleeveTree = mountSkillTree(ctx, initial.resleeve.lanes);
  resleeveWidget.append(h('h2', undefined, initial.resleeve.title), resleevePoints, resleeveTree.element);

  const root = h('div', 'tab-panel skills-panel');
  root.append(skillsWidget, resleeveWidget);
  return {
    root,
    render(view) {
      setText(skillsPoints, view.pointsText);
      skillsTree.render(view.lanes);
      resleeveWidget.hidden = !view.resleeve.visible;
      setText(resleevePoints, view.resleeve.pointsText);
      resleeveTree.render(view.resleeve.lanes);
    },
  };
}
