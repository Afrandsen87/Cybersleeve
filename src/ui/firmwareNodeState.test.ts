/** @module ui
 * State precedence contract. Called by: Vitest. Calls: nodeState and shared skillViews kit.
 */
import { describe, expect, it } from 'vitest';
import { skillNode } from '../testing/skillViews';
import { nodeState } from './view/firmwareNodeState';

describe('firmware node state', () => {
  it('uses the available fallback', () => expect(nodeState(skillNode('a'))).toBe('available'));
  it('marks an affordable readable node', () => expect(nodeState(skillNode('a', {}, { affordable: true }))).toBe('affordable'));
  it('lets a lock win over affordability', () => expect(nodeState(skillNode('a', { locked: true }, { affordable: true }))).toBe('locked'));
  it('lets encryption win over lock and affordability', () => {
    expect(nodeState(skillNode('a', { masked: true, locked: true }, { affordable: true }))).toBe('encrypted');
  });
  it('lets ownership win over every other flag', () => {
    expect(nodeState(skillNode('a', { masked: true, locked: true }, { affordable: true, owned: 1 }))).toBe('installed');
  });
});
