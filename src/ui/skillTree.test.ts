import { describe, expect, it } from 'vitest';
import type { BuyableDefinition } from '../core';
import { num } from '../numbers';
import { GENERAL_LANE, type SkillTreeInput, buildSkillLanes } from './view/skillTree';
import type { BuyableView } from './view/viewTypes';

const def = (id: string, extra: Partial<BuyableDefinition> = {}): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  currency: 'skillPoints',
  cost: num(1),
  effect: { kind: 'placeholder' },
  ...extra,
});

/** Counts how often a tip was built, to show that a tip is never built just by laying the tree out. */
const tipReads = { count: 0 };

/** A fake view of a buyable: only what the tree reads, and a tip that counts its reads. */
const fakeView = (id: string, owned: boolean): BuyableView =>
  ({
    id,
    name: `Name ${id}`,
    description: `Does ${id}`,
    symbol: id.toUpperCase(),
    costText: '1',
    owned: owned ? 1 : 0,
    clickable: true,
    ready: true,
    available: false,
    get tip() {
      tipReads.count += 1;
      return `tip ${id}`;
    },
  }) as unknown as BuyableView;

/** Lays the skills out with the given ones owned; every other input has a sensible default. */
const lanes = (skills: BuyableDefinition[], owned: string[] = [], extra: Partial<SkillTreeInput> = {}) =>
  buildSkillLanes({
    skills,
    viewById: new Map(skills.map((b) => [b.id, fakeView(b.id, owned.includes(b.id))])),
    owned: (id) => (owned.includes(id) ? 1 : 0),
    laneTitle: (id) => `Lane ${id}`,
    hiddenText: '???',
    open: true,
    revealAll: false,
    ...extra,
  });

const place = (skills: BuyableDefinition[]) => lanes(skills).flatMap((l) => l.nodes.map((n) => [n.view.id, n.col, n.row]));

describe('skill tree layout: where a skill sits', () => {
  it('a root is in column 0, row 0; a chain grows to the right on one row', () => {
    expect(place([def('a'), def('b', { parents: ['a'] }), def('c', { parents: ['b'] })])).toEqual([
      ['a', 0, 0],
      ['b', 1, 0],
      ['c', 2, 0],
    ]);
  });

  it('children of one parent share a column and go below one another; a child of the lower one stays on its row', () => {
    expect(place([def('a'), def('b', { parents: ['a'] }), def('c', { parents: ['a'] }), def('d', { parents: ['c'] })])).toEqual([
      ['a', 0, 0],
      ['b', 1, 0],
      ['c', 1, 1],
      ['d', 2, 1],
    ]);
  });

  it('a skill with two parents sits one column right of the deeper one, on the higher parent row', () => {
    const skills = [def('a'), def('b', { parents: ['a'] }), def('c', { parents: ['a'] }), def('d', { parents: ['b', 'c'] })];
    expect(place(skills)).toEqual([
      ['a', 0, 0],
      ['b', 1, 0],
      ['c', 1, 1],
      ['d', 2, 0],
    ]);
  });

  it('two roots do not share a cell', () => {
    expect(place([def('a'), def('b')])).toEqual([
      ['a', 0, 0],
      ['b', 0, 1],
    ]);
  });

  it('the lane knows its size, and each node lists the parents that are drawn', () => {
    const [lane] = lanes([def('a'), def('b', { parents: ['a'] }), def('c', { parents: ['a'] })]);
    expect([lane!.cols, lane!.rows]).toEqual([2, 2]);
    expect(lane!.nodes.map((n) => n.parents)).toEqual([[], ['a'], ['a']]);
  });

  it('keeps configuration order inside a lane, whatever the depth', () => {
    const [lane] = lanes([def('child', { parents: ['root'] }), def('root')]);
    expect(lane!.nodes.map((n) => n.view.id)).toEqual(['child', 'root']);
    expect(lane!.nodes.map((n) => n.col)).toEqual([1, 0]);
  });

  it('a parent loop does not hang the layout (validation rejects it; this only keeps a bad config from freezing the screen)', () => {
    expect(() => place([def('x', { parents: ['y'] }), def('y', { parents: ['x'] })])).not.toThrow();
  });
});

describe('skill tree lanes', () => {
  it('one lane per branch in order of first appearance, with the skills without a branch in the general lane', () => {
    const result = lanes([def('a', { branch: 'red' }), def('b', { branch: 'blue' }), def('c', { branch: 'red' }), def('d')]);
    expect(result.map((l) => l.id)).toEqual(['red', 'blue', GENERAL_LANE]);
    expect(result.map((l) => l.nodes.map((n) => n.view.id))).toEqual([['a', 'c'], ['b'], ['d']]);
  });

  it('the title of a lane comes from the caller and is never masked, even when every skill in it is', () => {
    const [lane] = lanes([def('a', { branch: 'red', requires: ['gate'] })]);
    expect(lane!.title).toBe('Lane red');
    expect(lane!.nodes[0]!.masked).toBe(true);
  });

  it('a parent in another lane is not drawn as an edge, but still has to be readable', () => {
    const skills = [def('a', { branch: 'red' }), def('b', { branch: 'blue', parents: ['a'] })];
    const result = lanes(skills, ['a']);
    expect(result[1]!.nodes[0]!.parents).toEqual([]);
    expect(result[1]!.nodes[0]!.masked).toBe(false);
  });
});

describe('skill tree masking: the text of a skill is hidden until it is readable', () => {
  const node = (skills: BuyableDefinition[], id: string, owned: string[] = [], extra: Partial<SkillTreeInput> = {}) =>
    lanes(skills, owned, extra)
      .flatMap((l) => l.nodes)
      .find((n) => n.view.id === id)!;

  it('a skill with no gate and no parent is readable; one whose gate is not owned is masked, and reads when the gate is owned', () => {
    const skills = [def('a'), def('g', { requires: ['gate'] })];
    expect(node(skills, 'a').masked).toBe(false);
    expect(node(skills, 'g').masked).toBe(true);
    expect(node(skills, 'g', ['gate']).masked).toBe(false);
  });

  it('a masked skill reads as hidden everywhere and cannot be clicked', () => {
    const view = node([def('g', { requires: ['gate'] })], 'g').view;
    expect([view.name, view.description, view.costText, view.tip]).toEqual(['???', '???', '???', '???']);
    expect(view.symbol).toBe('?');
    expect(view.clickable).toBe(false);
    expect(view.ready).toBe(false);
    expect(view.id).toBe('g');
  });

  it('a readable skill keeps its own text', () => {
    const view = node([def('a')], 'a').view;
    expect([view.name, view.description, view.symbol]).toEqual(['Name a', 'Does a', 'A']);
  });

  it('a child inherits the masking of its parent, even when its own gate is met', () => {
    const skills = [def('root', { requires: ['gate'] }), def('kid', { parents: ['root'] })];
    expect(node(skills, 'kid').masked).toBe(true);
    expect(node(skills, 'kid', ['gate']).masked).toBe(false); // the parent reads now, so the child does
  });

  it('masking runs all the way down a chain', () => {
    const skills = [def('a', { requires: ['gate'] }), def('b', { parents: ['a'] }), def('c', { parents: ['b'] })];
    expect(lanes(skills).flatMap((l) => l.nodes.map((n) => n.masked))).toEqual([true, true, true]);
    expect(lanes(skills, ['gate']).flatMap((l) => l.nodes.map((n) => n.masked))).toEqual([false, false, false]);
  });

  it('a child needs its own gate as well as a readable parent', () => {
    const skills = [def('root'), def('kid', { parents: ['root'], requires: ['gate'] })];
    expect(node(skills, 'kid', ['root']).masked).toBe(true);
    expect(node(skills, 'kid', ['root', 'gate']).masked).toBe(false);
  });

  it('a readable skill whose parent is not owned shows its text, dimmed (locked); it is not locked once the parent is owned', () => {
    const skills = [def('root'), def('kid', { parents: ['root'] })];
    const before = node(skills, 'kid');
    expect([before.masked, before.locked, before.view.name]).toEqual([false, true, 'Name kid']);
    const after = node(skills, 'kid', ['root']);
    expect([after.masked, after.locked]).toEqual([false, false]);
  });

  it('a masked skill is not "locked": it is simply hidden', () => {
    expect(node([def('g', { requires: ['gate'] })], 'g').locked).toBe(false);
  });

  it('a tree that is not open (the re-sleeve skills before the first re-sleeve) is masked as a whole, gates or not', () => {
    const skills = [def('a'), def('b', { parents: ['a'] })];
    expect(lanes(skills, [], { open: false }).flatMap((l) => l.nodes.map((n) => n.masked))).toEqual([true, true]);
  });

  it('the "show all" test aid reads everything, whatever the gates and the tree being closed say', () => {
    const skills = [def('a', { requires: ['gate'] }), def('b', { parents: ['a'] })];
    const all = lanes(skills, [], { open: false, revealAll: true });
    expect(all.flatMap((l) => l.nodes.map((n) => n.masked))).toEqual([false, false]);
  });

  it('laying the tree out builds no tip, masked or not (a tip is built only when it is shown)', () => {
    tipReads.count = 0;
    lanes([def('a'), def('g', { requires: ['gate'] }), def('b', { parents: ['a'] })]);
    expect(tipReads.count).toBe(0);
  });
});
