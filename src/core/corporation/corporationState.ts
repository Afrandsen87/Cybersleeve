/**
 * @module core
 *
 * Creating, saving and reading the {@link CorporationState}.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import type { CorporationConfig, CorporationState } from './corporationTypes';

/**
 * The state of a corporation that has not done anything: every action idle.
 *
 * Called by: `state.ts` (`createInitialState`), {@link readCorporationState}.
 *
 * @param config the corporation's content (`undefined` for a game without one)
 * @param factory number factory (for the XP)
 * @returns a fresh state with one idle entry per corporation action
 */
export function createCorporationState(config: CorporationConfig | undefined, factory: NumberFactory): CorporationState {
  const actions: CorporationState['actions'] = {};
  for (const a of config?.actions ?? []) actions[a.id] = { running: false, progress: 0, xp: factory.fromNumber(0) };
  return { actions, stocks: 0 };
}

/**
 * The part of a save that holds the corporation: plain data.
 *
 * Called by: `serialization.ts`.
 *
 * @param state the corporation state
 */
export function writeCorporationState(state: CorporationState): {
  stocks: number;
  actions: Record<string, { running: boolean; progress: number; xp: string }>;
} {
  return {
    stocks: state.stocks,
    actions: Object.fromEntries(
      Object.entries(state.actions).map(([id, a]) => [id, { running: a.running, progress: a.progress, xp: a.xp.toString() }]),
    ),
  };
}

/**
 * Reads the corporation back from a save. Anything missing or unusable (a save from before the corporation existed, an action that
 * is no longer in the content, a progress outside 0..1) falls back to the idle state of that action.
 *
 * Called by: `serialization.ts` (`deserializeState`).
 *
 * @param saved the stored value, whatever it is
 * @param config the corporation's content (decides which actions are read)
 * @param factory number factory (for the XP; a save without XP reads as 0)
 * @returns the restored state
 */
export function readCorporationState(saved: unknown, config: CorporationConfig | undefined, factory: NumberFactory): CorporationState {
  const state = createCorporationState(config, factory);
  const stocks = isRecord(saved) ? Number(saved['stocks']) : 0;
  state.stocks = Number.isSafeInteger(stocks) && stocks > 0 ? stocks : 0;
  const savedActions = isRecord(saved) && isRecord(saved['actions']) ? saved['actions'] : {};
  for (const def of config?.actions ?? []) {
    const entry = savedActions[def.id];
    if (!isRecord(entry)) continue;
    const progress = Number(entry['progress']);
    state.actions[def.id] = {
      running: entry['running'] === true,
      progress: Number.isFinite(progress) && progress > 0 && progress < 1 ? progress : 0,
      xp: readXp(entry['xp'], factory),
    };
  }
  return state;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reads saved XP: a finite number or numeric string >= 0, otherwise 0. */
function readXp(v: unknown, factory: NumberFactory): BigNum {
  const zero = factory.fromNumber(0);
  if (typeof v !== 'string' && typeof v !== 'number') return zero;
  try {
    const xp = factory.fromString(String(v));
    return xp.isFinite() && !xp.isNegative() ? xp : zero;
  } catch {
    return zero;
  }
}
