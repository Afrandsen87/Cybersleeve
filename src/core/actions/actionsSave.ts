/**
 * @module core
 *
 * The actions' parts of a save (sleeve `actions`, `autoRunOff`, `overclocked`, `focused`, `focusStacks`, `chains`).
 */
import type { NumberFactory } from '../../numbers';
import { traitsOf } from '../effects/effectTraits';
import { isRecord, readAmount, readCount, readProgress } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig, GameState } from '../types';

/** Reads the augments applied to an action: only known rarities, whole counts above 0 (anything else is an empty record). */
function readAugments(v: unknown, items: GameConfig['items']): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const rarity of items.rarities) {
    const count = Math.min(readCount(v[rarity.id]), Number.MAX_SAFE_INTEGER);
    if (count > 0) out[rarity.id] = count;
  }
  return out;
}

/** Reads the per-action progress: only known actions; the run counter is kept below `runsPerSleeveXp`. */
function readActions(
  state: GameState,
  raw: unknown,
  config: Pick<GameConfig, 'actions' | 'items' | 'progression'>,
  factory: NumberFactory,
): void {
  const saved = isRecord(raw) ? raw : {};
  for (const def of config.actions) {
    const entry = saved[def.id];
    if (!isRecord(entry)) continue;
    state.sleeve.actions[def.id] = {
      xp: readAmount(entry['xp'], factory),
      sleeveXp: readAmount(entry['sleeveXp'], factory),
      runsTowardSleeveXp: readCount(entry['runsTowardSleeveXp']) % config.progression.runsPerSleeveXp,
      augments: readAugments(entry['augments'], config.items),
      skillShards: Math.min(readCount(entry['skillShards']), Number.MAX_SAFE_INTEGER),
      running: entry['running'] === true,
      progress: readProgress(entry['progress']),
    };
  }
}

/**
 * The per-action progress part.
 *
 * Called by: `save/saveParts.ts`. Calls: `readAmount`, `readCount`, `readProgress`.
 */
export const actionsSavePart: SavePart<Pick<GameConfig, 'actions' | 'items' | 'progression'>> = {
  name: 'actions',
  write: (state) => ({
    sleeve: {
      actions: Object.fromEntries(
        Object.entries(state.sleeve.actions).map(([id, a]) => [
          id,
          {
            xp: a.xp.toString(),
            sleeveXp: a.sleeveXp.toString(),
            runsTowardSleeveXp: a.runsTowardSleeveXp,
            augments: { ...a.augments },
            skillShards: a.skillShards,
            running: a.running,
            progress: a.progress,
          },
        ]),
      ),
    },
  }),
  read: (state, raw, config, factory) => readActions(state, raw.sleeve['actions'], config, factory),
};

/**
 * The auto-run switches part: only toggleable buyables that are saved as off.
 *
 * Called by: `save/saveParts.ts`. Calls: `traitsOf`.
 */
export const autoRunSavePart: SavePart<Pick<GameConfig, 'buyables'>> = {
  name: 'autoRun',
  write: (state) => ({ sleeve: { autoRunOff: { ...state.sleeve.autoRunOff } } }),
  read: (state, raw, config) => {
    const savedOff = isRecord(raw.sleeve['autoRunOff']) ? raw.sleeve['autoRunOff'] : {};
    for (const b of config.buyables) if (traitsOf(b).toggleable && savedOff[b.id] === true) state.sleeve.autoRunOff[b.id] = true;
  },
};

/**
 * The Overclock and Focus part (switches, Focus stacks, Overclock chains). Must be read after the purchases.
 *
 * A toggle is kept only for a known action saved as `true` whose unlock is owned (Overclock also needs the action to have an Overclock rule),
 * and Focus only up to the number of Focus slots (`focus.baseSlots` plus the bought ones, in configuration order), so a save cannot switch on
 * more than the player has bought. A chain is kept only for an action that owns a chain buyable, never longer than its rule allows.
 *
 * Called by: `save/saveParts.ts`. Calls: `readCount`.
 */
export const togglesSavePart: SavePart<Pick<GameConfig, 'actions' | 'buyables' | 'focus'>> = {
  name: 'toggles',
  write: (state) => ({
    sleeve: {
      overclocked: { ...state.sleeve.overclocked },
      focused: { ...state.sleeve.focused },
      focusStacks: { ...state.sleeve.focusStacks },
      chains: { ...state.sleeve.chains },
    },
  }),
  read: (state, raw, config) => {
    const sleeve = state.sleeve;
    const rawSleeve = raw.sleeve;
    const savedOverclock = isRecord(rawSleeve['overclocked']) ? rawSleeve['overclocked'] : {};
    const savedFocus = isRecord(rawSleeve['focused']) ? rawSleeve['focused'] : {};
    const unlocked = (kind: string, actionId: string): boolean =>
      config.buyables.some((b) => b.effect.kind === kind && b.actionId === actionId && (sleeve.purchased[b.id] ?? 0) > 0);
    const savedStacks = isRecord(rawSleeve['focusStacks']) ? rawSleeve['focusStacks'] : {};
    const stacking = config.buyables.some((b) => b.effect.kind === 'focusStacking' && (sleeve.purchased[b.id] ?? 0) > 0);
    let slots =
      config.focus.baseSlots +
      config.buyables.reduce((n, b) => (b.effect.kind === 'focusSlots' ? n + b.effect.perCopy * (sleeve.purchased[b.id] ?? 0) : n), 0);
    for (const def of config.actions) {
      if (def.overclock && unlocked('overclockUnlock', def.id) && savedOverclock[def.id] === true) sleeve.overclocked[def.id] = true;
      if (slots > 0 && unlocked('focusUnlock', def.id) && savedFocus[def.id] === true) {
        sleeve.focused[def.id] = true;
        slots--;
        // extra slots on the same action only with the stacking skill, and never more than the slots that are left
        const stacks = stacking ? Math.min(readCount(savedStacks[def.id]), slots) : 0;
        if (stacks > 0) sleeve.focusStacks[def.id] = stacks;
        slots -= stacks;
      }
    }
    const savedChains = isRecord(rawSleeve['chains']) ? rawSleeve['chains'] : {};
    for (const def of config.actions) {
      const rule = config.buyables.find(
        (b) => b.effect.kind === 'overclockChain' && b.actionId === def.id && (sleeve.purchased[b.id] ?? 0) > 0,
      );
      const links = Math.min(readCount(savedChains[def.id]), rule?.effect.kind === 'overclockChain' ? rule.effect.chain.maxLinks : 0);
      if (links > 0) sleeve.chains[def.id] = links;
    }
  },
};
