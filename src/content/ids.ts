/**
 * @module content
 *
 * The ids of the game content: actions, buyables, skills and items. Never shown to the player; code and tests refer to content by these.
 */

/** Id of the first action. */
export const PRACTICE_HACKING = 'practice-hacking';
/** Id of the network-building action. */
export const GROW_NETWORK = 'grow-network';
/** Id of the malware action (needs access level 3). */
export const PUSH_MALWARE = 'push-malware';
/** Id of the server-killing action (needs access level 4). */
export const KILL_SERVERS = 'kill-servers';
/** Id of the legend action (needs access level 5). */
export const LEGEND = 'legend';
/** Id of the global interface-speed buyable. */
export const INTERFACE_BOOST = 'interface-boost';
/** Id of the global access-level buyable. */
export const ACCESS_UPGRADE = 'access-upgrade';
export const CORPORATE_ACCESS_UPGRADE = 'corporate-access-upgrade';
export const STOCK_ACQUISITION = 'stock-acquisition';
/** Id of the Push malware buyable that adds base ICE Rating per action level. */
export const MALWARE_ICE = 'malware-ice';
/** Id of the Faster conditioning buyable (fewer runs per batch of sleeve XP). */
export const FASTER_CONDITIONING = 'faster-conditioning';
/** Id of the Critical success buyable. */
export const CRITICAL_SUCCESS = 'critical-success';
/** Id of the auto-run buyable. */
export const AUTO_RUN = 'auto-run';
/** Id of the skill-transfer buyable (Practice Hacking's sleeve level also levels Grow Network's speed). */
export const SKILL_TRANSFER = 'skill-transfer';
/** Id of the study-methods buyable (reduces the XP every sleeve level needs). */
export const STUDY_METHODS = 'study-methods';
/** Id of the Grow Network auto-run buyable. */
export const NETWORK_AUTO_RUN = 'network-auto-run';
/** Id of the repeatable Grow Network buyable that multiplies the nodes each run pays. */
export const NETWORK_OUTPUT = 'network-output';
/** Id of the self-replicating network buyable. */
export const SELF_REPLICATION = 'self-replication';
/** Id of the buyable that ties interface speed to the size of the network. */
export const NETWORK_SYNERGY = 'network-synergy';
/** Id of the sleeve buyable bought with network nodes. */
export const NODE_UPLINK = 'node-uplink';
/** Id of the sleeve buyable that raises what each node produces. */
export const NODE_PAYOUT = 'node-payout';
/** Id of the sleeve buyable that multiplies ICE Rating. */
export const ICE_RATING_BOOST = 'ice-rating-boost';
/** Id of the one-time sleeve buyable that unlocks sleeve levels and re-sleeving. */
export const SLEEVE_LEVELS = 'sleeve-levels';
/** Id of the sleeve buyable that gives automation points (each unlocks one automation feature). */
export const AUTOMATION_CORE = 'automation-core';
/** Id of the Push malware auto-run buyable. */
export const MALWARE_AUTO_RUN = 'malware-auto-run';
/** Id of the repeatable Push malware buyable that doubles what each run adds to the node base payout. */
export const MALWARE_OUTPUT = 'malware-output';
/** Id of the skill that raises interface speed (bought with skill points in the Skills tab). */
export const SKILL_OVERCLOCK = 'skill-overclock';
/** Id of the skill that raises node payout by 10%. */
export const SKILL_BANDWIDTH = 'skill-bandwidth';
/** Id of the skill that makes heat cool down faster. */
export const SKILL_COLD_TRAIL = 'skill-cold-trail';
/** Id of the skill that raises Hacking Proficiency. */
export const SKILL_MUSCLE_MEMORY = 'skill-muscle-memory';
/** Id of the skill that lowers the XP every action level needs. */
export const SKILL_QUICK_STUDY = 'skill-quick-study';
/** Id of the skill that raises interface speed with the network's size, very slowly. */
export const SKILL_PARALLEL_THREADS = 'skill-parallel-threads';
/** Id of the skill that raises interface speed for each distinct rarity of augment applied. */
export const SKILL_NEURAL_ACCELERANT = 'skill-neural-accelerant';
/** Id of the skill that lets Push malware runs also pay a Grow network reward. */
export const SKILL_FIBER_TAP = 'skill-fiber-tap';
/** Id of the skill that multiplies the Grow network reward with its action level. */
export const SKILL_BACKBONE_PARASITE = 'skill-backbone-parasite';
/** Id of the skill that gives critical successes a chance to bring an extra one. */
export const SKILL_SIGNAL_AMPLIFIER = 'skill-signal-amplifier';
/** Id of the skill that raises the reward of critical successes. */
export const SKILL_OVERDRIVE_SPIKE = 'skill-overdrive-spike';
/** Id of the skill that doubles the Kompromat drop chance. */
export const SKILL_NOSE_FOR_SECRETS = 'skill-nose-for-secrets';
/** Id of the skill that raises node payout for each rare Kompromat file held. */
export const SKILL_EXPLOIT_KOMPROMAT = 'skill-exploit-kompromat';
/** Id of the skill that lets common Kompromat be given up for Moles (faster heat cooldown). */
export const SKILL_BACK_CHANNEL = 'skill-back-channel';
/** Id of the skill that adds a flat bonus to every Kompromat rarity's drop weight. */
export const SKILL_DEEP_FILES = 'skill-deep-files';
/** Id of the skill that raises node payout for each legendary Kompromat file held. */
export const SKILL_DOSSIER = 'skill-dossier';
/** Id of the skill that opens the back channel to every rarity, worth more Moles the rarer the file. */
export const SKILL_TIERED_INFORMANTS = 'skill-tiered-informants';
/** Id of the skill that doubles the Moles the back channel pays. */
export const SKILL_DOUBLE_AGENT = 'skill-double-agent';
/** Id of the skill that lowers the heat Push malware's Overclock makes per run. */
export const SKILL_OBFUSCATION = 'skill-obfuscation';
/** Id of the skill that makes each heat cooldown cycle remove more heat per sleeve level of Build Legend. */
export const SKILL_PURGE_PROTOCOL = 'skill-purge-protocol';
/** Id of the skill that makes each Burn lead take 1 more point of heat away. */
export const SKILL_SCORCHED_EARTH = 'skill-scorched-earth';
/** Id of the skill that makes Burn leads drop more often. */
export const SKILL_SILVER_TONGUE = 'skill-silver-tongue';
/** Id of the skill that makes heat cool faster while no action is in progress. */
export const SKILL_QUIET_HOURS = 'skill-quiet-hours';
/** Id of the skill that lets Grow network (without Overclock) count as "no action in progress" for Quiet Hours. */
export const SKILL_UNDERCOVER = 'skill-undercover';
/** Id of the skill that stops Moles being spent and makes them speed up heat cooling instead. */
export const SKILL_DEEP_COVER = 'skill-deep-cover';
/** Id of the end skill that caps the heat tax. */
export const SKILL_BLACKOUT = 'skill-blackout';
/** Id of the corporation action that may upgrade a random Kompromat file. */
export const INSIDER_BACKSTABBING = 'insider-backstabbing';
export * from './resleeveSkillIds';
/** Every skill id, branch by branch (cybernetics, anonymity, leverage), each root first. */
export const SKILLS = [
  SKILL_OVERCLOCK,
  SKILL_BANDWIDTH,
  SKILL_MUSCLE_MEMORY,
  SKILL_QUICK_STUDY,
  SKILL_PARALLEL_THREADS,
  SKILL_NEURAL_ACCELERANT,
  SKILL_FIBER_TAP,
  SKILL_BACKBONE_PARASITE,
  SKILL_SIGNAL_AMPLIFIER,
  SKILL_OVERDRIVE_SPIKE,
  SKILL_COLD_TRAIL,
  SKILL_OBFUSCATION,
  SKILL_PURGE_PROTOCOL,
  SKILL_SCORCHED_EARTH,
  SKILL_SILVER_TONGUE,
  SKILL_QUIET_HOURS,
  SKILL_UNDERCOVER,
  SKILL_DEEP_COVER,
  SKILL_BLACKOUT,
  SKILL_NOSE_FOR_SECRETS,
  SKILL_EXPLOIT_KOMPROMAT,
  SKILL_BACK_CHANNEL,
  SKILL_DEEP_FILES,
  SKILL_DOSSIER,
  SKILL_TIERED_INFORMANTS,
  SKILL_DOUBLE_AGENT,
] as const;
/** Branch id of the skill tree's cybernetics lane (its title is in `ui/uiText.ts`, its colour in `ui/style.css`). */
export const BRANCH_CYBERNETICS = 'cybernetics';
/** Branch id of the skill tree's anonymity lane (heat and traces). */
export const BRANCH_ANONYMITY = 'anonymity';
/** Branch id of the skill tree's leverage lane (Kompromat). */
export const BRANCH_LEVERAGE = 'leverage';
/** Branch id of the Auto Burn lane in the Automation tab (progressively better versions of that automation); also the feature's id. */
export const BRANCH_AUTO_BURN = 'autoBurn' as const;
/** Branch id of the Compromat Autosale lane in the Automation tab; also the feature's id. */
export const BRANCH_AUTOSALE = 'autosale' as const;
/** Branch id of the Augment Dispersal lane in the Automation tab; also the feature's id. */
export const BRANCH_DISPERSAL = 'dispersal' as const;
/** Number of skills in each automation lane (placeholders for now). */
export const AUTOMATION_LINE_LENGTH = 10;
/** Id of the `step`-th skill (1-based) of an automation lane. */
export const automationSkillId = (branch: string, step: number): string => `skill-${branch}-${step}`;
/** Every automation skill id, lane by lane (Auto Burn, Autosale, Dispersal), each root first. */
export const AUTOMATION_SKILLS: readonly string[] = [BRANCH_AUTO_BURN, BRANCH_AUTOSALE, BRANCH_DISPERSAL].flatMap((branch) =>
  Array.from({ length: AUTOMATION_LINE_LENGTH }, (_, i) => automationSkillId(branch, i + 1)),
);
/** Id of the Kill servers auto-run buyable. */
export const KILL_AUTO_RUN = 'kill-auto-run';
/** Id of the Build Legend auto-run buyable. */
export const LEGEND_AUTO_RUN = 'legend-auto-run';
/** Id of the Practice Hacking buyable that makes completed runs drop Kompromat files. */
export const KOMPROMAT_HARVEST = 'kompromat-harvest';
/** Id of the Kompromat file item. */
export const KOMPROMAT = 'kompromat';
/** Id of the Augment schematic item (applied to an action to raise its action XP gain). */
export const AUGMENT_SCHEMATIC = 'augment-schematic';
/** Id of the Grow network buyable that lets its runs drop Augment schematics. */
export const INDUSTRIAL_ESPIONAGE = 'industrial-espionage';
/** Id of the Practice Hacking buyable that lets Hacking Proficiency shift the drop ratios towards the rarer rarities. */
export const RARITY_REFINEMENT = 'rarity-refinement';
/** Id of the sleeve upgrade that makes every Overclock stronger. */
export const OVERCLOCK_UPGRADE = 'overclock-upgrade';
/** Id of the sleeve upgrade that gives more Focus slots. */
export const FOCUS_UPGRADE = 'focus-upgrade';
/** Id of the buyable that unlocks Overclock for one action. */
export const overclockUnlockId = (actionId: string): string => `${actionId}-overclock`;
/** Id of the buyable that unlocks Focus for one action. */
export const focusUnlockId = (actionId: string): string => `${actionId}-focus`;
/** Id of the Burn lead item (used from the Inventory to take heat away). */
export const BURN_LEAD = 'burn-lead';
/** Id of the Grow network buyable that lets its runs drop Burn leads. */
export const BURN_LEADS = 'burn-leads';
/** Id of the Zero-day item (switched on in the Inventory to make Push malware runs critical). */
export const ZERO_DAY = 'zero-day';
/** Id of the Admin key item (switched on in the Inventory to make Practice Hacking runs critical). */
export const ADMIN_KEY = 'admin-key';
/** Id of the Skill shard item (used from the Inventory to delay the XP scaling of a random unlocked action). */
export const SKILL_SHARD = 'skill-shard';
/** Id of the Kill servers buyable that adds the Kill chain to its Overclock. */
export const KILL_CHAIN = 'kill-chain';
/** Id of the Kill servers buyable that lets its runs drop Admin keys. */
export const BLACK_BOX_RECORDER = 'black-box-recorder';
/** Id of the Kill servers buyable that lowers its node cost with every action level. */
export const DECOMMISSION_PROTOCOL = 'decommission-protocol';
/** Id of the Kill servers buyable that pays credits for the nodes its runs destroy. */
export const CREDIT_SIPHON = 'credit-siphon';
/** Id of the Kill servers buyable that multiplies the ICE Rating each run pays. */
export const CASCADE_FAILURE = 'cascade-failure';
/** Id of the Push malware buyable that lets its runs drop Zero-days. */
export const ZERO_DAY_EXPLOITS = 'zero-day-exploits';
/** Id of the Push malware buyable that triples what its critical successes do. */
export const PERSISTENCE = 'persistence';
/** Id of the Push malware buyable whose critical runs bank guaranteed critical successes for Grow network. */
export const RANSOMWARE = 'ransomware';
