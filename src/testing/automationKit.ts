/**
 * @module testing
 *
 * Test content for the automation lanes: what every automation test needs besides the `automationPoints` buyable, so that "unlocking" a
 * feature (buying the first skill of its lane) works against a small config instead of the real content.
 *
 * @remarks
 * Called by: the automation tests (core and ui) and the random play in `core/properties.test.ts`.
 */
import type { AutomationFeature, BuyableDefinition } from '../core';
import { AUTOMATION_FEATURES, AUTO_BURN_STEPS } from '../core';
import { num } from '../numbers';

/** Id of the `step`-th (1-based) skill of a feature's test lane. */
export const laneSkillId = (feature: AutomationFeature, step: number): string => `lane-${feature}-${step}`;

/** The effect of the `step`-th skill of a feature's test lane. */
function laneEffect(feature: AutomationFeature, step: number): BuyableDefinition['effect'] {
  if (step === 1)
    return {
      kind: 'unlocksAutomation',
      feature,
      ...(feature === 'autosale' ? { allowsAutosale: 'common' } : {}),
      ...(feature === 'dispersal' ? { allowsDispersal: 'common', dispersalSlots: 1 } : {}),
    };
  if (feature === 'dispersal') return step === 3 ? { kind: 'allowsDispersal', rarity: 'rare' } : { kind: 'dispersalSlots', count: 1 };
  if (feature === 'autosale' && step === 2) return { kind: 'allowsAutosale', rarity: 'rare' };
  if (feature === 'autosale' && step === 3) return { kind: 'allowsAutoBackchannel', rarity: 'common' };
  const autoBurnStep = AUTO_BURN_STEPS[step - 2];
  return feature === 'autoBurn' && autoBurnStep !== undefined ? { kind: 'autoBurnStep', step: autoBurnStep } : { kind: 'placeholder' };
}

/**
 * A lane of skills for every feature: step 1 unlocks the feature, later steps grant permissions or selection slots and need the one before them. All
 * cost 1 automation point and sit in a branch named after the feature. The Auto Burn lane is always the full ten skills, with the
 * real steps (`autoBurnStep`, in the order of `AUTO_BURN_STEPS`) from step 2 on.
 *
 * @param length skills per lane for the other features (default 3)
 * @returns the buyables, to add to a test config
 */
export function automationLaneBuyables(length = 3): BuyableDefinition[] {
  return AUTOMATION_FEATURES.flatMap((feature) =>
    Array.from({ length: feature === 'autoBurn' ? AUTO_BURN_STEPS.length + 1 : length }, (_, i): BuyableDefinition => {
      const step = i + 1;
      return {
        id: laneSkillId(feature, step),
        name: `${feature} ${step}`,
        description: '',
        currency: 'automationPoints',
        branch: feature,
        ...(step > 1 ? { parents: [laneSkillId(feature, step - 1)] } : {}),
        cost: num(1),
        effect: laneEffect(feature, step),
      };
    }),
  );
}
