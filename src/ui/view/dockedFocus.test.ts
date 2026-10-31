/** @module ui
 * Automation focus transition coverage. Called by: Vitest. Calls: pure focus transitions.
 */
import { describe, expect, it } from 'vitest';
import { emptyDockedFocus, transitionDockedFocus as step } from './dockedFocus';

const first = { id: 'first', lane: 'a' };
const second = { id: 'second', lane: 'a' };
const other = { id: 'other', lane: 'b' };

describe('docked focus', () => {
  it('opens previews without pinning and retains them in their row and pane', () => {
    const entered = step(emptyDockedFocus(), { type: 'enterNode', node: first });
    expect(entered).toMatchObject({ focusedId: first.id, openLane: 'a', mode: 'preview', pinned: null });
    for (const to of ['row', 'pane'] as const) {
      expect(step(entered, { type: 'leaveNode', lane: 'a', to })).toEqual(entered);
    }
    expect(step(entered, { type: 'leaveRow', lane: 'a' }).openLane).toBeNull();
  });

  it('pins on click and clicking the pinned node closes the pane', () => {
    const pinned = step(emptyDockedFocus(), { type: 'clickNode', node: first });
    expect(pinned).toMatchObject({ pinned: first, focusedId: first.id, mode: 'pinned' });
    expect(step(pinned, { type: 'clickNode', node: first })).toEqual(emptyDockedFocus());
  });

  it('returns immediately to the pin when leaving any node in its lane', () => {
    const pinned = step(emptyDockedFocus(), { type: 'clickNode', node: first });
    for (const node of [first, second]) {
      for (const to of ['row', 'pane', 'outside'] as const) {
        const preview = step(pinned, { type: 'enterNode', node });
        expect(step(preview, { type: 'leaveNode', lane: 'a', to })).toEqual(pinned);
      }
    }
  });

  it('keeps another lane preview until that row is left, then returns to the pin', () => {
    const pinned = step(emptyDockedFocus(), { type: 'clickNode', node: first });
    const preview = step(pinned, { type: 'enterNode', node: other });
    expect(preview).toMatchObject({ focusedId: other.id, openLane: 'b', mode: 'preview' });
    for (const to of ['row', 'pane'] as const) {
      expect(step(preview, { type: 'leaveNode', lane: 'b', to })).toEqual(preview);
    }
    expect(step(preview, { type: 'leaveRow', lane: 'a' })).toEqual(preview);
    expect(step(preview, { type: 'leaveRow', lane: 'b' })).toEqual(pinned);
    expect(step(preview, { type: 'leaveNode', lane: 'b', to: 'outside' })).toEqual(pinned);
  });

  it('close and Escape clear pins and previews; hide drops only previews', () => {
    const pinned = step(emptyDockedFocus(), { type: 'clickNode', node: first });
    const preview = step(pinned, { type: 'enterNode', node: other });
    for (const type of ['close', 'escape'] as const) expect(step(preview, { type })).toEqual(emptyDockedFocus());
    expect(step(preview, { type: 'hide' })).toEqual(pinned);
    expect(step(step(emptyDockedFocus(), { type: 'enterNode', node: other }), { type: 'hide' })).toEqual(emptyDockedFocus());
  });

  it('clicking another preview replaces the pin and entering another row drops a stale preview', () => {
    const preview = step(step(emptyDockedFocus(), { type: 'clickNode', node: first }), { type: 'enterNode', node: other });
    expect(step(preview, { type: 'clickNode', node: other })).toMatchObject({ pinned: other, mode: 'pinned' });
  });
});
