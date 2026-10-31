/**
 * @module ui
 * Automation context: maps a firmware effect to its revealable panel control.
 * Called by: automationView and tests. Calls: assertNever, FirmwareText formatters.
 */
import { dispersalSlots, type BuyableDefinition, type BuyableEffect } from '../../core';
import { type AutomationTarget, saleChip, channelChip, permit, slot, targets, burnTargets } from './automationTargets';
import { assertNever } from '../../core/effects/effectTraits';
import type { FirmwareText } from '../firmwareText';

/** Control guidance for a readable node. Called by: automationView. Calls: nothing. */
export interface AutomationAddition {
  readonly text: string;
  readonly target: AutomationTarget;
}

/** Automation-owned effect subset, exhaustively mapped below. Called by: automationAdds. Calls: nothing. */
type AutomationEffect = Extract<
  BuyableEffect,
  { kind: 'unlocksAutomation' | 'autoBurnStep' | 'allowsAutosale' | 'allowsAutoBackchannel' | 'allowsDispersal' | 'dispersalSlots' }
>;

/** Narrows effects without adding a second game-rule owner. Called by: automationAdds. Calls: nothing. */
function isAutomationEffect(effect: BuyableEffect): effect is AutomationEffect {
  return ['unlocksAutomation', 'autoBurnStep', 'allowsAutosale', 'allowsAutoBackchannel', 'allowsDispersal', 'dispersalSlots'].includes(
    effect.kind,
  );
}

/**
 * Names the control introduced by a skill. Slot labels read owner capacity for this node and its ancestors;
 * ownership, affordability and masking remain the existing lane view's responsibility.
 * Called by: automationView. Calls: isAutomationEffect, FirmwareText formatters, dispersalSlots, assertNever.
 * @param skill Static skill definition.
 * @param skillsInTreeOrder Definitions in any order, including the unlock's first slot.
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
          return { text: words.burnUnlock, target: targets.burnStatus };
        case 'autosale':
          return {
            text: words.chip(rarityName(effect.allowsAutosale ?? ''), false, true),
            target: saleChip(effect.allowsAutosale ?? ''),
          };
        case 'dispersal':
          return { text: words.dispersal(rarityName(effect.allowsDispersal ?? '')), target: targets.dispersalStatus };
        default:
          return assertNever(effect.feature);
      }
    case 'autoBurnStep':
      return { text: words.burnSteps[effect.step], target: burnTargets[effect.step] };
    case 'allowsAutosale':
      return { text: words.chip(rarityName(effect.rarity), false, false), target: saleChip(effect.rarity) };
    case 'allowsAutoBackchannel':
      return { text: words.chip(rarityName(effect.rarity), true, false), target: channelChip(effect.rarity) };
    case 'allowsDispersal':
      return { text: words.permit(rarityName(effect.rarity)), target: permit(effect.rarity) };
    case 'dispersalSlots': {
      const byId = new Map(skillsInTreeOrder.map((node) => [node.id, node]));
      const record: Record<string, number> = {};
      const pending = [skill.id];
      while (pending.length) {
        const id = pending.pop()!;
        if (record[id]) continue;
        record[id] = 1;
        pending.push(...(byId.get(id)?.parents ?? []));
      }
      const slots = dispersalSlots(skillsInTreeOrder, record);
      return { text: words.slot(slots), target: slot(slots) };
    }
    default:
      return assertNever(effect);
  }
}
