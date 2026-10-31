/**
 * @module ui
 * Automation context: offline guidance follows the existing root node's masking.
 * Called by: automationView. Calls: injected text template.
 */
import type { UiText } from '../uiText';
import type { SkillLaneView } from './skillTreeTypes';

/** Formats guidance without leaking an encrypted root's name. Called by: automationView. Calls: offlineNote.
 * @param lanes already masked feature lanes
 * @param text injected interface words
 * @returns safe installation guidance
 */
export function daemonOfflineNote(lanes: readonly SkillLaneView[], text: UiText): string {
  const root = lanes.flatMap((lane) => lane.nodes).find((node) => node.parents.length === 0);
  return text.automation.offlineNote(root && !root.masked ? root.view.name : null);
}
