/**
 * @module ui
 *
 * Two-step confirmation for destructive commands, without a modal dialog.
 */

/**
 * Remembers whether a destructive command has been requested once already.
 *
 * @remarks
 * The first {@link ConfirmGate.request} only arms the gate (the UI then asks "are you sure?"); the second performs the
 * command. {@link ConfirmGate.cancel} disarms it. No timers: the gate stays armed until it is confirmed or cancelled.
 *
 * Called by: `ui/dom.ts` (re-sleeve button).
 */
export class ConfirmGate {
  private armed = false;

  /** True while waiting for the second, confirming request. */
  get isArmed(): boolean {
    return this.armed;
  }

  /**
   * Handles one request for the command.
   * @returns true when the command should run now (the request confirmed an armed gate); false when it only armed the gate
   */
  request(): boolean {
    if (this.armed) {
      this.armed = false;
      return true;
    }
    this.armed = true;
    return false;
  }

  /** Disarms the gate; the next request has to be confirmed again. */
  cancel(): void {
    this.armed = false;
  }
}
