/** Where one stack of items drops from: an action and the chance, in percent, that one completed run of it drops this stack. */
export interface DropChanceParts {
  /** Name of the action. */
  readonly action: string;
  /** Chance per completed run in percent, e.g. `"4.5"`. */
  readonly percent: string;
}

/** Pre-formatted pieces of the hover text of an inventory stack that cannot be paid out. */
export interface StackKeptTipParts {
  /** Where the stack can drop from (empty while no action can drop it). */
  readonly drops: readonly DropChanceParts[];
  /** E.g. `"Common Augment schematic"`. */
  readonly label: string;
  /** Items held. */
  readonly count: string;
}

/** Pre-formatted pieces of the hover text of an action's Augment button. */
export interface AugmentTipParts {
  /** The XP per run now, after the augments applied. */
  readonly xpPerRun: string;
  /** The action XP per run before any augment. */
  readonly baseXp: string;
  /** What one augment adds within its rarity, as a plain number (`"0.01"`), for writing the calculation out. */
  readonly bonus: string;
  /** What one schematic adds, in percent. */
  readonly bonusPercent: string;
  /** Schematics applied to this action, per rarity that has any (most common first). */
  readonly applied: readonly { readonly rarity: string; readonly count: string }[];
  /** Schematics of the selected rarity held in the inventory (`"0"` while none is selected). */
  readonly held: string;
  /** Name of the rarity selected in the Inventory (the one a press uses up), or `null` while none is selected. */
  readonly selected: string | null;
  /** Name of the item the schematics are (`"Augment schematic"`). */
  readonly item: string;
}

/** Pre-formatted pieces of the hover text of the Zero-day tile. */
export interface ZeroDayTipParts {
  /** E.g. `"Zero-day"`. */
  readonly label: string;
  /** Where the item can drop from (empty while no action can drop it). */
  readonly drops: readonly DropChanceParts[];
  /** The action whose runs a Zero-day makes critical. */
  readonly actionName: string;
  /** Zero-days held. */
  readonly count: string;
  /** The toggle is on. */
  readonly on: boolean;
  /** Clicking would do something (the toggle is on, or one is held to switch it on). */
  readonly canToggle: boolean;
}

/** Pre-formatted pieces of the hover text of the Admin key tile. */
export interface AdminKeyTipParts extends ZeroDayTipParts {
  /** Name of the bonus item a key-assisted critical run may drop, or `null` when there is none. */
  readonly bonusName: string | null;
  /** Chance in percent that one key-assisted critical run drops it. */
  readonly bonusPercent: string;
}

/** Pre-formatted pieces of the hover text of the Skill shard tile. */
export interface SkillShardTipParts {
  /** E.g. `"Skill shard"`. */
  readonly label: string;
  /** Levels one shard delays the XP scaling of its action by. */
  readonly levels: string;
  /** Shards held. */
  readonly count: string;
  /** Using one now would do something (one is held and some action is unlocked). */
  readonly canUse: boolean;
  /** Where the shard can drop from (empty while the Admin keys that make it possible cannot be had). */
  readonly drops: readonly DropChanceParts[];
}

/** Pre-formatted pieces of the hover text of a stack of Burn leads. */
export interface BurnLeadTipParts {
  /** E.g. `"Common Burn lead"`. */
  readonly label: string;
  /** The share of the current heat one lead removes, in percent. */
  readonly sharePercent: string;
  /** Where the lead can drop from (empty while no action can drop it). */
  readonly drops: readonly DropChanceParts[];
  /** Heat now. */
  readonly heat: string;
  /** What the heat would be after using one lead now. */
  readonly heatAfter: string;
  /** Leads held. */
  readonly count: string;
  /** Using one now would do something (a lead is held and there is heat). */
  readonly canUse: boolean;
}

/** Pre-formatted pieces of the Moles explanation. */
export interface MolesTipParts {
  /** Moles held. */
  readonly moles: string;
  /** The extra cooldown speed while Moles remain, in percent. */
  readonly boostPercent: string;
  /** With Deep Cover: how much faster the Moles held make heat cool, in percent; `null` while Moles are still spent. */
  readonly aggregatedPercent: string | null;
}

/** Pre-formatted pieces of the explanation of the back channel button on an inventory stack. */
export interface BackChannelTipParts {
  /** E.g. `"Common Kompromat file"`. */
  readonly label: string;
  /** Moles one item given up is worth. */
  readonly molesPerItem: string;
  /** The extra cooldown speed while Moles remain, in percent. */
  readonly boostPercent: string;
}

/** Pre-formatted pieces of the hover text of an inventory stack. */
export interface StackTipParts {
  /** Where the stack can drop from (empty while no action can drop it). */
  readonly drops: readonly DropChanceParts[];
  /** E.g. `"Common Kompromat file"`. */
  readonly label: string;
  /** What one item sells for. */
  readonly sellValue: string;
  /** Items held. */
  readonly count: string;
  /** What the whole stack sells for. */
  readonly total: string;
  /** Display unit of the price. */
  readonly unit: string;
}
