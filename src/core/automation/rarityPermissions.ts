/**
 * @module automation
 * Automation context: skill-owned rarity permissions, shared by live controls and defensive save reading.
 * Called by: Automation, automationSavePart, invariant checks. Calls: nothing; pure.
 */
import type { BuyableDefinition, GameConfig, RarityId } from '../types';

/** Automation context: the two independently permissioned rarity switch groups. */
export type RarityAutomation = 'autosale' | 'autoBackchannel';

/**
 * Automation context: returns known rarities granted by owned skills, in content order.
 * Called by: Automation.allowedRarities, automationSavePart, checkAutomation. Calls: nothing.
 * @param config definitions and known rarities
 * @param purchased owned skill copies
 * @param feature switch group to query
 * @returns allowed rarity ids; does not mutate state
 */
export function allowedRarities(
  config: Pick<GameConfig, 'items' | 'buyables'>,
  purchased: Readonly<Record<string, number>>,
  feature: RarityAutomation,
): RarityId[] {
  const granted = new Set<string>();
  for (const b of grantingBuyables(config.buyables)) {
    if ((purchased[b.id] ?? 0) <= 0) continue;
    const e: BuyableDefinition['effect'] = b.effect;
    if (feature === 'autosale') {
      if (e.kind === 'allowsAutosale') granted.add(e.rarity);
      if (e.kind === 'unlocksAutomation' && e.feature === 'autosale' && e.allowsAutosale !== undefined) granted.add(e.allowsAutosale);
    } else if (e.kind === 'allowsAutoBackchannel') granted.add(e.rarity);
  }
  return config.items.rarities.filter((r) => granted.has(r.id)).map((r) => r.id);
}

/** The buyables that can grant a rarity switch, found once per content array so a check does not scan every buyable. */
const grantingByContent = new WeakMap<readonly BuyableDefinition[], readonly BuyableDefinition[]>();

/** Automation context: the rarity-granting subset of the buyables (cached). Called by: allowedRarities. Calls: nothing. */
function grantingBuyables(buyables: readonly BuyableDefinition[]): readonly BuyableDefinition[] {
  let found = grantingByContent.get(buyables);
  if (found === undefined) {
    found = buyables.filter(
      (b) => b.effect.kind === 'allowsAutosale' || b.effect.kind === 'allowsAutoBackchannel' || b.effect.kind === 'unlocksAutomation',
    );
    grantingByContent.set(buyables, found);
  }
  return found;
}
