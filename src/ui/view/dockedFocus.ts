/**
 * @module ui
 * Automation context: pure pin and hover transitions for the docked inspector.
 * Called by: automation inspector events and tests. Calls: nothing.
 */

/** A node's stable identity and daemon row. Called by: docked focus callers. Calls: nothing. */
export interface DockedNode {
  readonly id: string;
  readonly lane: string;
}

/** UI-only inspector focus, including its projected output. Called by: automation widget. Calls: nothing. */
export interface DockedFocus {
  readonly pinned: DockedNode | null;
  readonly hovered: DockedNode | null;
  readonly focusedId: string | null;
  readonly lane: string | null;
  readonly openLane: string | null;
  readonly mode: 'pinned' | 'preview' | null;
}

/** Pointer and keyboard inputs without DOM dependencies. Called by: transitionDockedFocus. Calls: nothing. */
export type DockedFocusEvent =
  | { readonly type: 'enterNode' | 'clickNode'; readonly node: DockedNode }
  | { readonly type: 'overRow' | 'leaveRow'; readonly lane: string }
  | { readonly type: 'leaveNode'; readonly lane: string; readonly to: 'row' | 'pane' | 'outside' }
  | { readonly type: 'overPane' | 'close' | 'escape' | 'hide' };

/** Projects immutable memory into the visible pane. Called by: focus transitions. Calls: nothing.
 * @param pinned retained selection
 * @param hovered transient preview
 * @returns complete focus output
 */
function project(pinned: DockedNode | null, hovered: DockedNode | null): DockedFocus {
  const focused = hovered ?? pinned;
  return {
    pinned,
    hovered,
    focusedId: focused?.id ?? null,
    lane: focused?.lane ?? null,
    openLane: focused?.lane ?? null,
    mode: focused ? (pinned?.id === focused.id ? 'pinned' : 'preview') : null,
  };
}

/** Starts with no open pane. Called by: automation mount and tests. Calls: project.
 * @returns empty UI memory
 */
export function emptyDockedFocus(): DockedFocus {
  return project(null, null);
}

/** Applies one pointer/selection event without mutation or game commands.
 * Called by: automation events and tests. Calls: project.
 * @param state previous UI memory
 * @param event pointer or keyboard intent
 * @returns projected selection and open daemon row
 */
export function transitionDockedFocus(state: DockedFocus, event: DockedFocusEvent): DockedFocus {
  switch (event.type) {
    case 'enterNode':
      return project(state.pinned, event.node);
    case 'clickNode':
      return state.pinned?.id === event.node.id ? project(null, null) : project(event.node, null);
    case 'leaveNode':
      if (state.pinned?.lane === event.lane || event.to === 'outside') return project(state.pinned, null);
      return state;
    case 'leaveRow':
      return state.openLane === event.lane ? project(state.pinned, null) : state;
    case 'overRow':
      return state.openLane === event.lane ? state : project(state.pinned, null);
    case 'overPane':
      return state;
    case 'hide':
      return project(state.pinned, null);
    case 'close':
    case 'escape':
      return project(null, null);
  }
}
