import { describe, expect, it } from 'vitest';
import { numberFactory } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { deserializeState, serializeState } from './index';
import { focusStackConfig, focusStackGame as gameWith } from './resleeveSkillsKit';

describe('Overdrive Cap (focus stacking)', () => {
  it('without the skill a second slot cannot go on the same action, and the other action takes it', () => {
    const g = gameWith(1, false);
    expect(g.addFocus('a')).toBe(true);
    expect(g.addFocus('a'), 'a second slot on the same action').toBe(false);
    expect(g.addFocus('b')).toBe(true);
    expect(g.focusStatus('a')).toMatchObject({ count: 1, stacking: false, used: 2, slots: 2 });
  });

  it('with the skill every slot can sit on one action, and each multiplies its speed by 1.25 again', () => {
    const g = gameWith(2, true);
    const plain = g.currentSpeed('a');
    const plainB = g.currentSpeed('b');
    for (let i = 0; i < 3; i++) expect(g.addFocus('a')).toBe(true);
    expect(g.addFocus('a'), 'no slot is left').toBe(false);
    expect(g.addFocus('b'), 'no slot is left for the other action either').toBe(false);
    expect(g.focusStatus('a')).toMatchObject({ count: 3, used: 3, slots: 3, canAdd: false, canRemove: true });
    expect(g.currentSpeed('a')).toBeCloseTo(plain * 1.25 ** 3, 9);
    expect(g.currentSpeed('b'), 'the other action is untouched').toBeCloseTo(plainB, 9);
  });

  it('removes stacked slots one at a time and frees them for the other action', () => {
    const g = gameWith(2, true);
    for (let i = 0; i < 3; i++) g.addFocus('a');
    expect(g.removeFocus('a')).toBe(true);
    expect(g.focusStatus('a')).toMatchObject({ count: 2, used: 2 });
    expect(g.addFocus('b')).toBe(true);
    expect(g.focusStatus('b')).toMatchObject({ count: 1, used: 3 });
    expect(g.removeFocus('a')).toBe(true);
    expect(g.removeFocus('a')).toBe(true);
    expect(g.removeFocus('a'), 'nothing left on it').toBe(false);
    expect(g.focusStatus('a')).toMatchObject({ count: 0, on: false });
  });

  it('switching the plain toggle off takes every slot off the action', () => {
    const g = gameWith(2, true);
    for (let i = 0; i < 3; i++) g.addFocus('a');
    expect(g.toggleFocus('a')).toBe(false);
    expect(g.focusStatus('a')).toMatchObject({ count: 0, used: 0 });
    expect(g.getState().focusStacks['a']).toBeUndefined();
  });

  it('is saved and loaded, cut to the slots owned, and ignored when the skill is missing from the save', () => {
    const g = gameWith(2, true);
    for (let i = 0; i < 3; i++) g.addFocus('a');
    const text = serializeState(g.getState());
    const loaded = deserializeState(text, focusStackConfig, numberFactory)!;
    expect(loaded.focusStacks['a']).toBe(2);
    expect(findInvariantViolations(loaded, focusStackConfig)).toEqual([]);

    const edited = JSON.parse(text) as { purchased: Record<string, number>; focusStacks: Record<string, number> };
    edited.focusStacks['a'] = 99;
    const cut = deserializeState(JSON.stringify(edited), focusStackConfig, numberFactory)!;
    expect(cut.focusStacks['a']).toBe(2);

    delete edited.purchased['stack'];
    const without = deserializeState(JSON.stringify(edited), focusStackConfig, numberFactory)!;
    expect(without.focusStacks['a']).toBeUndefined();
    expect(without.focused['a']).toBe(true);
  });

  it('resets with a re-sleeve (the slots are not carried over)', () => {
    const g = gameWith(2, true);
    for (let i = 0; i < 3; i++) g.addFocus('a');
    g.resleeve();
    expect(g.getState().focusStacks).toEqual({});
  });
});
