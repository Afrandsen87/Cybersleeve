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
    version: '2026-10-30 Re-sleeve requirements',
    changes: [
      'Re-sleeving now needs sleeve levels: your sleeve levels across all actions must add up to 1 for your first re-sleeve, 2 for the second, and one more for each re-sleeve after that. The Re-sleeve button tip shows how many you have and how many you need.',
      'Study methods is much stronger: the XP that sleeve levels of the other actions need is divided by 1 plus the sleeve level of Practice Hacking, with no limit (it used to be at most 25% less).',
      'Clearer tooltips for ICE Rating, Augment, Overclock, Burn leads and Skill shards.',
      'Your save is upgraded to the new version automatically the next time you load the game.',
      'A large clean-up behind the scenes, so new features are easier to add.',
    ],
  },
  {
    version: '2026-10-27 Skill tree',
    changes: [
      'The skills are now a tree with three branches: Cybernetics (green), Anonymity (red) and Leverage (brown). Each grows sideways from a root skill, and a skill needs the one before it.',
      'You can see the whole tree from the start, but a skill shows ??? until you own what makes it useful.',
      'The re-sleeve skills grow sideways too.',
    ],
  },
  {
    version: '2026-10-27 Corporation widgets',
    changes: [
      'On the Corporation tab the widgets beside the corporation are now Holdings, Asset Acquisition and Hostile Negotiation, and the Inventory is gone from it.',
      'Corporation actions now gain action levels like character actions: every level makes the run 5% faster.',
      'Corporation actions can now have purchases. The first is Stock acquisition on Insider backstabbing: a 0.5% chance per run to acquire a stock of a competitor, shown in the new Holdings widget.',
      'The corporation widget shows Corporate rank, Owned corporations and Employees.',
      'New purchase in Asset Acquisition, the Corporate access upgrade: each one raises Corporate rank by 1, which unlocks the next corporation action. It is kept when you re-sleeve.',
    ],
  },
  {
    version: '2026-10-27 Show all',
    changes: ['Shortened some tooltips and the failed-import message.'],
  },
  {
    version: '2026-10-27 Corporation',
    changes: [
      'New Corporation tab, opened by the Incorporation re-sleeve skill. It is laid out like the Character tab, and the corporation is kept when you re-sleeve.',
      'New corporation action Insider backstabbing: a run takes 30 seconds, and each completed run has a 1% chance to upgrade one random Kompromat file you hold to the next rarity.',
      'Augment schematics are now applied by selecting the rarity in the Inventory (click its tile), then pressing the Augment button on an action. Only that rarity is used up.',
      'Each Augment schematic now adds 3% (was 1%) to the action XP boost of its rarity.',
      'Augment schematics and Burn leads drop ten times less often (0.5% of runs).',
      'Kompromat files sell for far more as they get rarer: each rarity is worth 1000 times the one before (100 credits for a common file, 100 thousand for an uncommon one, ...).',
    ],
  },
  {
    version: '2026-10-27 13:46',
    changes: [
      'Re-sleeving now has to be unlocked with the purchase "Unlock resleeving" (100 billion credits) at the bottom of the Sleeve widget. The unlock is kept when you re-sleeve.',
      'Sleeve levels stay hidden and give nothing until re-sleeving is unlocked, but their XP is still collected. The re-sleeve skill tree appears at the same time.',
      'Heat, ICE Rating and Legend stay hidden until something that makes or boosts them is unlocked.',
      'Purchases are listed cheapest first in every widget.',
      'Push malware costs more: Hardened payload 100 thousand, Zero-day exploits 5 million, Ransomware 5 billion, Persistence 1 trillion. The ICE Rating boost now costs 150 thousand.',
      'The ICE Rating tip now names Hardened payload as the purchase behind its per-level bonus.',
    ],
  },
  {
    version: '2026-10-26 23:33',
    changes: [
      'Grow network Auto-run now costs 10 credits; the Overclock and Focus of every action cost 25 and 100 times the Auto-run price of that same action.',
      'Kompromat sells for more: 100 credits for a common file, and 100 times more for each rarity above.',
      'Purchases now appear once their price is within 3 orders of magnitude of the most credits (or nodes) you have held.',
      'Tabs appear once you earn your first skill or automation point, and a tab blinks while a point is waiting to be spent.',
      'New Automation tab. The sleeve buyable Automation core gives automation points; each point unlocks one feature: Auto Burn (uses Burn leads to keep heat under a ceiling you set), Kompromat autosale (a switch per rarity) or Augment dispersal (a share of the schematics per action).',
      'Items you have not unlocked are hidden from the Inventory.',
      'The heat tax now takes its share of your credits per second instead of lowering the payout per node.',
      'Skills are offered only once you own what makes them useful (the Kompromat skills need Kompromat harvest).',
      'Critical chance can go above 100%: a run can have several critical successes, each one paying and teaching again. Zero-days, Admin keys and Ransomware now add +100% critical chance instead of guaranteeing a critical success.',
      'An action card lights up when it hits a critical success, and shows critical successes per second when they come fast.',
      'The ICE Rating and node payout tips show how they are calculated.',
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
      'New skill Purge Protocol: heat cools down faster for each sleeve level of Build Legend.',
      'Fixed heat sometimes getting stuck instead of cooling down.',
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
      'Amounts now stop at 1e308 (infinity).',
      'Saves: the last good save is kept as a backup, and you can export and import your save as text.',
      'Only one browser tab can play at a time, so two tabs cannot overwrite each other.',
      'Smoother and lighter on your computer.',
      'Added this changelog.',
    ],
  },
];
