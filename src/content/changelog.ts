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
    version: '2026-10-26 23:33',
    changes: [
      'Grow network Auto-run now costs 10 credits; the Overclock and Focus of every action cost 25 and 100 times the Auto-run price of that same action.',
      'Kompromat sells for more (100 credits for a common file, two orders of magnitude more per rarity), and its tip just says the payment is flat.',
      'Purchases now appear once their price is within 3 orders of magnitude of the most credits (or nodes) you have held.',
      'The tabs sit on the credits line, stay hidden until the first skill or automation point, and a tab blinks while a point is waiting in it.',
      'New Automation tab. The sleeve buyable Automation core gives automation points; each point unlocks one feature: Auto Burn (uses Burn leads to keep heat under a ceiling you set), Kompromat autosale (a switch per rarity) or Augment dispersal (a share of the schematics per action).',
      'Items you have not unlocked are hidden from the Inventory.',
      'The heat tax now takes its share of your credits per second instead of lowering the payout per node.',
      'Skills are offered only once the purchase that makes them useful is owned (the Kompromat skills need Kompromat harvest).',
      'Critical chance can go above 100%: a run can have several critical successes, each one paying and teaching again. Zero-days, Admin keys and Ransomware now add +100% critical chance instead of guaranteeing a critical success.',
      'An action card lights up when it hits a critical success, and shows critical successes per second when they come fast.',
      'The ICE Rating tip shows how it is calculated, and the node payout tip names every boost with its value.',
    ],
  },
  {
    version: '2026-10-26 23:00',
    changes: [
      'Every re-sleeve now gives a re-sleeve point, spent on a new tree of re-sleeve skills in its own group on the Skills tab. They are kept when you re-sleeve.',
      "New re-sleeve skill Sleeve Euphoria: every action level needs less XP the higher that action's sleeve level is (half as much at sleeve level 10, a quarter at 100).",
      'New re-sleeve skill Synthetic Sleeves: run extra sleeves beside this one. Each earns the credits per second a finished run ended with, scaled by your action levels until you catch up. The Network widget shows how many you have and what they earn together.',
      'New re-sleeve skill Incorporation: does nothing for now.',
      'New Stats tab: the last 10 sleeve-runs, with the credits per second and action levels each ended with.',
      'New skill Purge Protocol: every heat cooldown cycle removes 1 more heat for each sleeve level of Build Legend.',
      'A heat cooldown cycle never takes more than the whole points of heat that are left, so a bigger step can never leave heat stuck.',
    ],
  },
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
