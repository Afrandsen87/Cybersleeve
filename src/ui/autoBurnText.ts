/** @module ui
 * Panel wording. Called by: uiText, autoBurnView. Calls: none.
 */
import type { AutoBurnActivity } from '../core';
/** Localized panel text. Called by: UiText. Calls: none. */
export interface AutoBurnText {
  readonly floor: string;
  readonly redline: string;
  readonly reserve: string;
  readonly on: string;
  readonly off: string;
  readonly inventory: string;
  readonly heat: string;
  readonly leads: string;
  readonly zones: readonly string[];
  readonly activities: Readonly<Record<AutoBurnActivity, { readonly word: string; readonly reason: string }>>;
  readonly tags: readonly string[];
  readonly captions: readonly string[];
  readonly overclocks: string;
  readonly autoRuns: string;
  readonly autoRunKind: string;
  readonly overclockKind: string;
  readonly emptyAutoRuns: string;
  readonly emptyOverclocks: string;
  trigger(redline: string): string;
  throttle(floor: string): string;
  failsafe(floor: string, reserve: boolean): string;
  restart(floor: string, reserve: boolean): string;
  readonly actions: readonly string[];
}
/** Default words and owner-value templates. Called by: uiText. Calls: none. */
export const autoBurnText: AutoBurnText = {
  floor: 'Floor',
  redline: 'Redline',
  reserve: 'Reserve',
  on: 'ON',
  off: 'OFF',
  inventory: 'Inventory toggle',
  heat: 'heat',
  leads: 'leads',
  zones: ['COLD', 'BAND', 'RED'],
  activities: {
    standby: { word: 'STANDBY', reason: 'Inventory toggle is off' },
    idle: { word: 'IDLE', reason: 'no heat to cool' },
    blocked: { word: 'BLOCKED', reason: 'an Overclock holds heat: leads cannot be used' },
    dry: { word: 'DRY', reason: 'no available leads to burn' },
    holding: { word: 'HOLDING', reason: 'at the Floor' },
    burning: { word: 'BURNING', reason: 'burning leads to cool heat' },
  },
  tags: ['TRIGGER', 'THROTTLE', 'FAILSAFE', 'RESTART'],
  captions: [
    'Redline Trigger',
    'Hold Down',
    'Cool Overclocks',
    'Resume Auto-runs',
    'Cool Overclocks · Auto-runs',
    'Resume Auto-runs · Overclocks',
  ],
  overclocks: 'Overclocks',
  autoRuns: 'Auto-runs',
  autoRunKind: 'AUTO-RUN',
  overclockKind: 'OVERCLOCK',
  emptyAutoRuns: 'No heat-making Auto-runs owned yet',
  emptyOverclocks: 'No heat-making Overclocks owned yet',
  trigger: (v) => `WHEN heat ≥ ${v}`,
  throttle: (v) => `WHILE burning → burn only down to heat ${v} (saves leads)`,
  failsafe: (v, reserve) => `WHEN out of leads${reserve ? ' above Reserve' : ''} AND heat > ${v}`,
  restart: (v, reserve) => `WHEN heat < ${v} AND leads ${reserve ? 'above Reserve' : 'left'}`,
  actions: ['switch the Burn toggle on', '', 'kill heat-making', 'restart what you pick, and the Burn toggle'],
};
