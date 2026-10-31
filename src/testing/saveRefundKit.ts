/**
 * Shared save/synth refund setup on the fixed test content.
 * Called by: v10Migration and synthRefund tests. Calls: createConfig, createInitialState, resleeveSkill.
 */
import { createConfig, createInitialState, sleeveSkillIds as sleeveSkillIdsOf } from '../core';
import { num, numberFactory } from '../numbers';
import { automationLaneBuyables, laneSkillId } from './automationKit';
import { config as treeConfig, resleeveSkill } from './resleeveTreeKit';

/** Refund ids from configuration. Called by: refund tests. Calls: sleeveSkillIds (core). */
export const sleeveSkillIds = sleeveSkillIdsOf(treeConfig.buyables);
/** Fixed cap and bonus independent of real tuning. Called by: refund tests. Calls: createConfig, resleeveSkill. */
export const refundConfig = createConfig(treeConfig, {
  buyables: [
    ...treeConfig.buyables.map((b) => (b.id === 'access' ? { ...b, maxPurchases: 4 } : b)),
    resleeveSkill('cap', { kind: 'buyableCapBonus', targetId: 'access', extra: 1 }),
  ],
});
/** Finished runs, owned skills and unrelated data. Called by: refund tests. Calls: createInitialState. */
export function refundState() {
  const state = createInitialState(refundConfig, numberFactory);
  state.wallet.runs = Array.from({ length: 4 }, () => ({ creditsPerSecond: num(20), actionLevelsTotal: 0, sleeveLevelsTotal: 0 }));
  state.wallet.synths = [{ runIndex: 0 }, { runIndex: 2 }];
  state.sleeve.purchased = { eu: 1, syn: 1, cap: 1, access: 5, auto: 1 };
  state.wallet.revealed = ['skill:eu', 'skill:syn', 'skill:cap', 'buyable:auto', 'tab:stats', 'skill:auto', 'buyable:syn'];
  state.wallet.lastLifePurchases = { auto: 1 };
  return state;
}

/**
 * Audit fixture with corporation progress and automation settings behind their ordinary unlocks.
 * Called by: refund audit tests. Calls: createConfig, createInitialState, automationLaneBuyables.
 * @returns config and state with refundable retention/corporation skills and persistent data
 */
export function refundAuditSetup() {
  const config = createConfig(refundConfig, {
    buyables: [
      ...refundConfig.buyables,
      ...automationLaneBuyables(),
      resleeveSkill('retain', { kind: 'keepsAutomation' }),
      resleeveSkill('corp', { kind: 'unlocksCorporation' }),
      resleeveSkill('archive', { kind: 'autoRepurchase' }),
    ],
    automation: { autoBurnCeiling: 10, autoBurnUpper: 50 },
    corporation: { actions: [{ id: 'c', name: 'C', baseDurationMs: 1000, effects: [] }] },
  });
  const state = createInitialState(config, numberFactory);
  state.sleeve.purchased = {
    retain: 1,
    corp: 1,
    archive: 1,
    auto: 1,
    [laneSkillId('autosale', 1)]: 1,
    [laneSkillId('dispersal', 1)]: 1,
    [laneSkillId('autoBurn', 1)]: 1,
    [laneSkillId('autoBurn', 2)]: 1,
  };
  state.wallet.automation.autosale['common'] = true;
  state.wallet.automation.dispersalTargets = ['a'];
  state.wallet.automation.autoBurn.switches.hold = true;
  state.sleeve.autoBurn.on = true;
  state.wallet.corporation.stocks = 3;
  state.wallet.corporation.actions['c'] = { running: true, progress: 0.5, xp: num(17) };
  state.wallet.lastLifePurchases = { auto: 1 };
  state.wallet.lastLifeAutoRunOn = { auto: true };
  return { config, state };
}
