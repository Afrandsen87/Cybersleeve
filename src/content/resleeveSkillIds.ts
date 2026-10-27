/**
 * @module content
 *
 * Ids of the re-sleeve skills and of the four branches (lanes) they are drawn in. Re-exported by `ids.ts`, so callers keep importing from there.
 */

/** Branch id of the re-sleeve lane about what a re-sleeve no longer wipes (its title is in `ui/uiText.ts`, its colour in `ui/style.css`). */
export const BRANCH_RETENTION = 'retention';
/** Branch id of the re-sleeve lane about reach: XP, access and focus. */
export const BRANCH_REACH = 'reach';
/** Branch id of the re-sleeve lane about synthetic sleeves. */
export const BRANCH_SYNTHETICS = 'synthetics';
/** Branch id of the re-sleeve lane about the corporation. */
export const BRANCH_CORPORATION = 'corporation';

/** Id of the retention skill that buys back last life's action purchases as soon as they are affordable. */
export const SKILL_REFLEX_ARCHIVE = 'skill-reflex-archive';
/** Id of the retention skill that keeps the Automation tab through a re-sleeve. */
export const SKILL_DAEMON_PERSISTENCE = 'skill-daemon-persistence';
/** Id of the retention skill that carries a share of Hacking Proficiency into the next life. */
export const SKILL_RESIDUAL_PROFICIENCY = 'skill-residual-proficiency';
/** Id of the retention skill that carries a share of ICE Rating into the next life. */
export const SKILL_RESIDUAL_FIREWALL = 'skill-residual-firewall';

/** Id of the re-sleeve skill that lowers the XP every action level needs, by the action's own sleeve level. */
export const SKILL_SLEEVE_EUPHORIA = 'skill-sleeve-euphoria';
/** Id of the reach skill that lets Faster conditioning go five runs further. */
export const SKILL_DEEP_CONDITIONING = 'skill-deep-conditioning';
/** Id of the reach skill that allows one more Access upgrade. */
export const SKILL_CLEARANCE_ESCALATION = 'skill-clearance-escalation';
/** Id of the reach skill that lets several Focus slots sit on one action. */
export const SKILL_OVERDRIVE_CAP = 'skill-overdrive-cap';

/** Id of the re-sleeve skill that gives synthetic sleeves. */
export const SKILL_SYNTHETIC_SLEEVES = 'skill-synthetic-sleeves';
/** Id of the synthetics skill that gives two synthetic sleeves per re-sleeve. */
export const SKILL_CLONING_VATS = 'skill-cloning-vats';
/** Id of the synthetics skill that raises interface speed with the number of synthetic sleeves. */
export const SKILL_HIVE_INTERFACE = 'skill-hive-interface';
/** Id of the synthetics skill that boosts the action XP of an action that is behind the best synthetic sleeve. */
export const SKILL_NEURAL_MIRROR = 'skill-neural-mirror';
/** Id of the synthetics end skill that makes every synthetic sleeve earn what the network earns now. */
export const SKILL_PERFECT_COPIES = 'skill-perfect-copies';

/** Id of the re-sleeve skill that opens the Corporation tab. */
export const SKILL_INCORPORATION = 'skill-incorporation';
/** Id of the corporation skill that speeds up corporation actions with the number of synthetic sleeves. */
export const SKILL_SYNTHETIC_WORKERS = 'skill-synthetic-workers';
/** Id of the corporation skill that unlocks buying synthetic sleeves on the Corporation tab. */
export const SKILL_SYNTHETIC_PROCUREMENT = 'skill-synthetic-procurement';

/** Every re-sleeve skill id, lane by lane (retention, reach, synthetics, corporation), each root first. */
export const RESLEEVE_SKILLS = [
  SKILL_REFLEX_ARCHIVE,
  SKILL_DAEMON_PERSISTENCE,
  SKILL_RESIDUAL_PROFICIENCY,
  SKILL_RESIDUAL_FIREWALL,
  SKILL_SLEEVE_EUPHORIA,
  SKILL_DEEP_CONDITIONING,
  SKILL_CLEARANCE_ESCALATION,
  SKILL_OVERDRIVE_CAP,
  SKILL_SYNTHETIC_SLEEVES,
  SKILL_CLONING_VATS,
  SKILL_HIVE_INTERFACE,
  SKILL_NEURAL_MIRROR,
  SKILL_PERFECT_COPIES,
  SKILL_INCORPORATION,
  SKILL_SYNTHETIC_WORKERS,
  SKILL_SYNTHETIC_PROCUREMENT,
] as const;
