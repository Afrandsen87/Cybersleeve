/**
 * The v10 save text, byte for byte, for two real saves.
 *
 * Purpose: the save text must not change by accident. A fixture (v6, and the same life written as v7) is migrated, loaded and saved, and the
 * text must equal the golden file exactly (key order included). The golden files may be pretty-printed by the formatter; they are compared as
 * compact text, which keeps key order. v8 differs from v7 only in the version and in the new Unlock resleeving purchase, which a save that
 * owned Sleeve levels (the old unlock) now also owns.
 * Called by: vitest. Calls: `migrateSave`, `deserializeState`, `serializeState`, real content (`gameConfig`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../content/gameConfig';
import { numberFactory } from '../../numbers';
import { deserializeState, serializeState, sleeveSkillIds } from '..';
import { migrateSave } from './migrate';

const dir = new URL('../../testing/fixtures/saves/', import.meta.url);
const CASES = [
  ['v6-early-before-resleeve.json', 'v10-early-before-resleeve.golden.json'],
  ['v6-after-three-resleeves.json', 'v10-after-three-resleeves.golden.json'],
  ['v7-early-before-resleeve.json', 'v10-early-before-resleeve.golden.json'],
  ['v7-after-three-resleeves.json', 'v10-after-three-resleeves.golden.json'],
] as const;

describe.each(CASES)('save text of %s', (fixture, golden) => {
  const saved = (): string =>
    serializeState(
      deserializeState(
        migrateSave(readFileSync(new URL(fixture, dir), 'utf8'), sleeveSkillIds(gameConfig.buyables)),
        gameConfig,
        numberFactory,
      )!,
    );

  it('equals the golden v10 text exactly', () => {
    expect(saved()).toBe(JSON.stringify(JSON.parse(readFileSync(new URL(golden, dir), 'utf8'))));
  });

  it('saving the loaded text again gives the same text', () => {
    const once = saved();
    expect(serializeState(deserializeState(once, gameConfig, numberFactory)!)).toBe(once);
  });
});
