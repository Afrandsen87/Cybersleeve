/** Automation context: Kompromat display contracts. Called by: views and widgets. Calls: nothing. */

/** Owned rarity switch display. Called by: kompromatView. Calls: nothing. */
export interface KompromatChipView {
  readonly id: string;
  readonly name: string;
  readonly skillId: string | null;
  readonly rarityIndex: number;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly on: boolean;
  readonly heldText: string;
}

/** Protocol row in owner execution order. Called by: kompromatView and panel. Calls: nothing. */
export interface KompromatRowView {
  readonly id: 'backchannel' | 'autosale';
  readonly visible: boolean;
  readonly dimmed: boolean;
  readonly condition: string;
  readonly note: string;
  readonly chips: readonly KompromatChipView[];
}

/** Kompromat status and rows. Called by: automationView and panel. Calls: nothing. */
export interface KompromatView {
  readonly active: boolean;
  readonly status: string;
  readonly summary: string;
  readonly rows: readonly KompromatRowView[];
}

/** Kompromat interface wording. Called by: uiText and panel. Calls: nothing. */
export interface KompromatText {
  readonly active: string;
  readonly standby: string;
  readonly backchannel: string;
  readonly autosale: string;
  readonly onDrop: string;
  readonly thenCondition: string;
  readonly channelAction: string;
  readonly saleAction: string;
  readonly arrow: string;
  readonly needsMasked: string;
  status(sale: number, total: number, channel: number | null): string;
  held(count: string): string;
  needs(name: string, branch: string): string;
}
