/**
 * @module core
 *
 * The scalar fields of {@link GameState} (credits, network, heat, circumvention, ...) described once as data.
 *
 * @remarks
 * Everything that has to treat every scalar the same way is driven by {@link SCALAR_FIELDS}: creating the initial
 * state, re-sleeving, saving and loading, and repairing overflow. Adding a scalar to the game means adding it to
 * `GameState`/`GameStateView` and one entry here; none of those places needs another edit.
 * Per-action progress (`actions`), owned buyables (`purchased`) and the two flag maps are not scalars and are
 * handled by their own code.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { GameConfig, GameState } from './types';

/** Keys of {@link GameState} whose value has type `T`. */
type KeysOf<T> = { [K in keyof GameState]: GameState[K] extends T ? K : never }[keyof GameState];

/** Config sections the initial values are derived from. */
export type FieldConfig = Pick<GameConfig, 'progression' | 'sleeve'>;

/** Properties shared by every scalar field. */
interface FieldBase {
  /** The field's name in `GameState` and in the save. */
  readonly key: string;
  /** Always read from a save, even from versions before the scalars were stored. A missing or invalid value rejects the save. */
  readonly required?: boolean;
  /** Only whole values are kept (loaded values are rounded down). */
  readonly whole?: boolean;
}

/** A field held as a {@link BigNum} (unbounded amounts). */
export interface BigField extends FieldBase {
  readonly kind: 'big';
  readonly key: KeysOf<BigNum>;
  /** Value in a new game and after a re-sleeve. */
  initial(config: FieldConfig, factory: NumberFactory): BigNum;
  /** A loaded value below the initial value is ignored (the initial value is kept). */
  readonly atLeastInitial?: boolean;
}

/** A field held as a plain JS number (bounded or saturating quantities). */
export interface NumField extends FieldBase {
  readonly kind: 'num';
  readonly key: KeysOf<number>;
  /** Value in a new game and after a re-sleeve. */
  initial(config: FieldConfig): number;
  /** Loaded values at or above this are ignored (the initial value is kept). */
  readonly below?: number;
}

/** Description of one scalar field of the game state. */
export type ScalarField = BigField | NumField;

/**
 * Every scalar of the game state. All of them reset on re-sleeving: what survives a re-sleeve is per-action sleeve
 * progress, which is not a scalar.
 */
export const SCALAR_FIELDS: readonly ScalarField[] = [
  { kind: 'big', key: 'credits', required: true, initial: (c, f) => f.fromNumber(c.progression.startingCredits) },
  { kind: 'big', key: 'network', required: true, whole: true, initial: (_c, f) => f.fromNumber(0) },
  { kind: 'num', key: 'heat', initial: (c) => c.sleeve.baseHeat },
  { kind: 'num', key: 'heatCooldownMs', initial: () => 0 },
  { kind: 'big', key: 'circumvention', atLeastInitial: true, initial: (c, f) => f.fromNumber(c.sleeve.baseCircumvention) },
  { kind: 'num', key: 'infamy', whole: true, initial: () => 0 },
  { kind: 'num', key: 'infamyCooldownMs', initial: () => 0 },
  { kind: 'num', key: 'networkRemainder', below: 1, initial: () => 0 },
  { kind: 'big', key: 'nodePayoutBonus', initial: (_c, f) => f.fromNumber(0) },
  { kind: 'big', key: 'interfaceSpeedBonus', initial: (_c, f) => f.fromNumber(0) },
];

const FIELDS_BY_KEY = new Map<string, ScalarField>(SCALAR_FIELDS.map((f) => [f.key, f]));

/** Loose view of the state for code that walks the fields generically. */
type Bag = Record<string, BigNum | number>;
const bag = (state: object): Bag => state as unknown as Bag;

/**
 * The scalar part of a brand-new state.
 *
 * Called by: `state.ts`.
 *
 * @param config reads `progression.startingCredits` and the `sleeve` base values
 * @param factory number factory
 * @returns the initial value of every scalar, by key
 */
export function initialScalars(config: FieldConfig, factory: NumberFactory): Record<string, BigNum | number> {
  const out: Bag = {};
  for (const f of SCALAR_FIELDS) out[f.key] = f.kind === 'big' ? f.initial(config, factory) : f.initial(config);
  return out;
}

/**
 * Writes the scalars into a save object (amounts as strings, plain numbers as numbers).
 *
 * Called by: `serialization.ts`.
 *
 * @param state state to read
 * @param into save object to add the entries to
 */
export function writeScalars(state: Readonly<Record<string, unknown>>, into: Record<string, unknown>): void {
  for (const f of SCALAR_FIELDS) {
    const value = state[f.key] as BigNum | number;
    into[f.key] = f.kind === 'big' ? (value as BigNum).toString() : value;
  }
}

/**
 * Reads one scalar from a save, sanitising it.
 *
 * @remarks
 * Amounts are accepted as numeric strings (or, for files from before they were `BigNum`, as plain numbers) and must be
 * finite; negatives become 0. Plain-number fields must be finite and >= 0. A missing or unusable optional entry gives
 * the initial value, so older saves keep the fresh-game value.
 *
 * Called by: `serialization.ts`.
 *
 * @param field the field to read
 * @param raw the saved value (any type: it is not trusted)
 * @param config for the initial value
 * @param factory number factory
 * @returns the value to put in the state
 * @throws Error if a required amount, or a present string amount, is not a finite numeric string
 */
export function readScalar(field: ScalarField, raw: unknown, config: FieldConfig, factory: NumberFactory): BigNum | number {
  if (field.kind === 'num') {
    const initial = field.initial(config);
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || (field.below !== undefined && raw >= field.below)) return initial;
    return field.whole ? Math.floor(raw) : raw;
  }
  const initial = field.initial(config, factory);
  let value: BigNum;
  if (typeof raw === 'string') {
    value = factory.fromString(raw);
    if (!value.isFinite()) throw new Error('non-finite number');
  } else if (typeof raw === 'number' && !field.required) {
    if (!Number.isFinite(raw)) return initial;
    value = factory.fromNumber(raw);
  } else if (field.required) {
    throw new Error('expected numeric string');
  } else {
    return initial;
  }
  if (value.isNegative()) value = factory.fromNumber(0);
  if (field.whole) value = value.floor();
  if (field.atLeastInitial && value.lt(initial)) return initial;
  return value;
}

/**
 * Adds an amount to a scalar of the state.
 *
 * @remarks
 * Plain-number fields receive the amount converted to a JS number (huge amounts saturate to `Infinity`, which the overflow
 * policy repairs).
 *
 * Called by: `rewards.ts`.
 *
 * @param state state to mutate
 * @param key the scalar's name
 * @param amount amount to add
 * @throws Error if `key` is not a scalar field
 */
export function addToScalar(state: GameState, key: string, amount: BigNum): void {
  const field = FIELDS_BY_KEY.get(key);
  if (!field) throw new Error(`Unknown scalar field: ${key}`);
  const target = bag(state);
  target[key] = field.kind === 'big' ? (target[key] as BigNum).add(amount) : (target[key] as number) + amount.toNumber();
}

/**
 * Repairs scalars that are not finite numbers: NaN becomes 0 (it is a bug upstream and must not turn into a windfall),
 * positive overflow is clamped to the largest finite value (`Number.MAX_SAFE_INTEGER` for plain numbers) and negative
 * overflow becomes 0.
 *
 * Called by: `overflow.ts`.
 *
 * @param state state to mutate
 * @param factory supplies the largest finite {@link BigNum}
 * @returns true when something was changed
 */
export function repairScalars(state: GameState, factory: NumberFactory): boolean {
  let changed = false;
  const target = bag(state);
  for (const f of SCALAR_FIELDS) {
    if (f.kind === 'big') {
      const fixed = repairBig(target[f.key] as BigNum, factory);
      if (fixed) {
        target[f.key] = fixed;
        changed = true;
      }
    } else if (!Number.isFinite(target[f.key] as number)) {
      const value = target[f.key] as number;
      target[f.key] = Number.isNaN(value) || value < 0 ? 0 : Number.MAX_SAFE_INTEGER;
      changed = true;
    }
  }
  return changed;
}

/**
 * Repairs one amount.
 *
 * @param value the amount
 * @param factory supplies zero and the largest finite value
 * @returns the replacement, or `null` when `value` is fine
 */
export function repairBig(value: BigNum, factory: NumberFactory): BigNum | null {
  if (value.isFinite()) return null;
  return value.isNaN() || value.isNegative() ? factory.fromNumber(0) : factory.maxValue();
}
