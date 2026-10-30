/**
 * @module core
 *
 * The automation settings' part of a save (wallet `automation`, and Auto Burn's per-life part, sleeve `autoBurn`).
 */
import { isRecord, readCount } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig } from '../types';
import { type AUTOMATION_FEATURES, isFeatureUnlocked } from './automation';
import { AUTO_BURN_SWITCHES } from './autoBurnTypes';

/**
 * Reads the automation settings (a feature is unlocked when its skill is owned, so this part runs after the purchases are read): the Burn lead
 * toggle is on only when Auto Burn is unlocked, the thresholds must be finite with 0 <= lower < upper, the reserve a whole number >= 0, switches
 * are kept as saved (a switch only counts once its skill is owned), and autosale and dispersal keep only known rarities and actions (shares
 * clamped to 1..100). Anything missing loads fresh.
 *
 * A save written before the Auto Burn lane had real skills (`autoBurnOn: true`, `autoBurnCeiling`) loads with the Burn lead toggle on and the
 * old ceiling as the lower threshold.
 *
 * Called by: `save/saveParts.ts`. Calls: `isFeatureUnlocked`.
 */
export const automationSavePart: SavePart<Pick<GameConfig, 'automation' | 'buyables' | 'items' | 'actions'>> = {
  name: 'automation',
  write: (state) => {
    const { automation } = state.wallet;
    const life = state.sleeve.autoBurn;
    return {
      wallet: {
        automation: {
          autoBurn: { ...automation.autoBurn, switches: { ...automation.autoBurn.switches } },
          autosale: { ...automation.autosale },
          dispersal: { ...automation.dispersal },
        },
      },
      sleeve: {
        autoBurn: { on: life.on, seconds: life.seconds, overclocksOff: { ...life.overclocksOff }, autoRunsOff: { ...life.autoRunsOff } },
      },
    };
  },
  read: (state, saved, config) => {
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
    for (const name of AUTO_BURN_SWITCHES) auto.autoBurn.switches[name] = savedSwitches[name] === true;
    const life = state.sleeve.autoBurn;
    const savedLife = isRecord(saved.sleeve['autoBurn']) ? saved.sleeve['autoBurn'] : {};
    life.on = (savedLife['on'] === true || raw['autoBurnOn'] === true) && unlocked('autoBurn');
    const seconds = savedLife['seconds'];
    life.seconds = finite(seconds) && seconds >= 0 && seconds < 1 ? seconds : 0;
    const keep = (from: unknown, into: Record<string, true>, known: (id: string) => boolean): void => {
      if (isRecord(from)) for (const id of Object.keys(from)) if (from[id] === true && known(id)) into[id] = true;
    };
    keep(savedLife['overclocksOff'], life.overclocksOff, (id) => config.actions.some((a) => a.id === id));
    keep(savedLife['autoRunsOff'], life.autoRunsOff, (id) => config.buyables.some((b) => b.id === id && b.effect.kind === 'autoRun'));
    const savedSale = isRecord(raw['autosale']) ? raw['autosale'] : {};
    const savedShares = isRecord(raw['dispersal']) ? raw['dispersal'] : {};
    if (unlocked('autosale')) for (const r of config.items.rarities) if (savedSale[r.id] === true) auto.autosale[r.id] = true;
    if (unlocked('dispersal')) {
      let room = 100;
      for (const a of config.actions) {
        const share = savedShares[a.id];
        if (typeof share !== 'number' || !Number.isFinite(share) || share <= 0 || room <= 0) continue;
        auto.dispersal[a.id] = Math.min(room, share);
        room -= auto.dispersal[a.id] ?? 0;
      }
    }
  },
};
