/**
 * @module content
 *
 * THE tuning file. Every number that shapes progression lives here; change a value and the whole
 * game follows, with no code changes. Names are placeholders and may be renamed freely.
 * See `docs/CONFIG.md` for a description of every variable.
 *
 * @remarks
 * For quick experiments, derive a variant with `createConfig(gameConfig, { global: { speedMultiplier: 10 } })`
 * instead of editing this file.
 */
import { num } from '../numbers';
import type { BuyableDefinition, GameConfig } from '../core';

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
/** Id of the skill that doubles the Kompromat drop chance. */
export const SKILL_NOSE_FOR_SECRETS = 'skill-nose-for-secrets';
/** Id of the skill that raises node payout for each uncommon Kompromat file held. */
export const SKILL_EXPLOIT_KOMPROMAT = 'skill-exploit-kompromat';
/** Id of the skill that lets common Kompromat be given up for Moles (faster heat cooldown). */
export const SKILL_BACK_CHANNEL = 'skill-back-channel';
/** Id of the skill that lowers the heat Push malware's Overclock makes per run. */
export const SKILL_OBFUSCATION = 'skill-obfuscation';
/** Id of the skill that makes each heat cooldown cycle remove more heat per sleeve level of Build Legend. */
export const SKILL_PURGE_PROTOCOL = 'skill-purge-protocol';
/** Id of the re-sleeve skill that lowers the XP every action level needs, by the action's own sleeve level. */
export const SKILL_SLEEVE_EUPHORIA = 'skill-sleeve-euphoria';
/** Id of the re-sleeve skill that gives synthetic sleeves. */
export const SKILL_SYNTHETIC_SLEEVES = 'skill-synthetic-sleeves';
/** Id of the re-sleeve skill that does nothing yet. */
export const SKILL_INCORPORATION = 'skill-incorporation';
/** Every re-sleeve skill id, in the order the tree lists them. */
export const RESLEEVE_SKILLS = [SKILL_SLEEVE_EUPHORIA, SKILL_SYNTHETIC_SLEEVES, SKILL_INCORPORATION] as const;
/** Every skill id, in the order the Skills tab lists them. */
export const SKILLS = [
  SKILL_OVERCLOCK,
  SKILL_BANDWIDTH,
  SKILL_COLD_TRAIL,
  SKILL_MUSCLE_MEMORY,
  SKILL_QUICK_STUDY,
  SKILL_NOSE_FOR_SECRETS,
  SKILL_EXPLOIT_KOMPROMAT,
  SKILL_BACK_CHANNEL,
  SKILL_OBFUSCATION,
  SKILL_PURGE_PROTOCOL,
] as const;
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

/** The Overclock unlock of one action: the price is the same for every action for now. */
const overclockUnlock = (actionId: string, description: string): BuyableDefinition => ({
  id: overclockUnlockId(actionId),
  name: 'Overclock',
  symbol: 'OV',
  description,
  actionId,
  cost: num(250),
  effect: { kind: 'overclockUnlock' },
});

/** The Focus unlock of one action: the price is the same for every action for now. */
const focusUnlock = (actionId: string): BuyableDefinition => ({
  id: focusUnlockId(actionId),
  name: 'Focus',
  symbol: 'FO',
  description:
    'Unlocks Focus for this action: while focused it runs 25% faster. Only a few actions can be focused at once (Focus upgrades add slots).',
  actionId,
  cost: num(1_000),
  effect: { kind: 'focusUnlock' },
});

/** The game's configuration (content and tuning). */
export const gameConfig: GameConfig = {
  items: {
    /** Most common first. Each tier sells for an order of magnitude more than the one before, starting at 10 credits. */
    rarities: [
      { id: 'common', name: 'Common', sellValue: num(10) },
      { id: 'uncommon', name: 'Uncommon', sellValue: num(100) },
      { id: 'rare', name: 'Rare', sellValue: num(1_000) },
      { id: 'legendary', name: 'Legendary', sellValue: num(10_000) },
      { id: 'crisis', name: 'Crisis level', sellValue: num(100_000) },
    ],
    definitions: [
      { id: KOMPROMAT, name: 'Kompromat file' },
      // Schematics are applied with the Augment button, not paid out.
      { id: AUGMENT_SCHEMATIC, name: 'Augment schematic', sellable: false },
      // Leads are used from the Inventory to take heat away, not paid out.
      { id: BURN_LEAD, name: 'Burn lead', sellable: false, hasRarity: false },
      // Zero-days are switched on in the Inventory and used up by critical Push malware runs, not paid out.
      { id: ZERO_DAY, name: 'Zero-day', sellable: false, hasRarity: false },
      // Admin keys are switched on in the Inventory and used up by critical Practice Hacking runs, not paid out.
      { id: ADMIN_KEY, name: 'Admin key', sellable: false, hasRarity: false },
      // Shards are used from the Inventory on a random unlocked action, not paid out.
      { id: SKILL_SHARD, name: 'Skill shard', sellable: false, hasRarity: false },
    ],
    /**
     * One Augment schematic applied to an action adds 1% to the action XP boost of ITS rarity (additively); the boosts of the
     * different rarities multiply. Sleeve XP is not affected.
     */
    augment: { itemId: AUGMENT_SCHEMATIC, xpBonusPerItem: 0.01 },
    /** One Burn lead used from the Inventory takes 5% of the CURRENT heat away and is used up. */
    burnLead: { itemId: BURN_LEAD, heatFraction: 0.05 },
    /** While the Zero-day toggle is on, every completed Push malware run uses one Zero-day up and is a critical success. */
    zeroDay: { itemId: ZERO_DAY, actionId: PUSH_MALWARE },
    /**
     * While the Admin key toggle is on, every completed Practice Hacking run uses one Admin key up and is a critical success. Each such
     * key-assisted critical run has a 2% chance to drop a Skill shard (placeholder).
     */
    adminKey: { itemId: ADMIN_KEY, actionId: PRACTICE_HACKING, shard: { itemId: SKILL_SHARD, chance: 0.02 } },
    /** One Skill shard delays the XP scaling of the action it lands on by 1 level. */
    skillShard: { itemId: SKILL_SHARD, levelsDelayed: 1 },
  },

  actions: [
    {
      id: GROW_NETWORK,
      name: 'Grow network',
      /** Seconds per run at speed x1. */
      baseDurationMs: 3_000,
      /** Network nodes per completed run (no credits). */
      reward: num(1),
      rewardKind: 'networkNodes',
      /** Action XP per completed run. */
      xpPerRun: num(1),
      /** Overclock: 50% faster, at the price of 2 heat per minute of running. */
      overclock: { speedBonus: 0.5, heatPerMinute: 2 },
    },
    {
      id: PRACTICE_HACKING,
      name: 'Practice Hacking',
      /** Time per run at speed x1: 5 s, so a run takes 50 s at the starting interface speed of 0.1. */
      baseDurationMs: 5_000,
      /** Added to Hacking Proficiency per completed run (no credits). Proficiency raises the hacking multiplier on interface speed. */
      reward: num(0.01),
      rewardKind: 'hackingProficiency',
      /** Locked until the sleeve has access level 2 (the first Access upgrade). */
      requiredAccessLevel: 2,
      /** Action XP per completed run. */
      xpPerRun: num(1),
      /** Overclock: pays 200% more (x3) per run, but each completed run costs 5 nodes. */
      overclock: { rewardBonus: 2, completionEffects: [{ kind: 'removeNodes', amount: 5 }] },
      // Optional per-action overrides (fall back to the global rules below):
      //   levels: { firstLevelXp: 10, growthFactor: 10 },
      //   speedScaling: { kind: 'linear', perLevel: 0.05 },
    },
    {
      id: PUSH_MALWARE,
      name: 'Push malware',
      /** Seconds per run at speed x1. */
      baseDurationMs: 6_000,
      /** Added to the BASE credits per second of every node per completed run (no credits of its own): 0.0001, i.e. 1% of the starting base of 0.01. */
      reward: num(1e-4),
      rewardKind: 'nodePayout',
      /** Heat added per completed run. */
      heatPerRun: 1,
      /** Access level the sleeve needs to perform this action. */
      requiredAccessLevel: 3,
      /** Action XP per completed run. */
      xpPerRun: num(1),
      /** Overclock: each run also pays the nodes of a Grow network run, but makes three times as much heat. */
      overclock: { alsoPays: GROW_NETWORK, heatPerRunFactor: 3 },
    },
    {
      id: KILL_SERVERS,
      name: 'Kill servers',
      /** Seconds per run at speed x1: 2 minutes. */
      baseDurationMs: 120_000,
      /** ICE Rating gained per completed run (no credits). */
      reward: num(1),
      rewardKind: 'iceRating',
      /** Paid at the start of every run: 1% of the current nodes, rounded down to whole nodes (so it needs at least 100 nodes). */
      startCost: { currency: 'networkNodes', fractionOfBalance: 0.01 },
      /** Access level the sleeve needs to perform this action. */
      requiredAccessLevel: 4,
      /** Action XP per completed run. */
      xpPerRun: num(1),
      /**
       * Overclock: pays double the ICE Rating per run, but heat is held in place while it runs. The Kill chain buyable adds a chain
       * to it (see KILL_CHAIN).
       */
      overclock: { rewardBonus: 1, stopsHeatCooling: true },
    },
    {
      id: LEGEND,
      name: 'Build Legend',
      /** Seconds per run at speed x1: 5 minutes. */
      baseDurationMs: 300_000,
      /** Legend gained per completed run (no credits). */
      reward: num(1),
      rewardKind: 'legend',
      /** Access level the sleeve needs to perform this action. */
      requiredAccessLevel: 5,
      /** Heat added for every second the action runs. */
      heatPerSecond: 5,
      /** Each completed run removes a quarter of the network. */
      completionEffects: [{ kind: 'removeNodesFraction', fraction: 0.25 }],
      /** Action XP per completed run. */
      xpPerRun: num(1),
    },
  ],

  buyables: [
    {
      id: AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes.',
      actionId: PRACTICE_HACKING,
      cost: num(100),
      effect: { kind: 'autoRun' },
    },
    {
      id: KOMPROMAT_HARVEST,
      name: 'Kompromat harvest',
      symbol: 'KH',
      description: 'Each completed run has a chance to drop a Kompromat file, which can be sold from the Inventory.',
      actionId: PRACTICE_HACKING,
      cost: num(500),
      effect: {
        kind: 'itemDrop',
        drop: {
          itemId: KOMPROMAT,
          /** Chance that one completed run drops a file at all: 5%. */
          chance: 0.05,
          /** Relative weight of each rarity once a file drops: 90% common, 9% uncommon, 1% rare. */
          rarityWeights: { common: 90, uncommon: 9, rare: 1, legendary: 0, crisis: 0 },
        },
      },
    },
    {
      id: RARITY_REFINEMENT,
      name: 'Rarity refinement',
      symbol: 'RR',
      description: 'Increases the rarity of Kompromat drops based on Hacking Proficiency.',
      actionId: PRACTICE_HACKING,
      cost: num(10_000),
      requires: [KOMPROMAT_HARVEST],
      // fractionPerOrder 0.01: each shift moves 1% of every rarity's weight on to the next rarity, all worked out up front and moved at once
      effect: { kind: 'rarityShiftFromProficiency', fractionPerOrder: 0.01 },
    },
    {
      id: SKILL_TRANSFER,
      name: 'Skill transfer',
      symbol: 'ST',
      description: "Adds Practice Hacking's sleeve level to Grow network's level, which raises its speed.",
      actionId: PRACTICE_HACKING,
      cost: num(1_000_000),
      effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: PRACTICE_HACKING, targetActionId: GROW_NETWORK },
    },
    {
      id: STUDY_METHODS,
      name: 'Study methods',
      symbol: 'SM',
      description: 'Every sleeve level of the other actions needs 0.01% less XP for each sleeve level of Practice Hacking, up to 25% less.',
      actionId: PRACTICE_HACKING,
      cost: num(1e15),
      // perLevel 0.0001 = 0.01 percent per sleeve level (the cap is reached at level 2500); maxReduction 0.25 = at most 25 percent
      effect: { kind: 'sleeveXpReduction', sourceActionId: PRACTICE_HACKING, perLevel: 0.0001, maxReduction: 0.25 },
    },
    {
      id: NETWORK_AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes.',
      actionId: GROW_NETWORK,
      cost: num(50),
      effect: { kind: 'autoRun' },
    },
    {
      id: NETWORK_OUTPUT,
      name: 'Parallel nodes',
      symbol: '×2',
      description: 'Doubles the nodes each run pays. Each copy costs 100x more.',
      actionId: GROW_NETWORK,
      cost: num(75),
      costGrowth: 100, // every 2nd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'rewardMultiplier', factor: 2 },
    },
    {
      id: BURN_LEADS,
      name: 'Burn leads',
      symbol: 'BN',
      description: 'Each completed run has a chance to drop a Burn lead. Using one from the Inventory takes 5% of your current heat away.',
      actionId: GROW_NETWORK,
      // Placeholder price (balance is not tuned yet).
      cost: num(1_000),
      effect: {
        kind: 'itemDrop',
        drop: {
          itemId: BURN_LEAD,
          /** Chance that one completed run drops a lead at all: 5%. */
          chance: 0.05,
        },
      },
    },
    {
      id: INDUSTRIAL_ESPIONAGE,
      name: 'Industrial Espionage',
      symbol: 'IE',
      description: 'Each completed run has a chance to drop an Augment schematic, which can be applied to an action.',
      actionId: GROW_NETWORK,
      cost: num(10_000),
      effect: {
        kind: 'itemDrop',
        drop: {
          itemId: AUGMENT_SCHEMATIC,
          /** Chance that one completed run drops a schematic at all: 5% (placeholder, like the Kompromat numbers). */
          chance: 0.05,
          /** Relative weight of each rarity once a schematic drops: 90% common, 9% uncommon, 1% rare. */
          rarityWeights: { common: 90, uncommon: 9, rare: 1, legendary: 0, crisis: 0 },
        },
      },
    },
    {
      id: SELF_REPLICATION,
      name: 'Self-replication',
      symbol: 'SR',
      description: 'The network grows by a percentage every second.',
      formula: 'Growth factor percentage = Action level / 1000',
      actionId: GROW_NETWORK,
      cost: num(1e10),
      // percentPerLevel 0.001: level / 1000 percent per second, e.g. level 50 = 0.05% per second
      effect: { kind: 'networkGrowthFromActionLevel', sourceActionId: GROW_NETWORK, percentPerLevel: 0.001 },
    },
    {
      id: NETWORK_SYNERGY,
      name: 'Network synergy',
      symbol: 'NS',
      description: 'Multiplies the base interface speed by 1 + ln(nodes) / 100.',
      actionId: GROW_NETWORK,
      cost: num(1e35),
      effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.01 },
    },
    {
      id: MALWARE_AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes.',
      actionId: PUSH_MALWARE,
      cost: num(15_000),
      effect: { kind: 'autoRun' },
    },
    {
      id: ZERO_DAY_EXPLOITS,
      name: 'Zero-day exploits',
      symbol: '0D',
      description:
        'Each completed run has a chance to drop a Zero-day. Switch Zero-days on in the Inventory: each completed run then uses one up and is a critical success.',
      actionId: PUSH_MALWARE,
      cost: num(5_000),
      effect: {
        kind: 'itemDrop',
        drop: {
          itemId: ZERO_DAY,
          /** Chance that one completed run drops a Zero-day at all: 5%. */
          chance: 0.05,
        },
      },
    },
    {
      id: MALWARE_OUTPUT,
      name: 'Malware payload',
      symbol: '×2',
      description: 'Doubles what each run adds to the base payout of every node. Each copy costs 100x more.',
      actionId: PUSH_MALWARE,
      cost: num(10_000),
      costGrowth: 100, // every 2nd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'rewardMultiplier', factor: 2 },
    },
    {
      id: MALWARE_ICE,
      name: 'Hardened payload',
      symbol: 'HP',
      description: 'Adds 10 to your base ICE Rating for every level of this action.',
      actionId: PUSH_MALWARE,
      cost: num(10_000),
      // perLevel 10: level 5 adds 10 x 5 = 50 to the base ICE Rating, before the ICE Rating boost multiplies it
      effect: { kind: 'iceRatingFromActionLevel', sourceActionId: PUSH_MALWARE, perLevel: 10 },
    },
    {
      id: RANSOMWARE,
      name: 'Ransomware',
      symbol: 'RW',
      description:
        'Every critical Push malware run gives Grow network a guaranteed critical success: its next completed run is critical for sure.',
      actionId: PUSH_MALWARE,
      // Placeholder price (balance is not tuned yet).
      cost: num(100_000),
      effect: { kind: 'criticalLink', targetActionId: GROW_NETWORK },
    },
    {
      id: PERSISTENCE,
      name: 'Persistence',
      symbol: 'PS',
      description:
        'Triples what a critical success does for this action: the multipliers on its reward and its action XP are three times as big.',
      actionId: PUSH_MALWARE,
      cost: num(500_000),
      effect: { kind: 'criticalBoost', factor: 3 },
    },
    {
      id: KILL_AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes (each restart pays the start cost).',
      actionId: KILL_SERVERS,
      cost: num(1e9), // 1 billion
      effect: { kind: 'autoRun' },
    },
    {
      id: DECOMMISSION_PROTOCOL,
      name: 'Decommission protocol',
      symbol: 'DP',
      description:
        'Every action level lowers the share of your nodes a run takes by 1% of its current value. The first level is worth the most, and the cost keeps shrinking without ever reaching zero.',
      formula: 'Share of nodes = base share x 0.99 ^ action level',
      actionId: KILL_SERVERS,
      // Placeholder price (balance is not tuned yet). The Kill servers prices climb in this order: Cascade failure, Credit Siphon,
      // Decommission protocol, Kill chain, Black box recorder.
      cost: num(1e14),
      effect: { kind: 'startCostReduction', perLevel: 0.01 },
    },
    {
      id: CREDIT_SIPHON,
      name: 'Credit Siphon',
      symbol: 'CD',
      description: 'When a run starts, you are paid 10 seconds of what a node produces for every node it destroys.',
      actionId: KILL_SERVERS,
      // Placeholder price (balance is not tuned yet).
      cost: num(1e12),
      effect: { kind: 'creditSiphon', seconds: 10 },
    },
    {
      id: CASCADE_FAILURE,
      name: 'Cascade failure',
      symbol: '×2',
      description: 'Doubles the ICE Rating each run pays. Each copy costs 100x more.',
      actionId: KILL_SERVERS,
      // Placeholder price (balance is not tuned yet).
      cost: num(1e10),
      costGrowth: 100, // every 2nd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'rewardMultiplier', factor: 2 },
    },
    {
      id: KILL_CHAIN,
      name: 'Kill chain',
      symbol: 'KC',
      description:
        'Adds a chain to the Overclock of this action: every consecutive overclocked run adds a link (up to 20) that makes the next run pay 10% more ICE Rating and take 10% more of the share of nodes. Stopping the action or switching Overclock off breaks the chain.',
      actionId: KILL_SERVERS,
      requires: [overclockUnlockId(KILL_SERVERS)],
      // Placeholder price (balance is not tuned yet).
      cost: num(1e17),
      // 20 links; each adds 10% of the base reward (a gain: grows with Overclock strength) and 10% to the node share (a price: fixed)
      effect: { kind: 'overclockChain', chain: { maxLinks: 20, rewardPerLink: 0.1, nodesPerLink: 0.1 } },
    },
    {
      id: BLACK_BOX_RECORDER,
      name: 'Black box recorder',
      symbol: 'BB',
      description:
        'Each completed run has a chance to drop an Admin key. Switch Admin keys on in the Inventory: each completed Practice Hacking run then uses one up and is a critical success, and may drop a Skill shard.',
      actionId: KILL_SERVERS,
      // Placeholder price (balance is not tuned yet).
      cost: num(1e20),
      effect: {
        kind: 'itemDrop',
        drop: {
          itemId: ADMIN_KEY,
          /** Chance that one completed run drops an Admin key at all: 10% (placeholder; Kill servers runs are slow). */
          chance: 0.1,
        },
      },
    },
    {
      id: LEGEND_AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes.',
      actionId: LEGEND,
      cost: num(1e15), // 1 Qa
      effect: { kind: 'autoRun' },
    },
    // Unlocks of the per-action toggles, shown in the square on each action card (not in its row of purchases).
    overclockUnlock(GROW_NETWORK, 'Unlocks Overclock for this action: 50% faster, at the price of 2 heat per minute while it runs.'),
    overclockUnlock(PRACTICE_HACKING, 'Unlocks Overclock for this action: pays 200% more, but each completed run costs 5 nodes.'),
    overclockUnlock(
      PUSH_MALWARE,
      'Unlocks Overclock for this action: each run also pays the nodes of a Grow network run, but makes 3x the heat.',
    ),
    overclockUnlock(
      KILL_SERVERS,
      'Unlocks Overclock for this action: pays double ICE Rating and holds heat in place while it runs. The Kill chain adds more.',
    ),
    focusUnlock(GROW_NETWORK),
    focusUnlock(PRACTICE_HACKING),
    focusUnlock(PUSH_MALWARE),
    focusUnlock(KILL_SERVERS),
    focusUnlock(LEGEND),
    // Skills: bought with skill points (one point each for now), shown in the Skills tab. No actionId.
    {
      id: SKILL_OVERCLOCK,
      name: 'Overclocked Cortex',
      symbol: 'OC',
      description: 'Raises interface speed by 5%.',
      currency: 'skillPoints',
      cost: num(1),
      effect: { kind: 'interfaceSpeedMultiplier', factor: 1.05 },
    },
    {
      id: SKILL_BANDWIDTH,
      name: 'Bandwidth Leech',
      symbol: 'BL',
      description: 'Raises node payout by 10%.',
      currency: 'skillPoints',
      cost: num(1),
      effect: { kind: 'nodePayoutMultiplier', factor: 1.1 },
    },
    {
      id: SKILL_COLD_TRAIL,
      name: 'Cold Trail',
      symbol: 'CT',
      description: 'Heat cools down 5% faster.',
      currency: 'skillPoints',
      cost: num(1),
      effect: { kind: 'heatCooldownSpeed', factor: 1.05 },
    },
    {
      id: SKILL_MUSCLE_MEMORY,
      name: 'Muscle Memory',
      symbol: 'MM',
      description: 'Raises Hacking Proficiency by 5%.',
      currency: 'skillPoints',
      cost: num(1),
      effect: { kind: 'hackingProficiencyMultiplier', factor: 1.05 },
    },
    {
      id: SKILL_QUICK_STUDY,
      name: 'Quick Study',
      symbol: 'QS',
      description: 'Every action level needs 1% less XP. Sleeve levels stay as they are.',
      currency: 'skillPoints',
      cost: num(1),
      effect: { kind: 'actionXpReduction', amount: 0.01 },
    },
    {
      id: SKILL_NOSE_FOR_SECRETS,
      name: 'Nose for Secrets',
      symbol: 'NF',
      description: 'Doubles the chance that a run drops a Kompromat file.',
      currency: 'skillPoints',
      cost: num(1),
      effect: { kind: 'itemDropChanceMultiplier', itemId: KOMPROMAT, factor: 2 },
    },
    {
      id: SKILL_EXPLOIT_KOMPROMAT,
      name: 'Exploit Kompromat',
      symbol: 'EK',
      description: 'Each uncommon Kompromat file you hold raises node payout by 1%.',
      currency: 'skillPoints',
      cost: num(1),
      effect: { kind: 'nodePayoutFromItems', itemId: KOMPROMAT, rarityId: 'uncommon', perItem: 0.01 },
    },
    {
      id: SKILL_BACK_CHANNEL,
      name: 'Back Channel Deals',
      symbol: 'BC',
      description: 'Give up common Kompromat files for Moles. Each Mole is one point of heat that cools down 200% faster.',
      currency: 'skillPoints',
      cost: num(1),
      // 5 Moles per file given up; while Moles remain the heat cools 200% faster
      effect: { kind: 'backChannel', itemId: KOMPROMAT, rarityId: 'common', molesPerItem: 5, cooldownBoost: 2 },
    },
    {
      id: SKILL_OBFUSCATION,
      name: 'Obfuscation',
      symbol: 'OB',
      description: 'Push malware makes only 2x as much heat per run while overclocked, instead of 3x.',
      currency: 'skillPoints',
      cost: num(1),
      effect: { kind: 'overclockHeatFactor', targetActionId: PUSH_MALWARE, factor: 2 },
    },
    {
      id: SKILL_PURGE_PROTOCOL,
      name: 'Purge Protocol',
      symbol: 'PP',
      description: 'Each heat cooldown cycle removes 1 more heat for every sleeve level of Build Legend.',
      currency: 'skillPoints',
      cost: num(1), // placeholder; a late-stage skill, since sleeve levels of Build Legend come slowly
      effect: { kind: 'heatCooldownAmountFromSleeveLevel', sourceActionId: LEGEND, perLevel: 1 },
    },
    // Re-sleeve skills: bought with re-sleeve points (one per re-sleeve), kept through re-sleeving, laid out as a tree through `requires`.
    {
      id: SKILL_SLEEVE_EUPHORIA,
      name: 'Sleeve Euphoria',
      symbol: 'SE',
      description:
        "Every action level needs less XP the higher that action's sleeve level is: half as much at sleeve level 10, a quarter at 100.",
      formula: 'XP Needed = Normal XP x 0.5 ^ log10(Sleeve Level of the action)',
      currency: 'resleevePoints',
      cost: num(1),
      // each order of magnitude of sleeve level halves what is left: 50% less at level 10, 75% less at level 100; never more than 99.9% less
      effect: { kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 0.999 },
    },
    {
      id: SKILL_SYNTHETIC_SLEEVES,
      name: 'Synthetic Sleeves',
      symbol: 'SS',
      description:
        'Run extra sleeves beside this one. You get one now, copied from your last sleeve-run, and one more with every re-sleeve. Each earns the credits per second its run ended with, scaled by how many action levels you have compared to then, until you catch up.',
      currency: 'resleevePoints',
      cost: num(1),
      requires: [SKILL_SLEEVE_EUPHORIA],
      effect: { kind: 'synthSleeves' },
    },
    {
      id: SKILL_INCORPORATION,
      name: 'Incorporation',
      symbol: 'IN',
      description: 'Does nothing for now.',
      currency: 'resleevePoints',
      cost: num(1),
      requires: [SKILL_SLEEVE_EUPHORIA],
      effect: { kind: 'placeholder' },
    },
    // Global (sleeve) buyables: no actionId; they change the sleeve's stats. Prices are placeholders.
    {
      id: ICE_RATING_BOOST,
      name: 'ICE Rating boost',
      symbol: 'IB',
      description: 'Multiplies ICE Rating by 2. Each copy costs 100x more.',
      cost: num(15_000), // a little above Hardened payload: it multiplies nothing until that adds base ICE Rating
      costGrowth: 100, // every 2nd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'iceRatingMultiplier', factor: 2 },
    },
    {
      id: NODE_PAYOUT,
      name: 'Node payout',
      symbol: 'NP',
      description: 'Each node produces 100% more credits. Paid in network nodes. Each copy costs 10x more.',
      currency: 'networkNodes',
      cost: num(25),
      costGrowth: 10, // every order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'nodePayoutMultiplier', factor: 2 }, // +100% per copy, compounding
    },
    {
      id: NODE_UPLINK,
      name: 'Node uplink',
      symbol: 'NU',
      description: 'Raises the base interface speed by 0.1. Paid in network nodes. Each copy costs 10x more.',
      currency: 'networkNodes',
      cost: num(10),
      costGrowth: 10, // every order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'interfaceSpeed', amount: 0.1 },
    },
    {
      id: INTERFACE_BOOST,
      name: 'Interface boost',
      symbol: 'IF',
      description: 'Raises the base interface speed by 0.05, which speeds up every action. Each copy costs 1000x more.',
      cost: num(10),
      costGrowth: 1_000, // every 3rd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'interfaceSpeed', amount: 0.05 },
    },
    {
      id: ACCESS_UPGRADE,
      name: 'Access upgrade',
      symbol: 'AX',
      description: 'Raises Access Level by 1, which unlocks the next action. Each copy costs 1000x more.',
      cost: num(5),
      costGrowth: 1_000, // every 3rd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'accessLevel', amount: 1 },
    },
    {
      id: OVERCLOCK_UPGRADE,
      name: 'Overclock upgrade',
      symbol: 'OU',
      description:
        'Makes the gains of every Overclock 10% stronger (the speed and reward bonuses; the costs stay). Each copy costs 1000x more.',
      cost: num(250_000), // 1000x what unlocking Overclock cost before it became per action
      costGrowth: 1_000, // every 3rd order of magnitude
      maxPurchases: Infinity,
      // perCopy 0.1: the first copy makes every Overclock 10% stronger, the second 20%, and so on
      effect: { kind: 'overclockStrength', perCopy: 0.1 },
    },
    {
      id: FOCUS_UPGRADE,
      name: 'Focus upgrade',
      symbol: 'FU',
      description: 'One more action can be focused at once. Each copy costs 100,000x more.',
      cost: num(1_000_000), // 1000x what the first Focus slot cost before Focus became per action
      costGrowth: 100_000, // every 5th order of magnitude
      // One slot is free (focus.baseSlots), so the cap that gives every action a slot is the number of actions minus one (the content test checks it).
      maxPurchases: 4,
      effect: { kind: 'focusSlots', perCopy: 1 },
    },
    {
      id: FASTER_CONDITIONING,
      name: 'Faster conditioning',
      symbol: 'FC',
      description: 'Every action needs 1 run fewer for each batch of sleeve XP, down to 10 runs. Each copy costs 100x more.',
      cost: num(1_000),
      costGrowth: 100, // every 2nd order of magnitude
      // 90 copies take the 100 runs per batch down to the floor of 10 (the content test checks the cap matches)
      maxPurchases: 90,
      effect: { kind: 'runsPerSleeveXpReduction', perCopy: 1, minRuns: 10 },
    },
    {
      id: CRITICAL_SUCCESS,
      name: 'Critical success',
      symbol: 'CS',
      description:
        'Every completed run of any action has a 5% chance to be a critical success: double XP and triple payout. Each copy adds 5% and costs 1000x more.',
      cost: num(50),
      costGrowth: 1_000, // every 3rd order of magnitude
      maxPurchases: Infinity,
      // chance 0.05 per copy: 20 copies make every run critical (the total is capped at 1)
      effect: { kind: 'criticalChance', chance: 0.05 },
    },
  ],

  /** What a critical success does unless an action says otherwise: its XP is doubled and its reward tripled. */
  criticalSuccess: { xpMultiplier: 2, rewardMultiplier: 3 },

  /** A focused action runs 25% faster; one action can be focused at the start, Focus upgrades add slots. */
  focus: { speedBonus: 0.25, baseSlots: 1 },

  /** Each re-sleeve gives one re-sleeve point; the Stats tab lists the last 10 sleeve-runs. */
  resleeve: { pointsPerResleeve: 1, runsShown: 10 },

  progression: {
    /** Completed runs of one action per batch of that action's sleeve XP. */
    runsPerSleeveXp: 100,
    /** Sleeve XP per batch. */
    sleeveXpPerGrant: 1,
    /** Default action level rule (levels start at 0): level 1 at 10 XP, then x2 per level. */
    actionLevels: { firstLevelXp: 10, growthFactor: 2 },
    /** Default sleeve level rule of every action (levels start at 0): level 1 at 10 sleeve XP, then x2 per level. */
    sleeveLevels: { firstLevelXp: 10, growthFactor: 2 },
    /** Credits at the start and after a re-sleeve. */
    startingCredits: 0,
    /** Sleeve-XP reduction buyables can never cut a requirement by more than 99% in total. */
    maxSleeveXpReduction: 0.99,
  },

  speed: {
    /** Speed multiplier of an action level: linear 0.05 per level means +5% of the base speed per level (level 0 is worth exactly 1). */
    actionLevel: { kind: 'linear', perLevel: 0.05 },
    /** Speed multiplier of the sleeve level. */
    sleeveLevel: { kind: 'linear', perLevel: 0.05 },
  },

  /** Broad levers: 1 = unchanged. E.g. speedMultiplier 2 makes everything twice as fast. */
  global: {
    speedMultiplier: 1,
    creditMultiplier: 1,
    xpMultiplier: 1,
    costMultiplier: 1,
  },

  sleeve: {
    /** Access level of a new sleeve. Actions with a higher requiredAccessLevel stay locked. */
    baseAccessLevel: 1,
    /** Interface speed of a new sleeve (0.1): multiplies the speed of every action. */
    baseInterfaceSpeed: 0.1,
    /** Interface speed earned by actions is applied as scale * ((1 + earned)^exponent - 1) / exponent: the first runs count in full. */
    earnedSpeedScale: 1,
    /** 0.25: strongly diminishing returns, no ceiling (1 = straight line, 0 = logarithm). */
    earnedSpeedExponent: 0.25,
    /** From 1 Hacking Proficiency on, the curve changes shape... */
    earnedSpeedKnee: 1,
    /** ...to 0.1: past the knee each further point is worth even less (it joins the first piece smoothly, so nothing jumps). */
    earnedSpeedExponentBeyond: 0.1,
    /** Heat of a new sleeve. */
    baseHeat: 0,
    /** Each point of heat takes 1% of the credits network nodes produce. */
    heatTaxPerPoint: 0.01,
    /** Time of one heat cooldown cycle (ms): 60 s. */
    heatCooldownMs: 60_000,
    /** Heat removed per completed cooldown cycle. */
    heatCooldownAmount: 1,
    /** ICE Rating of a new sleeve. */
    baseIceRating: 1,
    /** Share of the heat effect removed per order of magnitude of ICE Rating: 0.5%, so 100% at 1e200. */
    iceRatingReductionPerOrder: 0.005,
    /** Each point of Legend makes heat cool 10% faster. */
    legendHeatSpeedup: 0.1,
    /** Legend falls by 1 every 10 minutes. */
    legendDecayPeriodMs: 600_000,
  },

  network: {
    /** Credits each network node produces per second. */
    creditsPerNodePerSecond: 0.01,
  },

  engine: {
    /** Safety cap on run batches per action per tick (a batch is the stretch of runs between two level changes). */
    maxBatchesPerTick: 1_000,
    /** Longest stretch simulated in one go (ms); longer ticks are sliced. */
    maxSliceMs: 1_000,
    /** Most slices per tick; bounds the cost of very long ticks. */
    maxSlicesPerTick: 64,
    /** A run never takes less than a thousandth of a millisecond, whatever the speed. */
    minRunDurationMs: 0.001,
  },

  runtime: {
    /** Interval between game steps (ms). */
    stepMs: 50,
    /** Shortest interval between screen refreshes (ms). */
    renderMs: 100,
    /** Largest real-time gap simulated in one step (ms): 10 minutes. */
    maxDeltaMs: 10 * 60 * 1000,
    /** Interval between autosaves (ms). */
    autosaveMs: 10_000,
    /** Time multiplier of the fast-forward test toggle. */
    fastForwardFactor: 10,
  },
};
