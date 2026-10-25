/**
 * @module content
 *
 * The changelog shown in the Changelog modal. Data only: the UI renders whatever is listed here.
 */

/** One released version and what changed in it. */
export interface ChangelogEntry {
  /** The version or date label shown as the heading. */
  readonly version: string;
  /** The changes, one line each. */
  readonly changes: readonly string[];
}

/**
 * The changelog, newest entry first.
 *
 * Called by: `main.ts` (passed to `mountUi`).
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '2026-10-25 21:33',
    changes: [
      'Kill servers: five new purchases. Cascade failure (more ICE Rating per run), Credit Siphon (credits for every node destroyed), Decommission protocol (runs take a smaller share of your nodes as the action levels up), Kill chain (consecutive overclocked runs build a chain that pays more and costs more) and Black box recorder.',
      'Kill servers can now be overclocked: double ICE Rating per run, but heat stops cooling while it runs.',
      'New items: Zero-day (drops from Push malware; click it in the Inventory to make Push malware runs critical successes), Admin key (drops from Kill servers; does the same for Practice Hacking) and Skill shard (a rare find that delays the XP scaling of a random action).',
      'Push malware: Persistence triples what its critical successes do, Ransomware banks a critical success for Grow network on every critical run, and the new skill Obfuscation lowers its Overclock heat.',
      'Overclock and Focus are now unlocked per action; every action has its own Overclock effect, and Focus slots limit how many actions can be focused at once.',
      'Every action card now has a square with Auto-run, Overclock, Focus and Augment.',
      'Practice Hacking speed now flattens out once Hacking Proficiency passes 1.',
      'Burn leads (from Grow network) and Augment schematics are in the Inventory, which is now a grid of icon tiles.',
      'Pixel-art icons for actions, items and credits.',
      'Heat can now be a fraction of a point; it cools in whole points.',
      'Critical success is a new sleeve purchase: runs can pay 3x and give 2x action XP.',
      'Amounts are now capped at 1e308 (infinity).',
      'Saves: the last good save is kept as a backup, and you can export and import your save as text.',
      'Only one browser tab can play at a time, so two tabs cannot overwrite each other.',
      'Smoother, cheaper rendering.',
      'Added this changelog.',
    ],
  },
];
