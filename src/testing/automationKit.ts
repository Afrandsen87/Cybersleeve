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
import { AUTOMATION_FEATURES } from '../core';
import { num } from '../numbers';

/** Id of the `step`-th (1-based) skill of a feature's test lane. */
export const laneSkillId = (feature: AutomationFeature, step: number): string => `lane-${feature}-${step}`;

/**
 * A lane of skills for every feature: step 1 unlocks the feature, each later step is a placeholder that needs the one before it. All
 * cost 1 automation point and sit in a branch named after the feature.
 *
 * @param length skills per lane (default 3)
 * @returns the buyables, to add to a test config
 */
export function automationLaneBuyables(length = 3): BuyableDefinition[] {
  return AUTOMATION_FEATURES.flatMap((feature) =>
    Array.from({ length }, (_, i): BuyableDefinition => {
      const step = i + 1;
      return {
        id: laneSkillId(feature, step),
        name: `${feature} ${step}`,
        description: '',
        currency: 'automationPoints',
        branch: feature,
        ...(step > 1 ? { parents: [laneSkillId(feature, step - 1)] } : {}),
        cost: num(1),
        effect: step === 1 ? { kind: 'unlocksAutomation', feature } : { kind: 'placeholder' },
      };
    }),
  );
}
