/**
 * @module core
 *
 * The corporation's part of a save (wallet `corporations`, a map keyed by id with one entry).
 */
import { DEFAULT_CORPORATION_ID, type SavePart } from '../kernel/savePart';
import { isRecord } from '../kernel/readValues';
import type { GameConfig } from '../types';
import { readCorporationState, writeCorporationState } from './corporationState';

/**
 * The corporation part.
 *
 * Called by: `save/saveParts.ts`. Calls: {@link writeCorporationState}, {@link readCorporationState}.
 */
export const corporationSavePart: SavePart<Pick<GameConfig, 'corporation'>> = {
  name: 'corporation',
  write: (state) => ({ wallet: { corporations: { [DEFAULT_CORPORATION_ID]: writeCorporationState(state.wallet.corporation) } } }),
  read: (state, raw, config, factory) => {
    const corporations = isRecord(raw.wallet['corporations']) ? raw.wallet['corporations'] : {};
    state.wallet.corporation = readCorporationState(corporations[DEFAULT_CORPORATION_ID], config.corporation, factory);
  },
};
