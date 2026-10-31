/**
 * @module ui
 *
 * What the re-sleeve box shows in each state (locked, charging, ready), as plain data for the widget. The armed state is the widget's
 * own (it follows the confirm gate); its ledger lines are built here from the same text as the Ready state's "on arrival" line.
 *
 * @remarks
 * Called by: `viewModel.ts`. Calls: `GameQueries.costOf` / `currencyOf`, `formatBigNum`. Pure.
 */
import type { GameConfig, GameQueries, ResleeveRequirement, StateSliceView } from '../../core';
import { formatBigNum, num } from '../../numbers';
import type { UiText } from '../uiText';
import type { ResleeveBuyView } from './viewTypes';

/** Which of the box's own states is shown (Armed is added by the widget while its confirm gate is armed). */
export type ResleeveBoxKind = 'locked' | 'charging' | 'ready';

/** One line of the armed box's ledger. */
export interface LedgerLineView {
  readonly tone: 'lose' | 'keep' | 'gain';
  readonly label: string;
  readonly text: string;
}

/** Display data of the re-sleeve box. */
export interface ResleeveBoxView {
  readonly kind: ResleeveBoxKind;
  /** The status light's words: LOCKED, the percentage, READY. */
  readonly status: string;
  /** Progress bar fill 0..1; `null` hides the bar (no requirement to show). */
  readonly fill: number | null;
  /** The lines between the title and the button: the hint, what is needed, what is held, the on-arrival gain. */
  readonly lines: readonly string[];
  /** The purchase this box stands for while locked; `null` once Unlock resleeving is owned. */
  readonly buyId: string | null;
  /** The button's words: Unlock while locked, Re-sleeve after. */
  readonly buttonText: string;
  /** The price shown on the Unlock button (with unit); `null` when the button is Re-sleeve. */
  readonly priceText: string | null;
  /** The Unlock purchase's hover text; `null` otherwise. */
  readonly tip: string | null;
  /** The button can be pressed (the unlock is affordable, or a re-sleeve is possible now). */
  readonly enabled: boolean;
  /** Ledger lines for the armed state: resets, keeps, gains. */
  readonly ledger: readonly LedgerLineView[];
}

/**
 * The share of the furthest-off requirement that is met: 0..1, with NaN or an unmeetable (infinite) need counting as 0, an infinite
 * holding or a need of zero or less as met.
 *
 * Called by: {@link resleeveBoxView}.
 *
 * @param requirements the requirements not yet met (held and needed)
 * @returns the smallest `held / needed`, clamped to 0..1
 */
export function requirementFill(requirements: readonly ResleeveRequirement[]): number {
  let fill = 1;
  for (const { held, needed } of requirements) {
    let share: number;
    if (Number.isNaN(held) || Number.isNaN(needed)) share = 0;
    else if (needed <= 0 || held === Number.POSITIVE_INFINITY) share = 1;
    else if (needed === Number.POSITIVE_INFINITY) share = 0;
    else share = Math.min(1, Math.max(0, held / needed));
    fill = Math.min(fill, share);
  }
  return fill;
}

/**
 * Builds the box's view.
 *
 * Called by: `buildViewModel`. Calls: {@link requirementFill}, `GameQueries.costOf`, `currencyOf`.
 *
 * @param engine the game's queries (the unlock's price and currency)
 * @param state the game state (reads the credits held)
 * @param config game configuration (points per re-sleeve)
 * @param text the display text
 * @param canResleeve a re-sleeve is possible now
 * @param buy the Unlock resleeving purchase while it is not owned
 * @param shortfall the requirements not yet met (empty when none, or while Sleeve levels is not owned)
 */
export function resleeveBoxView(
  engine: Pick<GameQueries, 'costOf' | 'currencyOf'>,
  state: StateSliceView<'credits'>,
  config: Pick<GameConfig, 'resleeve'>,
  text: UiText,
  canResleeve: boolean,
  buy: ResleeveBuyView | null,
  shortfall: readonly ResleeveRequirement[],
): ResleeveBoxView {
  const t = text.resleeve;
  const points = config.resleeve.pointsPerResleeve;
  const gain = t.ledger.gains.what(points);
  const ledger: readonly LedgerLineView[] = [
    { tone: 'lose', label: t.ledger.resets.label, text: t.ledger.resets.what },
    { tone: 'keep', label: t.ledger.keeps.label, text: t.ledger.keeps.what },
    { tone: 'gain', label: t.ledger.gains.label, text: gain },
  ];
  const base = { ledger, buyId: null, priceText: null, tip: null, fill: null, buttonText: t.idle };

  if (buy !== null) {
    const held = state.wallet.credits;
    const lines = [t.lockedHint];
    if (engine.currencyOf(buy.id) === 'credits') {
      const price = engine.costOf(buy.id);
      const unit = text.costUnits.credits;
      const have = `${formatBigNum(held)} ${unit}`;
      const missing = price.sub(held);
      lines.push(buy.affordable || !missing.gt(num(0)) ? t.have(have) : t.haveToGo(have, `${formatBigNum(missing)} ${unit}`));
    }
    return {
      ...base,
      kind: 'locked',
      status: t.status.locked,
      lines,
      buyId: buy.id,
      buttonText: t.unlock,
      priceText: buy.priceText,
      tip: buy.tip,
      enabled: buy.affordable,
    };
  }
  if (shortfall.length > 0) {
    const fill = requirementFill(shortfall);
    const lines = shortfall.map((r) => t.needLevels(r.kind, formatBigNum(num(r.held)), formatBigNum(num(r.needed))));
    return { ...base, kind: 'charging', status: t.status.percent(String(Math.floor(fill * 100))), fill, lines, enabled: false };
  }
  if (!canResleeve) return { ...base, kind: 'charging', status: t.status.charging, lines: [], enabled: false }; // the lockout after a re-sleeve: no requirement, so no bar
  return { ...base, kind: 'ready', status: t.status.ready, fill: 1, lines: [t.onArrival(gain)], enabled: true };
}
