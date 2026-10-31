/**
 * @module testing
 * Small owner-backed dispersal panel fixture, shared by pure and DOM tests.
 * Called by: dispersalView.test, dispersalPanel.dom.test. Calls: createGame, testConfig, automationLaneBuyables.
 */
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { automationLaneBuyables } from './automationKit';
import { setCredits, testConfig } from './testConfig';

/** Creates one-slot dispersal with two reachable actions and one gated action.
 * Called by: dispersal tests. Calls: createConfig, createGame, buy.
 * @returns isolated game and content
 */
export function dispersalPanelGame() {
  const config = createConfig(testConfig, {
    actions: [
      ...testConfig.actions,
      { ...testConfig.actions[0]!, id: 'b', name: 'B' },
      { ...testConfig.actions[0]!, id: 'locked', name: 'Locked', requiredAccessLevel: 2 },
    ],
    items: {
      ...testConfig.items,
      definitions: [...testConfig.items.definitions, { id: 'schem', name: 'Schematic', sellable: false }],
      augment: { itemId: 'schem', xpBonusPerItem: 0.01 },
    },
    automation: { autoBurnCeiling: 10, autoBurnUpper: 50 },
    buyables: [
      ...testConfig.buyables,
      {
        id: 'core',
        name: 'Core',
        description: '',
        cost: num(1),
        costGrowth: 1,
        maxPurchases: Infinity,
        effect: { kind: 'automationPoints', perCopy: 1 },
      },
      ...automationLaneBuyables(),
    ],
  });
  const game = createGame({ config });
  setCredits(game, num(100));
  game.buy('core');
  game.automation().unlock('dispersal');
  return { game, config };
}
