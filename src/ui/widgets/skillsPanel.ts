/**
 * @module ui
 *
 * The Skills tab: the skills bought with skill points, and the tree of re-sleeve skills.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `upgradeButtons.ts`.
 */
import type { SkillsView } from '../viewModel';
import { type UiContext, h, setText } from './domKit';
import { renderUpgrades, upgradeRow } from './upgradeButtons';

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
 * Called by: {@link mountUi}. Calls: {@link upgradeRow}, {@link renderUpgrades}.
 *
 * @param ctx what the panel needs from the screen
 * @param initial the skills as the first refresh sees them (decides which skill buttons exist)
 */
export function mountSkillsPanel(ctx: UiContext, initial: SkillsView): SkillsPanel {
  const { icons, tips } = ctx;
  // The skills (bought with skill points).
  const skillsWidget = h('aside', 'skills-widget');
  const skillsPoints = h('div', 'skills-points');
  const skillButtons = new Map<string, HTMLButtonElement>();
  const skillsRow = upgradeRow(initial.buyables, ctx.activate, icons);
  for (const [id, button] of skillsRow.buttons) skillButtons.set(id, button);
  skillsWidget.append(h('h2', undefined, initial.title), skillsPoints, skillsRow.element);

  // The re-sleeve skills: a tree, one row per depth (a skill sits below the ones it needs). Locked nodes are shown dimmed.
  const resleeveWidget = h('aside', 'skills-widget resleeve-skills');
  const resleevePoints = h('div', 'skills-points');
  const resleeveTree = h('div', 'skill-tree');
  const resleeveButtons = new Map<string, HTMLButtonElement>();
  for (const tier of initial.resleeve.tiers) {
    const tierRow = upgradeRow(tier, ctx.activate, icons);
    tierRow.element.classList.add('skill-tier');
    for (const [id, button] of tierRow.buttons) resleeveButtons.set(id, button);
    resleeveTree.append(tierRow.element);
  }
  resleeveWidget.append(h('h2', undefined, initial.resleeve.title), resleevePoints, resleeveTree);

  const root = h('div', 'tab-panel skills-panel');
  root.append(skillsWidget, resleeveWidget);
  return {
    root,
    render(view) {
      setText(skillsPoints, view.pointsText);
      renderUpgrades(skillButtons, view.buyables, tips);
      resleeveWidget.hidden = !view.resleeve.visible;
      setText(resleevePoints, view.resleeve.pointsText);
      const treeSkills = view.resleeve.tiers.flat();
      renderUpgrades(resleeveButtons, treeSkills, tips);
      for (const b of treeSkills) {
        const button = resleeveButtons.get(b.id);
        if (!button) continue;
        button.hidden = false; // the whole tree is visible; a node that cannot be bought yet is dimmed
        button.classList.toggle('locked', !b.available);
      }
    },
  };
}
