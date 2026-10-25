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
import type { GameConfig } from '../core';

/** Id of the first action. */
export const PRACTICE_HACKING = 'practice-hacking';
/** Id of the network-building action. */
export const GROW_NETWORK = 'grow-network';
/** Id of the malware action (needs access level 2). */
export const PUSH_MALWARE = 'push-malware';
/** Id of the server-killing action (needs access level 4). */
export const KILL_SERVERS = 'kill-servers';
/** Id of the legend action (needs access level 5). */
export const LEGEND = 'legend';
/** Id of the global interface-speed buyable. */
export const INTERFACE_BOOST = 'interface-boost';
/** Id of the global access-level buyable. */
export const ACCESS_UPGRADE = 'access-upgrade';
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
    ],
    /**
     * One Augment schematic applied to an action adds 1% to the action XP boost of ITS rarity (additively); the boosts of the
     * different rarities multiply. Sleeve XP is not affected.
     */
    augment: { itemId: AUGMENT_SCHEMATIC, xpBonusPerItem: 0.01 },
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
    },
    {
      id: PRACTICE_HACKING,
      name: 'Practice Hacking',
      /** Time per run at speed x1: 5 s, so a run takes 50 s at the starting interface speed of 0.1 (it was 1 s, 10 s in practice, until 2026-10-25). */
      baseDurationMs: 5_000,
      /** Added to Hacking Proficiency per completed run (no credits). Proficiency raises the hacking multiplier on interface speed. */
      reward: num(0.001),
      rewardKind: 'hackingProficiency',
      /** Action XP per completed run. */
      /** Locked until the sleeve has access level 2 (the first Access upgrade). */
      requiredAccessLevel: 2,
      xpPerRun: num(1),
      // Optional per-action overrides (fall back to the global rules below):
      //   levels: { firstLevelXp: 10, growthFactor: 10 },
      //   speedScaling: { kind: 'linear', perLevel: 0.05 },
    },
    {
      id: PUSH_MALWARE,
      name: 'Push malware',
      /** Seconds per run at speed x1. */
      baseDurationMs: 6_000,
      /** Added to the BASE credits per second of every node per completed run (no credits of its own): 0.000001, i.e. 0.01% of the starting base of 0.01. */
      reward: num(0.000001),
      rewardKind: 'nodePayout',
      /** Heat added per completed run. */
      heatPerRun: 1,
      /** Access level the sleeve needs to perform this action. */
      requiredAccessLevel: 3,
      /** Action XP per completed run. */
      xpPerRun: num(1),
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
    },
    {
      id: LEGEND,
      name: 'Build Legend',
      /** Seconds per run at speed x1: 5 minutes. */
      baseDurationMs: 300_000,
      /** Infamy gained per completed run (no credits). */
      reward: num(1),
      rewardKind: 'infamy',
      /** Access level the sleeve needs to perform this action. */
      requiredAccessLevel: 5,
      /** Heat added per completed run. */
      heatPerRun: 50,
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
      cost: num(1_000),
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
      description: 'Every order of magnitude of Hacking Proficiency moves 1% of each drop ratio to the next rarity.',
      formula: 'Shifts = floor(log10(Hacking Proficiency))',
      actionId: PRACTICE_HACKING,
      cost: num(150_000),
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
      cost: num(100),
      effect: { kind: 'autoRun' },
    },
    {
      id: NETWORK_OUTPUT,
      name: 'Parallel nodes',
      symbol: '×2',
      description: 'Doubles the nodes each run pays. Each copy costs 1000x more.',
      actionId: GROW_NETWORK,
      cost: num(500),
      costGrowth: 1_000, // every 3rd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'rewardMultiplier', factor: 2 },
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
      cost: num(10_000_000),
      effect: { kind: 'autoRun' },
    },
    {
      id: MALWARE_OUTPUT,
      name: 'Malware payload',
      symbol: '×2',
      description: 'Doubles what each run adds to the base payout of every node. Each copy costs 10,000x more.',
      actionId: PUSH_MALWARE,
      cost: num(50_000),
      costGrowth: 10_000, // every 4th order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'rewardMultiplier', factor: 2 },
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
      id: LEGEND_AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes.',
      actionId: LEGEND,
      cost: num(1e15), // 1 Qa
      effect: { kind: 'autoRun' },
    },
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
      symbol: 'NS',
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
    // Global (sleeve) buyables: no actionId; they change the sleeve's stats. Prices are placeholders.
    {
      id: ICE_RATING_BOOST,
      name: 'ICE Rating boost',
      symbol: 'CB',
      description: 'Multiplies ICE Rating by 2. Each copy costs 100x more.',
      cost: num(250_000),
      costGrowth: 100, // every 2nd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'iceRatingMultiplier', factor: 2 },
    },
    {
      id: NODE_PAYOUT,
      name: 'Node payout',
      symbol: 'NP',
      description: 'Each node produces 50% more credits. Paid in network nodes. Each copy costs 100x more.',
      currency: 'networkNodes',
      cost: num(25),
      costGrowth: 100, // every 2nd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'nodePayoutMultiplier', factor: 1.5 },
    },
    {
      id: NODE_UPLINK,
      name: 'Node uplink',
      symbol: 'NU',
      description: 'Raises the base interface speed by 0.1. Paid in network nodes. Each copy costs 100,000x more.',
      currency: 'networkNodes',
      cost: num(100),
      costGrowth: 100_000, // every 5th order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'interfaceSpeed', amount: 0.1 },
    },
    {
      id: INTERFACE_BOOST,
      name: 'Interface boost',
      symbol: 'IF',
      description: 'Raises the base interface speed by 0.05, which speeds up every action. Each copy costs 1000x more.',
      cost: num(100),
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
  ],

  progression: {
    /** Completed runs of one action per batch of that action's sleeve XP. */
    runsPerSleeveXp: 100,
    /** Sleeve XP per batch. */
    sleeveXpPerGrant: 1,
    /** Default action level rule (levels start at 0): level 1 at 10 XP, then x10 per level. */
    actionLevels: { firstLevelXp: 10, growthFactor: 10 },
    /** Default sleeve level rule of every action (levels start at 0): level 1 at 10 sleeve XP, then x10 per level. */
    sleeveLevels: { firstLevelXp: 10, growthFactor: 10 },
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
    /** Each point of Infamy makes heat cool 10% slower. */
    infamyHeatSlowdown: 0.1,
    /** Infamy falls by 1 every 10 minutes. */
    infamyDecayPeriodMs: 600_000,
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
