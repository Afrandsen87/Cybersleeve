/**
 * @module content/automationSkillIcons
 *
 * Unique 16x16 art for every automation skill. Each lane has its own emblem in the top rows (a flame for Auto Burn, a coin for
 * Autosale, a burst for Dispersal) and a ten-cell progress bar underneath that is filled up to the skill's step, so no two
 * skills look the same. Grids are built once at load from the lane emblems; pure display data.
 *
 * @remarks
 * Called by: `icons.ts`, which spreads {@link AUTOMATION_ART_GRIDS} into `ICON_GRIDS` and {@link AUTOMATION_ART_ICONS} into
 * `ENTITY_ICONS`. Calls: `automationSkillId` and the lane ids from `ids.ts`.
 */
import { AUTOMATION_LINE_LENGTH, automationSkillId, BRANCH_AUTO_BURN, BRANCH_AUTOSALE, BRANCH_DISPERSAL } from './ids';

/** The emblem rows (rows 1 to 10 of the icon) of each lane, and the colour of its filled progress cells. */
const EMBLEMS: Readonly<Record<string, { readonly rows: readonly string[]; readonly fill: string }>> = {
  [BRANCH_AUTO_BURN]: {
    fill: 'o',
    rows: [
      '.......o........',
      '......oo...o....',
      '.....ooyo.ooo...',
      '....ooyyoooyo...',
      '...ooyyyyoyyyo..',
      '...oyyywyyyyyo..',
      '...oyywwwyyyyo..',
      '....oyywwyyyo...',
      '.....ooyyyoo....',
      '.......oo.......',
    ],
  },
  [BRANCH_AUTOSALE]: {
    fill: 'y',
    rows: [
      '....oooooooo....',
      '...oyyyyyyyyo...',
      '..oyyoooooyyyo..',
      '..oyyoyyyyyyyo..',
      '..oyyooooooyyo..',
      '..oyyyyyyyoyyo..',
      '..oyyooooooyyo..',
      '...oyyyyyyyyo...',
      '....oooooooo....',
      '................',
    ],
  },
  [BRANCH_DISPERSAL]: {
    fill: 'c',
    rows: [
      '..c....cc....c..',
      '...c...cc...c...',
      '....c..cc..c....',
      '.....C.cc.C.....',
      'c.....CwwC.....c',
      'cccccCwwwwCccccc',
      'c.....CwwC.....c',
      '.....C.cc.C.....',
      '....c..cc..c....',
      '...c...cc...c...',
    ],
  },
};

/** Column of the first progress cell; the ten cells fill columns 3 to 12. */
const BAR_START = 3;

/** The grid of one skill: its lane emblem, then a bar of ten cells of which the first `step` are lit. Called by the loop below. */
function buildGrid(branch: string, step: number): readonly string[] {
  const emblem = EMBLEMS[branch];
  if (!emblem) throw new Error(`no emblem for automation lane ${branch}`);
  const { rows, fill } = emblem;
  const barRow = Array.from({ length: 16 }, (_, col) => {
    const cell = col - BAR_START;
    if (cell < 0 || cell >= AUTOMATION_LINE_LENGTH) return '.';
    return cell < step ? fill : 'S';
  }).join('');
  return ['................', ...rows, '................', barRow, barRow, '................', '................'];
}

/** The grid name of an automation skill's own picture. */
const gridName = (branch: string, step: number): string => `auto-${branch}-${step}`;

/** One grid per automation skill, by name. */
export const AUTOMATION_ART_GRIDS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.keys(EMBLEMS).flatMap((branch) =>
    Array.from({ length: AUTOMATION_LINE_LENGTH }, (_, i) => [gridName(branch, i + 1), buildGrid(branch, i + 1)] as const),
  ),
);

/** Which grid of {@link AUTOMATION_ART_GRIDS} each automation skill shows, by skill id. */
export const AUTOMATION_ART_ICONS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.keys(EMBLEMS).flatMap((branch) =>
    Array.from({ length: AUTOMATION_LINE_LENGTH }, (_, i) => [automationSkillId(branch, i + 1), gridName(branch, i + 1)] as const),
  ),
);
