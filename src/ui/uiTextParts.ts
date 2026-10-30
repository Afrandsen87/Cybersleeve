/**
 * @module ui
 *
 * The identifiers and the fill-in parts the text table is made of: what each tooltip and label function receives.
 *
 * @remarks
 * Pure types. The functions that turn these parts into words are in `uiText.ts` and `tipText.ts`; the view model in
 * `ui/view/` builds the parts. Re-exported by `uiText.ts`, so other files import them from there.
 */
export * from './parts/idParts';
export * from './parts/sleeveTipParts';
export * from './parts/actionTipParts';
export * from './parts/itemTipParts';
export * from './parts/buyableTipParts';
