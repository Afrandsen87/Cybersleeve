/** Shared Kompromat protocol test setup using fixed test content.
 * Called by: Kompromat view and DOM tests. Calls: createGame, automationLaneBuyables.
 */
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { automationLaneBuyables, laneSkillId } from './automationKit';
import { flat } from './flatState';
import { setCredits, testConfig } from './testConfig';

/** Builds an autosale lane with an independently gated manual channel.
 * Called by: protocol tests. Calls: createGame, setCredits, flat.
 * @param channel whether the manual Back Channel is owned
 * @returns game with three permission nodes and known inventory counts
 */
export function kompromatGame(channel = false) {
  const config = createConfig(testConfig, {
    automation: { autoBurnCeiling: 10, autoBurnUpper: 50 },
    buyables: [
      ...testConfig.buyables,
      { id: 'core', name: 'Core', description: '', cost: num(1), maxPurchases: Infinity, effect: { kind: 'automationPoints', perCopy: 1 } },
      {
        id: 'manual-channel',
        name: 'Secret channel',
        description: '',
        cost: num(1),
        branch: 'leverage',
        requires: ['auto'],
        currency: 'skillPoints',
        effect: { kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 1, cooldownBoost: 1 },
      },
      ...automationLaneBuyables(),
    ],
  });
  const game = createGame({ config });
  setCredits(game, num(1e8));
  for (let i = 0; i < 3; i++) game.buy('core');
  for (let step = 1; step <= 3; step++) game.buy(laneSkillId('autosale', step));
  flat<{ inventory: Record<string, Record<string, number>> }>(game).inventory['file'] = { common: 41, rare: 7 };
  if (channel) {
    game.buy('auto');
    flat<{ purchased: Record<string, number> }>(game).purchased['manual-channel'] = 1;
  }
  return game;
}
