/** @module ui
 * Reveal-safe branch summaries. Called by: Vitest. Calls: branchSummary and shared skillViews kit.
 */
import { describe, expect, it } from 'vitest';
import { skillLane, skillNode } from '../testing/skillViews';
import { firmwareText } from './firmwareText';
import { branchSummary } from './view/firmwareBranches';

describe('firmware branch headers', () => {
  it('counts installed nodes and every public place, including encrypted nodes', () => {
    expect(branchSummary(skillLane([skillNode('a', {}, { owned: 2 }), skillNode('b', { masked: true })]), firmwareText)).toEqual({
      installed: 1,
      total: 2,
      purpose: firmwareText.branchPurpose['cybernetics'],
    });
  });
  it('hides the purpose of a wholly encrypted branch', () => {
    expect(branchSummary(skillLane([skillNode('a', { masked: true })], 'anonymity'), firmwareText).purpose).toBeNull();
  });
  it('omits absent purposes and handles empty branches', () => {
    expect(branchSummary(skillLane([skillNode('a')], 'other'), firmwareText).purpose).toBeNull();
    expect(branchSummary(skillLane([]), firmwareText)).toEqual({ installed: 0, total: 0, purpose: null });
  });
});
