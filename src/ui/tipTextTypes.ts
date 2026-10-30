/**
 * @module ui
 *
 * The shape of the hover texts (`UiText['tips']`), apart from their wording.
 *
 * @remarks
 * Split out of `uiText.ts` so that `tipText.ts` (the wording) and `uiText.ts` (the table that holds it) do not import each other.
 */
import type {
  AccessTipParts,
  ActionSpeedTipParts,
  AdminKeyTipParts,
  AugmentTipParts,
  BackChannelTipParts,
  BurnLeadTipParts,
  BuyableTipParts,
  BuyableValues,
  CriticalTipParts,
  FocusTipParts,
  HackingProficiencyTipParts,
  HeatTipParts,
  IceRatingTipParts,
  IncomeTipParts,
  InterfaceSpeedTipParts,
  LegendTipParts,
  MolesTipParts,
  NetworkGrowthValueParts,
  OverclockTipParts,
  PayoutTipParts,
  SkillShardTipParts,
  StackKeptTipParts,
  StackTipParts,
  SynthTipParts,
  ZeroDayTipParts,
} from './uiTextParts';

/**
 * Every hover text of the interface: each entry gets already-formatted parts from the view model and returns the text.
 *
 * Called by: `uiText.ts` (`UiText.tips`), `tipText.ts` (the wording).
 */
export interface TipTexts {
  access(parts: AccessTipParts): string;
  interfaceSpeed(parts: InterfaceSpeedTipParts): string;
  hackingProficiency(parts: HackingProficiencyTipParts): string;
  actionSpeed(parts: ActionSpeedTipParts): string;
  payout(parts: PayoutTipParts): string;
  income(parts: IncomeTipParts): string;
  heat(parts: HeatTipParts): string;
  iceRating(parts: IceRatingTipParts): string;
  legend(parts: LegendTipParts): string;
  critical(parts: CriticalTipParts): string;
  buyable(parts: BuyableTipParts): string;
  stack(parts: StackTipParts): string;
  augment(parts: AugmentTipParts): string;
  overclock(parts: OverclockTipParts): string;
  focus(parts: FocusTipParts): string;
  burnLead(parts: BurnLeadTipParts): string;
  zeroDay(parts: ZeroDayTipParts): string;
  adminKey(parts: AdminKeyTipParts): string;
  skillShard(parts: SkillShardTipParts): string;
  /** The tip of a stack of items that cannot be paid out (applied instead). */
  stackKept(parts: StackKeptTipParts): string;
  backChannel(parts: BackChannelTipParts): string;
  moles(parts: MolesTipParts): string;
  synths(parts: SynthTipParts): string;
  networkGrowthValues(parts: NetworkGrowthValueParts): BuyableValues;
}
