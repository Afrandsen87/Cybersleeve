/**
 * @module testing
 *
 * Invariants of the automation settings: points, Auto Burn, autosale and dispersal.
 */
import {
  type AUTOMATION_FEATURES,
  AUTO_BURN_SWITCHES,
  automationPointsEarned,
  heatMakingAutoRuns,
  isFeatureUnlocked,
  overclockMakesHeat,
  ownsAutoBurnStep,
} from '../../core';
import { allowedRarities } from '../../core/automation/rarityPermissions';
import type { InvariantCheck } from './shared';

/**
 * Points spent are within points earned; Auto Burn's thresholds, reserve, switches, toggle, seconds and records are valid; autosale and
 * dispersal are set only when unlocked and name known rarities and actions.
 *
 * Called by: `testing/invariants.ts`. Calls: `automationPointsEarned`, `isFeatureUnlocked`, `ownsAutoBurnStep`.
 */
export const checkAutomation: InvariantCheck = (state, config, problems) => {
  const auto = state.wallet.automation;
  for (const feature of ['autosale', 'autoBackchannel'] as const) {
    const allowed = allowedRarities(config, state.sleeve.purchased, feature);
    for (const [id, on] of Object.entries(auto[feature]))
      if (on && !allowed.includes(id)) problems.push(`${feature} has locked rarity ${id} on`);
  }
  const earned = automationPointsEarned(config.buyables, state.sleeve.purchased);
  const spent = config.buyables.reduce(
    (n, b) => (b.currency === 'automationPoints' ? n + b.cost.toNumber() * (state.sleeve.purchased[b.id] ?? 0) : n),
    0,
  );
  if (spent > earned) problems.push(`more automation points spent (${spent}) than earned (${earned})`);
  const featureUnlocked = (feature: (typeof AUTOMATION_FEATURES)[number]): boolean =>
    isFeatureUnlocked(config.buyables, state.sleeve.purchased, feature);
  const burn = auto.autoBurn;
  if (!(Number.isFinite(burn.lower) && burn.lower >= 0 && Number.isFinite(burn.upper) && burn.upper > burn.lower))
    problems.push(`Auto Burn thresholds are not valid: ${burn.lower} / ${burn.upper}`);
  if (!(Number.isInteger(burn.reserve) && burn.reserve >= 0))
    problems.push(`Auto Burn reserve is not a whole number >= 0: ${burn.reserve}`);
  for (const name of AUTO_BURN_SWITCHES) {
    if (burn.switches[name] && !ownsAutoBurnStep(config.buyables, state.sleeve.purchased, name))
      problems.push(`Auto Burn switch ${name} is on but its skill is not owned`);
  }
  const burnLife = state.sleeve.autoBurn;
  if (burnLife.on && !featureUnlocked('autoBurn')) problems.push('the Burn lead toggle is on but Auto Burn is not unlocked');
  if (!(Number.isFinite(burnLife.seconds) && burnLife.seconds >= 0 && burnLife.seconds < 1 + 1e-9))
    problems.push(`Auto Burn seconds is outside [0, 1): ${burnLife.seconds}`);
  for (const id of Object.keys(burnLife.overclocksOff)) {
    if (!config.actions.some((a) => a.id === id && overclockMakesHeat(a)))
      problems.push(`Auto Burn recorded an Overclock that makes no heat: ${id}`);
  }
  for (const id of Object.keys(burnLife.autoRunsOff)) {
    if (!heatMakingAutoRuns(config.buyables, config.actions).includes(id))
      problems.push(`Auto Burn recorded an Auto-run of an action that makes no heat: ${id}`);
  }
  if (Object.keys(auto.autosale).length > 0 && !featureUnlocked('autosale')) problems.push('autosale is set but not unlocked');
  if (Object.keys(auto.dispersal).length > 0 && !featureUnlocked('dispersal')) problems.push('augment dispersal is set but not unlocked');
  const shareTotal = Object.values(auto.dispersal).reduce((n, s) => n + s, 0);
  if (shareTotal > 100 + 1e-9) problems.push(`dispersal shares add up to more than 100: ${shareTotal}`);
  for (const [id, share] of Object.entries(auto.dispersal)) {
    if (!(Number.isFinite(share) && share > 0 && share <= 100)) problems.push(`dispersal of ${id} is not a share in (0, 100]: ${share}`);
    if (!config.actions.some((a) => a.id === id)) problems.push(`dispersal names unknown action ${id}`);
  }
  for (const id of Object.keys(auto.autosale)) {
    if (!config.items.rarities.some((r) => r.id === id)) problems.push(`autosale names unknown rarity ${id}`);
  }
};
