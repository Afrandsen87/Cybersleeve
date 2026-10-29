/**
 * The v7 save text, byte for byte, for two real saves.
 *
 * Purpose: the per-context save hooks (S8b) must not change what is written. The golden files were produced by the code BEFORE the hooks existed:
 * a fixture (v6) is migrated, loaded and saved, and the text must equal the golden file exactly (key order included). The golden files may be pretty-printed by the formatter; they are compared as compact text, which keeps key order.
 * Called by: vitest. Calls: `migrateSave`, `deserializeState`, `serializeState`, real content (`gameConfig`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../content/gameConfig';
import { numberFactory } from '../../numbers';
import { deserializeState, serializeState } from '..';
import { migrateSave } from './migrate';

const dir = new URL('../../testing/fixtures/saves/', import.meta.url);
const CASES = [
  ['v6-early-before-resleeve.json', 'v7-early-before-resleeve.golden.json'],
  ['v6-after-three-resleeves.json', 'v7-after-three-resleeves.golden.json'],
] as const;

describe.each(CASES)('save text of %s', (fixture, golden) => {
  const saved = (): string =>
    serializeState(deserializeState(migrateSave(readFileSync(new URL(fixture, dir), 'utf8')), gameConfig, numberFactory)!);

  it('equals the golden v7 text exactly', () => {
    expect(saved()).toBe(JSON.stringify(JSON.parse(readFileSync(new URL(golden, dir), 'utf8'))));
  });

  it('saving the loaded text again gives the same text', () => {
    const once = saved();
    expect(serializeState(deserializeState(once, gameConfig, numberFactory)!)).toBe(once);
  });
});
