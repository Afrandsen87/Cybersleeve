/**
 * @module core
 *
 * The automation settings' part of a save (wallet `automation`, and Auto Burn's per-life part, sleeve `autoBurn`).
 */
import { actionIsUnlocked } from '../kernel/actionAccess';
import { resolveSleeveStats } from '../effects/effects';
import { dispersalSlots } from './dispersalSlots';
import { allowedRarities } from './rarityPermissions';
import { heatMakingAutoRuns, overclockMakesHeat } from '../heat/heatMakers';
import { isRecord, readCount } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig } from '../types';
import { type AUTOMATION_FEATURES, isFeatureUnlocked } from './automation';
import { ownsAutoBurnStep } from './autoBurnRules';
import { AUTO_BURN_SWITCHES } from './autoBurnTypes';

/**
 * Reads the automation settings (a feature is unlocked when its skill is owned, so this part runs after the purchases are read): the Burn lead
 * toggle is on only when Auto Burn is unlocked, the thresholds must be finite with 0 <= lower < upper, the reserve a whole number >= 0, switches
 * are kept only for skills that are owned. Automation context: autosale and auto backchannel keep only known, skill-allowed rarities; dispersalTargets keeps known available actions in configuration order, capped by owned slots.
 * The old dispersal percentage map is ignored; the new field is omitted while empty. Anything missing loads fresh. The new Back Channel map defaults off; no saved field changes meaning.
 * Purchases have already discarded unknown ids (including removed slots 9/10); derived points refund those costs.
 *
 * A save written before the Auto Burn lane had real skills (`autoBurnOn: true`, `autoBurnCeiling`) loads with the Burn lead toggle on, the
 * Hold switch on when its skill is owned (the old meaning was "hold heat at the ceiling") and the old ceiling as the lower threshold.
 * The records of what Auto Burn switched off, and the resume checklists (`resumeOverclocks`, `resumeAutoRuns`), keep only heat-making Overclocks and Auto-runs of heat-making actions. The resume lists and `upperArmed` are saved
 * only when not empty / false (missing loads true: a life starts below the upper threshold).
 *
 * Called by: `save/saveParts.ts`. Calls: `allowedRarities`, `isFeatureUnlocked`, `overclockMakesHeat`, `heatMakingAutoRuns`.
 */
export const automationSavePart: SavePart<Pick<GameConfig, 'automation' | 'buyables' | 'items' | 'actions' | 'sleeve'>> = {
  name: 'automation',
  write: (state) => {
    const { automation } = state.wallet;
    const life = state.sleeve.autoBurn;
    return {
      wallet: {
        automation: {
          autoBurn: {
            lower: automation.autoBurn.lower,
            upper: automation.autoBurn.upper,
            reserve: automation.autoBurn.reserve,
            switches: { ...automation.autoBurn.switches },
            ...(Object.keys(automation.autoBurn.resumeOverclocks).length > 0
              ? { resumeOverclocks: { ...automation.autoBurn.resumeOverclocks } }
              : {}),
            ...(Object.keys(automation.autoBurn.resumeAutoRuns).length > 0
              ? { resumeAutoRuns: { ...automation.autoBurn.resumeAutoRuns } }
              : {}),
          },
          autosale: { ...automation.autosale },
          ...(Object.keys(automation.autoBackchannel).length ? { autoBackchannel: { ...automation.autoBackchannel } } : {}),
          ...(automation.dispersalTargets.length ? { dispersalTargets: [...automation.dispersalTargets] } : {}),
        },
      },
      sleeve: {
        autoBurn: {
          on: life.on,
          seconds: life.seconds,
          ...(life.upperArmed ? {} : { upperArmed: false }),
          overclocksOff: { ...life.overclocksOff },
          autoRunsOff: { ...life.autoRunsOff },
        },
      },
    };
  },
  read: (state, saved, config, factory) => {
    const raw = saved.wallet['automation'];
    if (config.automation === undefined || !isRecord(raw)) return;
    const unlocked = (feature: (typeof AUTOMATION_FEATURES)[number]): boolean =>
      isFeatureUnlocked(config.buyables, state.sleeve.purchased, feature);
    const auto = state.wallet.automation;
    const savedBurn = isRecord(raw['autoBurn']) ? raw['autoBurn'] : {};
    const lower = savedBurn['lower'] ?? raw['autoBurnCeiling']; // the older save kept the lower threshold under its old name
    const upper = savedBurn['upper'];
    const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    if (finite(lower) && lower >= 0) auto.autoBurn.lower = lower;
    if (finite(upper) && upper > auto.autoBurn.lower) auto.autoBurn.upper = upper;
    if (auto.autoBurn.upper <= auto.autoBurn.lower) auto.autoBurn.upper = auto.autoBurn.lower + 1;
    auto.autoBurn.reserve = Math.min(readCount(savedBurn['reserve']), Number.MAX_SAFE_INTEGER);
    const savedSwitches = isRecord(savedBurn['switches']) ? savedBurn['switches'] : {};
    for (const name of AUTO_BURN_SWITCHES) {
      // a switch counts only with its skill
      auto.autoBurn.switches[name] =
        savedSwitches[name] === true && unlocked('autoBurn') && ownsAutoBurnStep(config.buyables, state.sleeve.purchased, name);
    }
    const legacyOn = raw['autoBurnOn'] === true && unlocked('autoBurn');
    if (legacyOn && ownsAutoBurnStep(config.buyables, state.sleeve.purchased, 'hold')) auto.autoBurn.switches.hold = true;
    const life = state.sleeve.autoBurn;
    const savedLife = isRecord(saved.sleeve['autoBurn']) ? saved.sleeve['autoBurn'] : {};
    life.on = (savedLife['on'] === true && unlocked('autoBurn')) || legacyOn;
    life.upperArmed = savedLife['upperArmed'] !== false;
    const seconds = savedLife['seconds'];
    life.seconds = finite(seconds) && seconds >= 0 && seconds < 1 ? seconds : 0;
    const keep = (from: unknown, into: Record<string, true>, known: (id: string) => boolean): void => {
      if (isRecord(from)) for (const id of Object.keys(from)) if (from[id] === true && known(id)) into[id] = true;
    };
    const heatOverclock = (id: string): boolean => config.actions.some((a) => a.id === id && overclockMakesHeat(a));
    const heatAutoRuns = new Set(heatMakingAutoRuns(config.buyables, config.actions));
    keep(savedLife['overclocksOff'], life.overclocksOff, heatOverclock);
    keep(savedLife['autoRunsOff'], life.autoRunsOff, (id) => heatAutoRuns.has(id));
    keep(savedBurn['resumeOverclocks'], auto.autoBurn.resumeOverclocks, heatOverclock);
    keep(savedBurn['resumeAutoRuns'], auto.autoBurn.resumeAutoRuns, (id) => heatAutoRuns.has(id));
    const savedSale = isRecord(raw['autosale']) ? raw['autosale'] : {};
    const savedTargets = Array.isArray(raw['dispersalTargets']) ? raw['dispersalTargets'] : [];
    for (const id of allowedRarities(config, state.sleeve.purchased, 'autosale')) if (savedSale[id] === true) auto.autosale[id] = true;
    const savedChannel = isRecord(raw['autoBackchannel']) ? raw['autoBackchannel'] : {};
    for (const id of allowedRarities(config, state.sleeve.purchased, 'autoBackchannel'))
      if (savedChannel[id] === true) auto.autoBackchannel[id] = true;
    if (unlocked('dispersal')) {
      const slots = dispersalSlots(config.buyables, state.sleeve.purchased);
      const accessLevel = resolveSleeveStats(config.buyables, state, config.sleeve, factory).accessLevel;
      auto.dispersalTargets = config.actions
        .filter((a) => savedTargets.includes(a.id) && actionIsUnlocked(a, accessLevel))
        .slice(0, slots)
        .map((a) => a.id);
    }
  },
};
