/**
 * @module content
 *
 * Icons of the newer re-sleeve skills: each id is given the name of an icon grid that already exists in `icons.ts`, as a placeholder
 * until a skill gets a picture of its own. Spread into `ENTITY_ICONS`.
 */
import {
  SKILL_CLEARANCE_ESCALATION,
  SKILL_CLONING_VATS,
  SKILL_DAEMON_PERSISTENCE,
  SKILL_DEEP_CONDITIONING,
  SKILL_HIVE_INTERFACE,
  SKILL_NEURAL_MIRROR,
  SKILL_OVERDRIVE_CAP,
  SKILL_PERFECT_COPIES,
  SKILL_REFLEX_ARCHIVE,
  SKILL_RESIDUAL_FIREWALL,
  SKILL_RESIDUAL_PROFICIENCY,
  SKILL_SYNTHETIC_PROCUREMENT,
  SKILL_SYNTHETIC_WORKERS,
} from './resleeveSkillIds';

/** The icon grid (a key of `ICON_GRIDS`) each newer re-sleeve skill borrows. */
export const RESLEEVE_SKILL_ICONS: Readonly<Record<string, string>> = {
  [SKILL_REFLEX_ARCHIVE]: 'auto-run',
  [SKILL_DAEMON_PERSISTENCE]: 'automation-core',
  [SKILL_RESIDUAL_PROFICIENCY]: 'skill-muscle-memory',
  [SKILL_RESIDUAL_FIREWALL]: 'ice-rating-boost',
  [SKILL_DEEP_CONDITIONING]: 'conditioning',
  [SKILL_CLEARANCE_ESCALATION]: 'access-upgrade',
  [SKILL_OVERDRIVE_CAP]: 'focus',
  [SKILL_CLONING_VATS]: 'skill-synthetic-sleeves',
  [SKILL_HIVE_INTERFACE]: 'network-synergy',
  [SKILL_NEURAL_MIRROR]: 'skill-neural-accelerant',
  [SKILL_PERFECT_COPIES]: 'skill-synthetic-sleeves',
  [SKILL_SYNTHETIC_WORKERS]: 'skill-incorporation',
  [SKILL_SYNTHETIC_PROCUREMENT]: 'credit-chip',
};
