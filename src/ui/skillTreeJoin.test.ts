// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { mountTestUi, openTab } from '../testing/domMountKit';
import { joinedTreeConfig } from '../testing/joinedSkillTreeKit';
import { joinSkillLanes } from './view/skillTreeJoin';
import { buildViewModel } from './viewModel';

describe('joined sleeve tree', () => {
  it('stacks unequal-height bands and extends them to the widest path', () => {
    const game = createGame({ config: joinedTreeConfig(2) });
    const lanes = buildViewModel(game).skills.resleeve.lanes;
    const wide = { ...lanes[1]!, rows: 3, cols: 5 };
    const joined = joinSkillLanes([lanes[0]!, wide, lanes[2]!])!;
    expect([joined.rows, joined.cols, joined.trunk.row]).toEqual([4, 6, 1.5]);
    expect(joined.bands.map((band) => [band.firstRow, band.rows, band.cols])).toEqual([
      [0, 3, 6],
      [3, 1, 6],
    ]);
    expect(joined.bands[1]!.nodes[0]!.row).toBe(3);
  });
  it.each([1, 2, 3, 4])('centres the trunk across %i contiguous one-row bands', (count) => {
    const game = createGame({ config: joinedTreeConfig(count) });
    const lanes = buildViewModel(game).skills.resleeve.lanes;
    const joined = joinSkillLanes(lanes)!;
    expect([joined.trunk.col, joined.trunk.row]).toEqual([0, (count - 1) / 2]);
    expect(joined.rows).toBe(count);
    expect(joined.cols).toBe(2);
    expect(joined.bands.map((band) => [band.firstRow, band.rows, band.cols])).toEqual(
      Array.from({ length: count }, (_, row) => [row, 1, 2]),
    );
    expect(joined.bands.flatMap((band) => band.nodes.map((node) => [node.col, node.row, node.parents]))).toEqual(
      Array.from({ length: count }, (_, row) => [1, row, ['joined0']]),
    );
    expect(lanes[0]!.nodes[0]!.row).toBe(0);
  });

  it('builds one SVG with every cross-lane edge and lights them without rebuilding', () => {
    const game = createGame({ config: joinedTreeConfig(4) });
    game.resleeve();
    const root = document.createElement('div');
    const render = mountTestUi(root, game);
    openTab(root, 'skills');
    const tree = root.querySelector('.resleeve-skills .skill-tree')!;
    const svg = tree.querySelector('svg')!;
    expect(tree.querySelectorAll('svg')).toHaveLength(1);
    expect(svg.querySelectorAll('path')).toHaveLength(4);
    expect(svg.querySelectorAll('.lit')).toHaveLength(0);
    expect(tree.querySelector('.trunk-lane .lane-title')).toBeNull();
    expect(tree.querySelectorAll('.lane-title')).toHaveLength(4);
    const nodes = [...tree.querySelectorAll('.skill-node')];
    game.buy('joined0');
    render();
    expect(tree.querySelector('svg')).toBe(svg);
    expect([...tree.querySelectorAll('.skill-node')]).toEqual(nodes);
    expect(svg.querySelectorAll('.lit')).toHaveLength(4);
    expect([...svg.querySelectorAll('path')].map((path) => path.style.getPropertyValue('--lane'))).toEqual(
      [1, 2, 3, 4].map((index) => `var(--branch-path${index})`),
    );
  });
});
