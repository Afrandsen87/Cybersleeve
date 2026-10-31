// @vitest-environment happy-dom
/**
 * @module ui
 * Exercises selection, buying and CSS animation triggers using injected commands.
 * Called by: Vitest. Calls: widgetContext, mountSkillsPanel, mountSkillTree.
 */
import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../app/createGame';
import { joinedTreeConfig } from '../testing/joinedSkillTreeKit';
import { pointGame } from '../testing/skillsTabKit';
import { widgetContext } from '../testing/widgetKit';
import { buildViewModel } from './viewModel';
import type { SkillLaneView } from './viewModel';
import { mountSkillsPanel } from './widgets/skillsPanel';
import { mountSkillTree } from './widgets/skillTree';

describe('Firmware selection and installation', () => {
  it('pins a click without buying, then INSTALL invokes the one activation path once', () => {
    const game = pointGame();
    const activate = vi.fn();
    const refresh = vi.fn();
    const ctx = widgetContext(game, activate, refresh);
    const view = buildViewModel(game).skills;
    const panel = mountSkillsPanel(ctx, view);
    panel.render(view);
    const node = panel.root.querySelector<HTMLButtonElement>('.skill-node[data-id="s1"]')!;
    node.click();
    expect(ctx.selection.firmwareSelected).toBe('s1');
    expect(activate).not.toHaveBeenCalled();
    panel.root.querySelector<HTMLButtonElement>('.firmware-install')!.click();
    expect(activate).toHaveBeenCalledExactlyOnceWith('s1');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps direct activation when the shared tree has no selection callback', () => {
    const game = pointGame();
    const activate = vi.fn();
    const ctx = widgetContext(game, activate, vi.fn());
    const lanes = buildViewModel(game).skills.lanes;
    const tree = mountSkillTree(ctx, lanes, {});
    tree.render(lanes);
    tree.element.querySelector<HTMLButtonElement>('[data-id="s1"]')!.click();
    expect(activate).toHaveBeenCalledExactlyOnceWith('s1');
  });

  it('previews on hover then restores the pinned inspector after leaving the tree', () => {
    const game = pointGame();
    const ctx = widgetContext(game, vi.fn(), vi.fn());
    const view = buildViewModel(game).skills;
    const panel = mountSkillsPanel(ctx, view);
    panel.render(view);
    panel.root.querySelector<HTMLButtonElement>('[data-id="s1"]')!.click();
    panel.root.querySelector<HTMLElement>('[data-id="s2"]')!.dispatchEvent(new Event('mouseenter'));
    expect(panel.root.querySelector('.inspector-name')!.textContent).toBe('Skill s2');
    expect(ctx.selection.firmwareSelected).toBe('s1');
    panel.root.querySelector('.skill-tree')!.dispatchEvent(new Event('mouseleave'));
    expect(panel.root.querySelector('.inspector-name')!.textContent).toBe('Skill s1');
  });

  it('highlights ancestor edges and readable children only while hovering', () => {
    const game = pointGame();
    const ctx = widgetContext(game, vi.fn(), vi.fn());
    const original = buildViewModel(game).skills.lanes[0]!;
    const [root, middle, leaf] = original.nodes;
    const lane: SkillLaneView = {
      ...original,
      cols: 3,
      nodes: [
        root!,
        { ...middle!, col: 1, parents: [root!.view.id] },
        { ...leaf!, col: 2, parents: [middle!.view.id] },
        { ...leaf!, col: 2, row: 1, masked: true, state: 'encrypted', parents: [middle!.view.id], view: { ...leaf!.view, id: 'hidden' } },
      ],
    };
    const tree = mountSkillTree(ctx, [lane], {});
    tree.render([lane]);
    tree.element.querySelector<HTMLElement>('[data-id="s2"]')!.dispatchEvent(new Event('mouseenter'));
    expect([...tree.element.querySelectorAll<HTMLElement>('.skill-node.onpath')].map((node) => node.dataset['id'])).toEqual(['s1', 's2']);
    expect(tree.element.querySelectorAll('.lane-edge.onpath')).toHaveLength(1);
    expect([...tree.element.querySelectorAll<HTMLElement>('.skill-node.next')].map((node) => node.dataset['id'])).toEqual(['bc']);
    tree.element.querySelector<HTMLElement>('[data-id="hidden"]')!.dispatchEvent(new Event('mouseenter'));
    expect(tree.element.querySelector('.onpath, .next')).toBeNull();
    tree.element.dispatchEvent(new Event('mouseleave'));
    expect(tree.element.querySelector('.onpath, .next')).toBeNull();
  });
});

describe('shared installation animation', () => {
  it('does not animate the first render or stable ownership, and cleans node and outgoing edge classes on animationend', () => {
    const game = pointGame();
    const ctx = widgetContext(game, vi.fn(), vi.fn());
    const original = buildViewModel(game).skills.lanes[0]!;
    const root = original.nodes[0]!;
    const child = original.nodes[1]!;
    const lane: SkillLaneView = {
      ...original,
      cols: 2,
      nodes: [root, { ...child, col: 1, parents: [root.view.id] }],
    };
    const installed: SkillLaneView = {
      ...lane,
      nodes: lane.nodes.map((node) => (node === root ? { ...node, state: 'installed', view: { ...node.view, owned: 1 } } : node)),
    };
    const first = mountSkillTree(ctx, [installed], {});
    first.render([installed]);
    expect(first.element.querySelector('.install')).toBeNull();
    first.render([installed]);
    expect(first.element.querySelector('.install')).toBeNull();

    const tree = mountSkillTree(ctx, [lane], {});
    tree.render([lane]);
    tree.render([installed]);
    const node = tree.element.querySelector<HTMLElement>('.install')!;
    const edge = tree.element.querySelector<SVGElement>('.flow')!;
    expect(node.dataset['id']).toBe(root.view.id);
    expect(edge).not.toBeNull();
    node.dispatchEvent(new Event('animationend'));
    edge.dispatchEvent(new Event('animationend'));
    expect(tree.element.querySelector('.install, .flow')).toBeNull();
    tree.render([installed]);
    expect(tree.element.querySelector('.install, .flow')).toBeNull();
  });
});

describe('Firmware reveal and unchanged renders', () => {
  it('hides the trunk label until the trunk firmware is readable', () => {
    const game = createGame({ config: joinedTreeConfig(1) });
    const ctx = widgetContext(game, vi.fn(), vi.fn());
    const masked = buildViewModel(game).skills.resleeve.lanes;
    const tree = mountSkillTree(ctx, masked, { mode: 'joined', onSelect: vi.fn() });
    tree.render(masked);
    const label = tree.element.querySelector<HTMLElement>('.trunk-label')!;
    expect(label.hidden).toBe(true);
    expect(label.textContent).toBe('');
    game.resleeve();
    tree.render(buildViewModel(game).skills.resleeve.lanes);
    expect(label.hidden).toBe(false);
    expect(label.textContent).toBe(ctx.text.firmware.sleeveUp);
  });

  it('writes no DOM on an unchanged frame with nonempty firmware lanes and an inspector', () => {
    const game = pointGame();
    const ctx = widgetContext(game, vi.fn(), vi.fn());
    const panel = mountSkillsPanel(ctx, buildViewModel(game).skills);
    panel.render(buildViewModel(game).skills);
    expect(panel.root.querySelectorAll('.skill-node')).toHaveLength(3);
    panel.root.querySelector<HTMLElement>('[data-id="s1"]')!.dispatchEvent(new Event('mouseenter'));
    const observer = new MutationObserver(() => {});
    observer.observe(panel.root, { attributes: true, childList: true, characterData: true, subtree: true });
    panel.render(buildViewModel(game).skills);
    const changes = observer.takeRecords().map((record) => ({
      type: record.type,
      attribute: record.attributeName,
      target: (record.target as HTMLElement).className,
    }));
    observer.disconnect();
    expect(changes).toEqual([]);
  });
});
