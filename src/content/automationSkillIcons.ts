/**
 * @module content/automationSkillIcons
 * Automation context: rarity-tinted files, schematics and numbered target badges derived from lane effects.
 * Called by: icons.ts. Calls: autosaleSkills, dispersalSkills; generates immutable display grids at module load.
 */
import { AUTO_BURN_ART_GRIDS, AUTO_BURN_ART_ICONS } from './autoBurnSkillIcons';
import { autosaleSkills } from './buyables/skillBranches/autosaleLane';
import { dispersalSkills } from './buyables/skillBranches/dispersalLane';

/** Palette letters matching inventory rarity colours. Called by: buildGrid. Calls: nothing. */
const TINT: Readonly<Record<string, string>> = { common: 'c', uncommon: 'g', rare: 'b', legendary: 'm', crisis: 'o' };
/** Mockup bases; X/x are replaced with the lane permission's rarity colour. Called by: buildGrid. Calls: nothing. */
const BASE = {
  file: [
    '.XXXXXX....',
    '.XwwwwXX...',
    '.XwwwwXwX..',
    '.XwwwwXXXX.',
    '.Xwsssswwx.',
    '.Xwwwwwwwx.',
    '.Xwssssssx.',
    '.Xwwwwwwwx.',
    '.Xwsssswwx.',
    '.Xwwwwwwwx.',
    '.XXXXXXXXX.',
  ],
  schematic: [
    'XXXXXXXXXXX',
    'X.S.S.S.S.X',
    'XSwwwwwwwSX',
    'X.w.S.S.w.X',
    'XSw.XXX.wSX',
    'X.w.XwX.w.X',
    'XSw.XXX.wSX',
    'X.w.S.S.w.X',
    'XSwwwwwwwSX',
    'X.S.S.S.S.X',
    'XXXXXXXXXXX',
  ],
  cross: [
    '.....c.....',
    '...ccccc...',
    '..c..c..c..',
    '.c...c...c.',
    '.c.......c.',
    'cccc.w.cccc',
    '.c.......c.',
    '.c...c...c.',
    '..c..c..c..',
    '...ccccc...',
    '.....c.....',
  ],
} as const;
/** Mockup badges in the shared sixteen-colour palette. Called by: buildGrid. Calls: nothing. */
const BADGE = {
  coin: ['..yyy..', '.yyyyy.', 'yyykyyy', 'yykyyyy', 'yyykyyy', '.yyyyy.', '..yyy..'],
  phone: ['ooo....', 'ooo....', '.o.....', '.oo....', '..oo.oo', '...oooo', '....ooo'],
  spread: ['c..c..c', '.c.c.c.', '..ccc..', 'ccc.ccc', '..ccc..', '.c.c.c.', 'c..c..c'],
} as const;
/** Badge pips count the target slots granted so far. Called by: buildGrid. Calls: nothing. */
const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  2: [
    [1, 1],
    [5, 5],
  ],
  3: [
    [1, 1],
    [3, 3],
    [5, 5],
  ],
  4: [
    [1, 1],
    [5, 1],
    [1, 5],
    [5, 5],
  ],
  5: [
    [1, 1],
    [5, 1],
    [3, 3],
    [1, 5],
    [5, 5],
  ],
  6: [
    [1, 1],
    [5, 1],
    [1, 3],
    [5, 3],
    [1, 5],
    [5, 5],
  ],
};

/** Composes one 16x16 grid without modifying source art.
 * Called by: lane art generation below. Calls: nothing.
 * @param base base symbol
 * @param rarity optional tint permission
 * @param badge optional operation badge
 * @param slots optional cumulative target count
 * @returns sixteen palette rows
 */
function buildGrid(base: keyof typeof BASE, rarity?: string, badge?: keyof typeof BADGE, slots?: number): readonly string[] {
  const grid = Array.from({ length: 16 }, () => Array<string>(16).fill('.'));
  for (const [y, row] of BASE[base].entries()) {
    for (const [x, pixel] of [...row].entries()) grid[y + 1]![x + 1] = pixel === 'X' || pixel === 'x' ? (TINT[rarity ?? ''] ?? 'c') : pixel;
  }
  for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) grid[y]![x] = 'k';
  if (badge) {
    for (const [y, row] of BADGE[badge].entries())
      for (const [x, pixel] of [...row].entries()) if (pixel !== '.') grid[y + 9]![x + 9] = pixel;
  } else {
    for (let i = 8; i < 16; i++) {
      grid[8]![i] = 'w';
      grid[i]![8] = 'w';
    }
    for (const [x, y] of PIPS[slots ?? 0] ?? []) grid[y + 9]![x + 9] = 'w';
  }
  return grid.map((row) => row.join(''));
}

/** Content-derived art entries. Called by: exported maps. Calls: buildGrid. */
const laneArt: readonly (readonly [string, readonly string[]])[] = [
  ...autosaleSkills.map((skill) => {
    const effect = skill.effect;
    const rarity =
      effect.kind === 'unlocksAutomation'
        ? effect.allowsAutosale
        : effect.kind === 'allowsAutosale' || effect.kind === 'allowsAutoBackchannel'
          ? effect.rarity
          : undefined;
    return [skill.id, buildGrid('file', rarity, effect.kind === 'allowsAutoBackchannel' ? 'phone' : 'coin')] as const;
  }),
  ...dispersalSkills.map((skill, index) => {
    const effect = skill.effect;
    const rarity =
      effect.kind === 'unlocksAutomation' ? effect.allowsDispersal : effect.kind === 'allowsDispersal' ? effect.rarity : undefined;
    const slots = dispersalSkills
      .slice(0, index + 1)
      .reduce(
        (count, node) =>
          count +
          (node.effect.kind === 'dispersalSlots'
            ? node.effect.count
            : node.effect.kind === 'unlocksAutomation'
              ? (node.effect.dispersalSlots ?? 0)
              : 0),
        0,
      );
    return [skill.id, rarity ? buildGrid('schematic', rarity, 'spread') : buildGrid('cross', undefined, undefined, slots)] as const;
  }),
];
/** One unique grid per automation skill. Called by: icons.ts. Calls: nothing. */
export const AUTOMATION_ART_GRIDS: Readonly<Record<string, readonly string[]>> = {
  ...AUTO_BURN_ART_GRIDS,
  ...Object.fromEntries(laneArt.map(([id, grid]) => [`auto-${id}`, grid])),
};
/** Stable skill-to-grid mapping. Called by: icons.ts. Calls: nothing. */
export const AUTOMATION_ART_ICONS: Readonly<Record<string, string>> = {
  ...AUTO_BURN_ART_ICONS,
  ...Object.fromEntries(laneArt.map(([id]) => [id, `auto-${id}`])),
};
