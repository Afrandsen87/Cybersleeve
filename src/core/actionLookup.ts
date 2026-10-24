/**
 * @module core
 *
 * Lookup of action definitions by id.
 */
import type { ActionDefinition, ActionId } from './types';

/** Finds an action definition by id; throws for an unknown id. */
export type ActionLookup = (id: ActionId) => ActionDefinition;

/**
 * Builds an {@link ActionLookup}.
 *
 * Called by: `engine.ts`. Used by: `stats.ts`, `actionRunner.ts`.
 *
 * @param actions all action definitions
 * @returns a function that returns the definition of an id
 * @throws Error (from the returned function) if the id is unknown
 */
export function createActionLookup(actions: readonly ActionDefinition[]): ActionLookup {
  const byId = new Map<ActionId, ActionDefinition>(actions.map((a) => [a.id, a]));
  return (id) => {
    const def = byId.get(id);
    if (!def) throw new Error(`Unknown action: ${id}`);
    return def;
  };
}
