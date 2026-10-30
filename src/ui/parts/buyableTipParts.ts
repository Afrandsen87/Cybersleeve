/** Pre-formatted pieces of the synthetic sleeves explanation. */
export interface SynthTipParts {
  /** How many synthetic sleeves there are. */
  readonly count: string;
  /** What they earn per second together. */
  readonly perSecond: string;
}

/** Pre-formatted pieces of a buyable's hover text. */
export interface BuyableTipParts {
  readonly name: string;
  readonly description: string;
  /** A formula shown under the description, or `null`. */
  readonly formula: string | null;
  /** The current numbers behind the formula, or `null` when the purchase has none to show. */
  readonly values: BuyableValues | null;
  readonly cost: string;
  readonly costUnit: string;
  readonly owned: number;
  readonly repeatable: boolean;
  readonly maxed: boolean;
  readonly toggleable: boolean;
  readonly enabled: boolean;
}

/** The live numbers behind a purchase's formula: the variables with their values, then the result. */
export interface BuyableValues {
  readonly variables: readonly string[];
  readonly result: string;
}
