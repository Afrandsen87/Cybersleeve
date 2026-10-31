/** @module ui
 * Inspector presentation and reveal contracts. Called by: Vitest. Calls: inspector and shared skillViews kit.
 */
import { describe, expect, it } from 'vitest';
import { skillLane, skillNode } from '../testing/skillViews';
import { firmwareText } from './firmwareText';
import { buildInspectorView, defaultSelection, type InspectorInput } from './view/firmwareInspector';
import type { SkillNodeView } from './view/skillTreeTypes';

/** Builds an inspector from a selected node and related nodes. Called by: inspector tests. Calls: buildInspectorView. */
function inspect(node: SkillNodeView, others: readonly SkillNodeView[] = [], sleeve = false) {
  const lanes = [skillLane([...others, node])];
  const input: InspectorInput = {
    selectedId: node.view.id,
    lanes: sleeve ? [] : lanes,
    sleeveLanes: sleeve ? lanes : [],
    pointsText: '2',
    sleevePointsText: '3',
    text: firmwareText,
  };
  return buildInspectorView(input)!;
}

describe('firmware inspector', () => {
  it('shows an installed node without a why-not line', () => {
    const view = inspect(skillNode('a', {}, { owned: 1 }));
    expect(view).toMatchObject({
      name: 'Name a',
      description: 'Does a',
      state: 'installed',
      status: 'Installed',
      whyNot: null,
      canInstall: false,
    });
  });
  it('uses the existing cost, currency and buyability', () => {
    expect(inspect(skillNode('a', {}, { affordable: true, clickable: true, costText: '9', costUnit: 'custom points' }))).toMatchObject({
      state: 'affordable',
      canInstall: true,
      costText: '9 custom points',
      whyNot: 'You have 2',
    });
    expect(inspect(skillNode('a', {}, { affordable: true, clickable: false })).canInstall).toBe(false);
  });
  it('explains both unaffordable point pools', () => {
    expect(inspect(skillNode('a')).whyNot).toBe('You have 2: earn more firmware points');
    expect(inspect(skillNode('a'), [], true)).toMatchObject({ persistent: true, whyNot: 'You have 3: earn more sleeve firmware points' });
  });
  it('shows the first unowned parent as the locked explanation', () => {
    const node = skillNode('a', { locked: true, parents: ['owned', 'missing', 'later'] });
    expect(inspect(node, [skillNode('owned', {}, { owned: 1 }), skillNode('missing'), skillNode('later')]).whyNot).toBe(
      'Install Name missing first',
    );
  });
  it('lists all parents and immediate children with installed flags and encrypted child names masked', () => {
    const node = skillNode('a', { parents: ['parent1', 'parent2'] });
    const view = inspect(node, [
      skillNode('parent1', {}, { owned: 1 }),
      skillNode('parent2'),
      skillNode('child', { parents: ['a'] }),
      skillNode('secret', { parents: ['a'], masked: true }),
    ]);
    expect(view.requires).toEqual([
      { id: 'parent1', name: 'Name parent1', installed: true },
      { id: 'parent2', name: 'Name parent2', installed: false },
    ]);
    expect(view.unlocksNext).toEqual([
      { id: 'child', name: 'Name child', installed: false },
      { id: 'secret', name: '???', installed: false },
    ]);
  });
  it('never leaks encrypted name, description, icon, cost or relationship names', () => {
    const node = skillNode('a', { masked: true, parents: ['parent'] });
    const view = inspect(node, [skillNode('parent'), skillNode('child', { parents: ['a'] })]);
    expect(view).toMatchObject({
      state: 'encrypted',
      name: '???',
      description: '???',
      iconId: null,
      costText: null,
      requires: [],
      unlocksNext: [],
      canInstall: false,
      whyNot: 'Unlocks as you play further',
    });
    expect(JSON.stringify(view)).not.toContain('Name ');
    expect(JSON.stringify(view)).not.toContain('Does ');
  });
  it('returns no inspector for empty trees or stale ids', () => {
    const input = { selectedId: null, lanes: [], sleeveLanes: [], pointsText: '0', sleevePointsText: '0', text: firmwareText };
    expect(buildInspectorView(input)).toBeNull();
    expect(buildInspectorView({ ...input, selectedId: 'gone', lanes: [skillLane([skillNode('a')])] })).toBeNull();
  });
});

describe('default firmware selection', () => {
  it('selects the first affordable node before a branch root', () => {
    expect(
      defaultSelection([
        skillLane([skillNode('root'), skillNode('buy', {}, { affordable: true }), skillNode('also', {}, { affordable: true })]),
      ]),
    ).toBe('buy');
  });
  it('selects the first branch root and handles empty trees', () => {
    expect(
      defaultSelection([skillLane([skillNode('child', { parents: ['root'] }), skillNode('root')]), skillLane([skillNode('other')])]),
    ).toBe('root');
    expect(defaultSelection([])).toBeNull();
    expect(defaultSelection([skillLane([])])).toBeNull();
  });
  it('uses the default when no node is pinned', () => {
    expect(
      buildInspectorView({
        selectedId: null,
        lanes: [skillLane([skillNode('a')])],
        sleeveLanes: [],
        pointsText: '0',
        sleevePointsText: '0',
        text: firmwareText,
      })?.id,
    ).toBe('a');
  });
});
