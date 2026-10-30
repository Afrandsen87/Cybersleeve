/**
 * Guards for the REAL Forensic hardening content (Kill servers critical successes feed Hardened payload). Invariants only, never tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { flat } from '../testing/flatState';
import { buildViewModel } from '../ui/viewModel';
import {
  CASCADE_FAILURE,
  CREDIT_SIPHON,
  CRITICAL_SUCCESS,
  FORENSIC_HARDENING,
  gameConfig,
  KILL_SERVERS,
  MALWARE_ICE,
  PUSH_MALWARE,
} from './gameConfig';
import { ENTITY_ICONS } from './icons';

const def = gameConfig.buyables.find((b) => b.id === FORENSIC_HARDENING)!;
const price = (id: string) => gameConfig.buyables.find((b) => b.id === id)!.cost;

describe('Forensic hardening (real content)', () => {
  it('is a Kill servers purchase that listens to Kill servers and raises Push malware levels', () => {
    expect(def.actionId).toBe(KILL_SERVERS);
    expect(def.effect).toMatchObject({ kind: 'hardenedPayloadFromCrits', critActionId: KILL_SERVERS, levelActionId: PUSH_MALWARE });
  });

  it('stays hidden until critical successes and Hardened payload exist, because its text speaks of both', () => {
    expect(def.requires).toEqual(expect.arrayContaining([CRITICAL_SUCCESS, MALWARE_ICE]));
    expect(createGame().isBuyableAvailable(FORENSIC_HARDENING)).toBe(false);
  });

  it('is priced between Cascade failure and Credit Siphon, and has an icon', () => {
    expect(def.cost.gt(price(CASCADE_FAILURE))).toBe(true);
    expect(def.cost.lt(price(CREDIT_SIPHON))).toBe(true);
    expect(ENTITY_ICONS[FORENSIC_HARDENING]).toBeDefined();
  });

  it('its tooltip shows the critical successes counted and the ICE Rating they added, from the owner', () => {
    const g = createGame();
    flat<{ hardeningCrits: number }>(g).hardeningCrits = 12;
    (g.getState().sleeve.purchased as Record<string, number>)[FORENSIC_HARDENING] = 1;
    const tip = buildViewModel(g)
      .actions.find((a) => a.id === KILL_SERVERS)!
      .buyables.find((b) => b.id === FORENSIC_HARDENING)!.tip;
    expect(tip).toContain('Critical successes counted = 12');
    expect(tip).toContain('Extra ICE Rating per level = ');
  });
});
