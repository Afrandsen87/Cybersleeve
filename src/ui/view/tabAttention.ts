/**
 * @module ui
 *
 * Which tabs blink: a tab blinks while it has earned more points than the player has looked at.
 *
 * @remarks
 * Pure, held by the UI (not saved, not game state). Per tab it keeps how many points were earned when the tab was last open ("seen"). A tab blinks
 * while earned > seen. Opening the tab sets seen = earned. When earned drops (a re-sleeve resets the skill points) seen follows it down, so the
 * next point blinks again. The first time a tab is met (after a reload) seen is earned minus the points still unspent, so the tab blinks only if it
 * has unspent points.
 *
 * Called by: `ui/viewModel.ts` (through `tabsView`), `ui/dom.ts` (owns the instance). Calls: nothing.
 */

/** The per-tab "points earned that the player has seen" memory. */
export class TabAttention {
  private readonly seen = new Map<string, number>();

  /**
   * Updates the tab's memory and says whether it blinks.
   *
   * Called by: `tabsView`. Calls: nothing.
   *
   * @param id the tab
   * @param earned points earned in total that count for this tab (Skills: skill plus sleeve skill points; Automation: automation points)
   * @param unspent points still to spend (decides the starting point after a reload)
   * @param open whether the player is looking at this tab now
   * @returns `true` while earned is above what was seen
   */
  blinks(id: string, earned: number, unspent: number, open: boolean): boolean {
    const known = this.seen.get(id) ?? Math.max(0, earned - unspent);
    const seen = open ? earned : Math.min(known, earned);
    this.seen.set(id, seen);
    return earned > seen;
  }
}
