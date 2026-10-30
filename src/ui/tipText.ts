/**
 * @module ui
 *
 * The wording of every hover text: calculation tips (formulas, variables, result), item tips and purchase tips.
 *
 * @remarks
 * Part of the text table: `uiText.ts` holds it as `tips`. Entries receive already-formatted strings from the view model.
 */
import { actionTips } from './tipTextActions';
import { itemTips } from './tipTextItems';
import { sleeveTips } from './tipTextSleeve';
import type { TipTexts } from './tipTextTypes';

/** The hover texts of the interface: the three tables by area, merged. */
export const tipText: TipTexts = { ...sleeveTips, ...actionTips, ...itemTips };
