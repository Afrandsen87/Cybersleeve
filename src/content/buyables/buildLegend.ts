/**
 * @module content
 *
 * The buyables of Build Legend.
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import { LEGEND, LEGEND_AUTO_RUN } from '../ids';
import { autoRunCost, focusUnlock } from './helpers';

/** The buyables of Build Legend. */
export const buildLegendBuyables: BuyableDefinition[] = [
  {
    id: LEGEND_AUTO_RUN,
    name: 'Auto-run',
    symbol: '↻',
    description: 'Restarts the action automatically when it finishes.',
    actionId: LEGEND,
    cost: num(autoRunCost(LEGEND)),
    effect: { kind: 'autoRun' },
  },

  focusUnlock(LEGEND),
];
