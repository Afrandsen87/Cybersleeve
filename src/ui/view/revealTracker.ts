/**
 * @module ui
 *
 * Context: ui (reads the economy's reveal ledger). Decides, for one view build, whether a thing is shown and collects the ledger keys that are new.
 *
 * @remarks
 * The one place the ledger rule lives for readers: a thing is shown when the ledger holds its key OR its natural rule says so now. The natural
 * rule is passed in by the caller (stat rules, skill gates, purchase reveal). Keys shown by the natural rule that are not yet in the ledger are
 * collected in {@link RevealTracker.fresh}; the view model carries them out and `ui/dom.ts` hands them to the engine command `noteRevealed`.
 * Nothing here writes game state.
 *
 * Called by: `ui/viewModel.ts` (creates one per build), `statReveal.ts`, `skillTree.ts`, `buyableViews.ts`, `panelViews.ts`.
 * Calls: `revealKey` of the core.
 */
import { type RevealKind, revealKey } from '../../core';

/** The per-build reveal reader and key collector. */
export class RevealTracker {
  private readonly noted: ReadonlySet<string>;
  private readonly pending = new Set<string>();

  /**
   * @param ledger the keys already in `wallet.revealed`
   */
  constructor(ledger: readonly string[]) {
    this.noted = new Set(ledger);
  }

  /** Whether the ledger already holds a thing. */
  has(kind: RevealKind, id: string): boolean {
    return this.noted.has(revealKey(kind, id));
  }

  /**
   * Whether a thing is shown: noted before, or shown by its natural rule right now (which collects its key as new).
   *
   * @param kind what sort of thing
   * @param id its id
   * @param natural whether the thing's own rule shows it now
   */
  reveals(kind: RevealKind, id: string, natural: boolean): boolean {
    const key = revealKey(kind, id);
    if (this.noted.has(key)) return true;
    if (natural) this.pending.add(key);
    return natural;
  }

  /** The keys shown by their natural rule that the ledger did not hold, in the order they were met. */
  fresh(): string[] {
    return [...this.pending];
  }
}
