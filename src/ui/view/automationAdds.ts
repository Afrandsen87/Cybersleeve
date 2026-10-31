/**
 * @module ui
 * Automation context: maps a firmware effect to its revealable panel control.
 * Called by: automationView and tests. Calls: assertNever, FirmwareText formatters.
 */
import type { BuyableDefinition, BuyableEffect, AutoBurnStep } from '../../core';
import { assertNever } from '../../core/effects/effectTraits';
import type { FirmwareText } from '../firmwareText';

/** Control guidance for a readable node. Called by: automationView. Calls: nothing. */
export interface AutomationAddition {
  readonly text: string;
  readonly target: string;
}

/** Automation-owned effect subset, exhaustively mapped below. Called by: automationAdds. Calls: nothing. */
type AutomationEffect = Extract<
  BuyableEffect,
  { kind: 'unlocksAutomation' | 'autoBurnStep' | 'allowsAutosale' | 'allowsAutoBackchannel' | 'allowsDispersal' | 'dispersalSlots' }
>;

/** Stable Auto Burn controls, independent of content ids. Called by: automationAdds. Calls: nothing. */
const BURN_TARGETS: Readonly<Record<AutoBurnStep, string>> = {
  hold: 'row-throttle',
  upper: 'row-redline',
  offOverclocks: 'row-failsafe',
  offActions: 'chip-offActions',
  onActions: 'row-restart',
  onOverclocks: 'sub-restartOc',
  thresholds: 'ab-strip',
  reserve: 'ab-reserve',
};

/** Narrows effects without adding a second game-rule owner. Called by: automationAdds. Calls: nothing. */
function isAutomationEffect(effect: BuyableEffect): effect is AutomationEffect {
  return ['unlocksAutomation', 'autoBurnStep', 'allowsAutosale', 'allowsAutoBackchannel', 'allowsDispersal', 'dispersalSlots'].includes(
    effect.kind,
  );
}

/**
 * Names the control introduced by a skill. Slot labels total content grants through this node in tree order;
 * ownership, affordability and masking remain the existing lane view's responsibility.
 * Called by: automationView. Calls: isAutomationEffect, FirmwareText formatters, assertNever.
 * @param skill Static skill definition.
 * @param skillsInTreeOrder Definitions in display order, including the unlock's first slot.
 * @param rarityName Configured display name lookup.
 * @param text Interface wording.
 * @returns Control guidance, or null for a non-automation effect.
 */
export function automationAdds(
  skill: BuyableDefinition,
  skillsInTreeOrder: readonly BuyableDefinition[],
  rarityName: (id: string) => string,
  text: FirmwareText,
): AutomationAddition | null {
  const effect = skill.effect;
  if (!isAutomationEffect(effect)) return null;
  const words = text.automationAdds;
  switch (effect.kind) {
    case 'unlocksAutomation':
      switch (effect.feature) {
        case 'autoBurn':
          return { text: words.burnUnlock, target: 'ab-status' };
        case 'autosale':
          return {
            text: words.chip(rarityName(effect.allowsAutosale ?? ''), false, true),
            target: `chip-sale-${effect.allowsAutosale ?? ''}`,
          };
        case 'dispersal':
          return { text: words.dispersal(rarityName(effect.allowsDispersal ?? '')), target: 'ds-status' };
        default:
          return assertNever(effect.feature);
      }
    case 'autoBurnStep':
      return { text: words.burnSteps[effect.step], target: BURN_TARGETS[effect.step] };
    case 'allowsAutosale':
      return { text: words.chip(rarityName(effect.rarity), false, false), target: `chip-sale-${effect.rarity}` };
    case 'allowsAutoBackchannel':
      return { text: words.chip(rarityName(effect.rarity), true, false), target: `chip-chan-${effect.rarity}` };
    case 'allowsDispersal':
      return { text: words.permit(rarityName(effect.rarity)), target: `pill-${effect.rarity}` };
    case 'dispersalSlots': {
      const end = skillsInTreeOrder.findIndex((node) => node.id === skill.id);
      const slots = skillsInTreeOrder
        .slice(0, end + 1)
        .reduce(
          (sum, node) =>
            sum +
            (node.effect.kind === 'dispersalSlots'
              ? node.effect.count
              : node.effect.kind === 'unlocksAutomation'
                ? (node.effect.dispersalSlots ?? 0)
                : 0),
          0,
        );
      return { text: words.slot(slots), target: `slot-${slots}` };
    }
    default:
      return assertNever(effect);
  }
}
