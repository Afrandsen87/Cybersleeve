/** @module ui
 * Safe relationships for UI paths. Called by: Vitest. Calls: skillTreePaths and shared skillViews kit.
 */
import { describe, expect, it } from 'vitest';
import { skillNode } from '../testing/skillViews';
import { childrenOf, pathToRoot } from './view/skillTreePaths';

describe('firmware paths', () => {
  const nodes = [
    skillNode('root'),
    skillNode('a', { parents: ['root'] }),
    skillNode('b', { parents: ['root'] }),
    skillNode('c', { parents: ['a', 'b'] }),
  ];
  it('includes a root itself', () => expect(pathToRoot(nodes, 'root')).toEqual(['root']));
  it('traverses a chain', () => expect(pathToRoot(nodes, 'a')).toEqual(['a', 'root']));
  it('traverses every parent without duplicate ancestors', () =>
    expect(new Set(pathToRoot(nodes, 'c'))).toEqual(new Set(['c', 'a', 'b', 'root'])));
  it('returns no path for an unknown id', () => expect(pathToRoot(nodes, 'missing')).toEqual([]));
  it('finishes when parents form a loop', () => {
    expect(pathToRoot([skillNode('a', { parents: ['b'] }), skillNode('b', { parents: ['a'] })], 'a')).toEqual(['a', 'b']);
  });
  it('lists direct children in configuration order', () => {
    expect(childrenOf(nodes, 'root').map((node) => node.view.id)).toEqual(['a', 'b']);
    expect(childrenOf(nodes, 'missing')).toEqual([]);
    expect(childrenOf(nodes, 'c')).toEqual([]);
  });
});
