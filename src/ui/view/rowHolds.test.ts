/** @module ui
 * Automation row-height retention coverage. Called by: Vitest. Calls: rowHolds.
 */
import { describe, expect, it } from 'vitest';
import { rowHolds } from './rowHolds';

const order = ['a', 'b', 'c'];
const heights = new Map([
  ['a', 500],
  ['b', 600],
  ['c', 700],
]);

describe('row holds', () => {
  it('holds a row above the newly opened row', () => {
    expect(rowHolds(order, 'a', 'b', heights)).toEqual(new Map([['a', 500]]));
  });
  it('never holds rows below the open row and releases former lower holds', () => {
    expect(rowHolds(order, 'c', 'b', heights)).toEqual(new Map());
    expect(
      rowHolds(
        order,
        'c',
        'a',
        heights,
        new Map([
          ['a', 500],
          ['b', 600],
        ]),
      ),
    ).toEqual(new Map());
  });
  it('retains earlier upper holds and uses the greatest recorded height', () => {
    expect(
      rowHolds(
        order,
        'b',
        'c',
        heights,
        new Map([
          ['a', 500],
          ['b', 800],
        ]),
      ),
    ).toEqual(
      new Map([
        ['a', 500],
        ['b', 800],
      ]),
    );
  });
  it('releases all holds when the pane closes', () => {
    expect(
      rowHolds(
        order,
        'c',
        null,
        heights,
        new Map([
          ['a', 500],
          ['b', 600],
        ]),
      ),
    ).toEqual(new Map());
  });
  it('does not hold the open row itself or invalid measured heights', () => {
    expect(rowHolds(order, 'b', 'b', heights)).toEqual(new Map());
    expect(rowHolds(order, 'a', 'b', new Map([['a', Number.NaN]]))).toEqual(new Map());
  });
});
