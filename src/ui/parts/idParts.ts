/** Identifier of a titled group of Sleeve purchases. */
export type SleeveSectionId = 'rebuyable' | 'oneTime' | 'nodes';

/** Identifier of a cell in the square of an action card. */
export type SquareCellId = 'autoRun' | 'overclock' | 'focus' | 'augment';

/** Identifier of a stat row. */
export type StatId =
  | 'access'
  | 'interfaceSpeed'
  | 'hackingProficiency'
  | 'iceRating'
  | 'heat'
  | 'legend'
  | 'nodes'
  | 'income'
  | 'payout'
  | 'moles'
  | 'synths'
  | 'synthIncome'
  | 'criticalChance'
  | 'corporateRank'
  | 'ownedCorporations'
  | 'employees'
  | 'stocksOwned';
