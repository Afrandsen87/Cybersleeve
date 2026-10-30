/**
 * @module testing
 *
 * Shared setup for the Auto Burn tests: a small config with a Burn lead, three actions with different Overclocks (one makes heat through the
 * action, one through its Overclock only, one makes none), the Auto-run and Overclock unlocks, the Auto Burn lane and the automation points to buy it.
 *
 * @remarks
 * Called by: `core/automation/autoBurn*.test.ts`, `ui/autoBurnUi.test.ts`. Calls: `testConfig`, `automationKit`, `createGame`.
 */
import { createGame } from '../app/createGame';
import { type GameConfig, type GameEngine, createConfig } from '../core';
import { num } from '../numbers';
import { automationLaneBuyables, laneSkillId } from './automationKit';
import { flat } from './flatState';
import { setCredits, testConfig } from './testConfig';

/** Actions long enough that no run completes during a test, so heat only changes through what the test sets and the automation does. */
const slowAction = (id: string, extra: Partial<GameConfig['actions'][number]>): GameConfig['actions'][number] => ({
  id,
  name: id,
  baseDurationMs: 100_000_000,
  reward: num(0),
  xpPerRun: num(1),
  ...extra,
});

/** `hot` makes heat itself (and its Overclock more), `warm` only through its Overclock, `cold` has an Overclock without heat. */
export const BURN_ACTIONS = ['hot', 'warm', 'cold'] as const;

/** The Auto Burn test content (lower threshold 10, upper threshold 50, Burn lead takes 5% of the heat). */
export const burnConfig: GameConfig = createConfig(testConfig, {
  actions: [
    ...testConfig.actions,
    slowAction('hot', { heatPerRun: 1, overclock: { heatPerMinute: 6 } }),
    slowAction('warm', { overclock: { heatPerMinute: 6 } }),
    slowAction('cold', { overclock: { speedBonus: 0.5 } }),
  ],
  items: {
    rarities: testConfig.items.rarities,
    definitions: [{ id: 'lead', name: 'Lead', sellable: false, hasRarity: false }],
    burnLead: { itemId: 'lead', heatFraction: 0.05 },
  },
  buyables: [
    ...testConfig.buyables,
    {
      id: 'core',
      name: 'Core',
      description: '',
      cost: num(1),
      costGrowth: 2,
      maxPurchases: Infinity,
      effect: { kind: 'automationPoints', perCopy: 1 },
    },
    ...BURN_ACTIONS.flatMap((id) => [
      { id: `auto-${id}`, name: `Auto ${id}`, description: '', actionId: id, cost: num(1), effect: { kind: 'autoRun' as const } },
      {
        id: `oc-${id}`,
        name: `Overclock ${id}`,
        description: '',
        actionId: id,
        cost: num(1),
        effect: { kind: 'overclockUnlock' as const },
      },
    ]),
    ...automationLaneBuyables(),
  ],
  automation: { autoBurnCeiling: 10, autoBurnUpper: 50 },
});

/** The numbers the tests read and set directly. */
export type BurnLoose = { heat: number; inventory: Record<string, Record<string, number>> };

/** The writable state of a game (tests only). */
export const burnState = (g: GameEngine): BurnLoose => flat<BurnLoose>(g);

/**
 * A game that owns the first `steps` skills of the Auto Burn lane (1 is only the unlock), holds `leads` Burn leads and has `heat`.
 * Every Auto-run and Overclock unlock is bought; Overclock and Auto-run of the three actions are NOT switched on (use {@link allOn}).
 *
 * @param steps how many lane skills to own (0 to 10: the unlock is skill 1, the nine steps follow)
 * @param leads Burn leads held
 * @param heat the starting heat
 */
export function burnGame(steps: number, leads = 0, heat = 0): GameEngine {
  const g = createGame({ config: burnConfig });
  setCredits(g, num(1e15));
  for (let i = 0; i < steps + 1; i++) g.buy('core');
  for (const id of BURN_ACTIONS) {
    g.buy(`auto-${id}`);
    g.buy(`oc-${id}`);
  }
  for (let i = 1; i <= steps; i++) expect_bought(g.buy(laneSkillId('autoBurn', i)), i);
  burnState(g).heat = heat;
  burnState(g).inventory['lead'] = { common: leads };
  return g;
}

/** Throws when a lane skill could not be bought (a test setup mistake, not a test result). */
function expect_bought(result: string, step: number): void {
  if (result !== 'purchased') throw new Error(`lane skill ${step} was not bought: ${result}`);
}

/** Switches the Overclock and the Auto-run of every action on (the Auto-runs are on after buying; this sets the Overclocks). */
export function allOn(g: GameEngine): void {
  for (const id of BURN_ACTIONS) if (!g.overclockStatus(id)?.on) g.toggleOverclock(id);
}
