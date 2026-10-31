/**
 * @module ui
 * Firmware-tab wording, kept separate from presentation and game rules.
 * Called by: uiText facade, firmware inspector and panel. Calls: nothing.
 */
import type { FirmwareNodeState } from './view/firmwareNodeState';

/** Firmware panel wording contract. Called by: UiText and firmware views/widgets. Calls: nothing. */
export interface FirmwareText {
  readonly status: Readonly<Record<FirmwareNodeState, string>>;
  readonly branchPurpose: Readonly<Record<string, string>>;
  readonly hidden: string;
  readonly pointsLabel: string;
  readonly sleevePointsLabel: string;
  readonly persistent: string;
  readonly kept: string;
  readonly sleeveUp: string;
  readonly legendHint: string;
  readonly encryptedHint: string;
  readonly requires: string;
  readonly unlocksNext: string;
  readonly install: string;
  /** Balance explanation. Called by: inspector. Calls: nothing. */
  have(points: string): string;
  /** Unaffordable explanation for the selected pool. Called by: inspector. Calls: nothing. */
  earnMore(points: string, sleeve: boolean): string;
  /** Missing parent explanation. Called by: inspector. Calls: nothing. */
  installFirst(name: string): string;
}

/** Default Firmware words. Called by: uiText. Calls: nothing. */
export const firmwareText: FirmwareText = {
  status: {
    installed: 'Installed',
    affordable: 'Affordable now',
    available: 'Available: need more points',
    locked: 'Locked: install the firmware before it',
    encrypted: 'Encrypted',
  },
  branchPurpose: {
    autoBurn: 'keep heat in check and restart work',
    autosale: 'sell files or give them to Back Channel',
    dispersal: 'spread schematics over selected actions',
    cybernetics: 'speed, payout and crits',
    anonymity: 'cool heat and stay hidden',
    leverage: 'kompromat, moles and drops',
    retention: 'carry progress into the next life',
    reach: 'raise caps and access',
    synthetics: 'synthetic sleeves',
    corporation: 'found and grow a corporation',
  },
  hidden: '???',
  pointsLabel: 'FIRMWARE POINTS',
  sleevePointsLabel: 'SLEEVE FIRMWARE POINTS',
  persistent: 'PERSISTENT',
  kept: 'kept across re-sleeves',
  sleeveUp: 'SLEEVE UP!',
  legendHint: '??? encrypted firmware unlocks as you play further',
  encryptedHint: 'Unlocks as you play further',
  requires: 'REQUIRES',
  unlocksNext: 'UNLOCKS NEXT',
  install: 'INSTALL',
  have: (points) => `You have ${points}`,
  earnMore: (points, sleeve) => `You have ${points}: earn more ${sleeve ? 'sleeve firmware points' : 'firmware points'}`,
  installFirst: (name) => `Install ${name} first`,
};
