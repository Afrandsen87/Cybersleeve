/**
 * The v7 -> v8 migration: the old Unlock resleeving purchase became Sleeve levels, and the new Unlock resleeving is granted to every sleeve
 * that owned it.
 *
 * Called by: vitest. Calls: `migrateSave`, `migrateV7`, `deserializeState`, real content (`gameConfig`, ids).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../content/gameConfig';
import { RESLEEVE_UNLOCK, SLEEVE_LEVELS } from '../../content/ids';
import { numberFactory } from '../../numbers';
import { SAVE_VERSION, deserializeState } from '..';
import { migrateSave, migrateV7 } from './migrate';

const read = (name: string): string => readFileSync(new URL(`../../testing/fixtures/saves/${name}`, import.meta.url), 'utf8');
const v7 = (purchased: Record<string, number>): string =>
  JSON.stringify({ version: 7, wallet: {}, sleeves: { main: { purchased, heat: 3 } } });
const purchasedOf = (text: string): Record<string, number> => JSON.parse(text).sleeves.main.purchased;

describe('v7 to v8', () => {
  it('writes the current version', () => {
    expect(SAVE_VERSION).toBe(8);
    expect(JSON.parse(migrateSave(v7({}))).version).toBe(SAVE_VERSION);
  });

  it('grants Unlock resleeving to a save that owns Sleeve levels, and keeps everything else', () => {
    const out = JSON.parse(migrateSave(v7({ [SLEEVE_LEVELS]: 1, other: 2 })));
    expect(out.sleeves.main.purchased).toEqual({ [SLEEVE_LEVELS]: 1, other: 2, [RESLEEVE_UNLOCK]: 1 });
    expect(out.sleeves.main.heat).toBe(3);
  });

  it('does not grant it to a save that does not own Sleeve levels', () => {
    expect(purchasedOf(migrateSave(v7({ other: 2 })))).toEqual({ other: 2 });
    expect(purchasedOf(migrateSave(v7({ [SLEEVE_LEVELS]: 0 })))).toEqual({ [SLEEVE_LEVELS]: 0 });
    expect(purchasedOf(migrateSave(v7({})))).toEqual({});
  });

  it('uses the ids of the real content', () => {
    const ids = gameConfig.buyables.map((b) => b.id);
    expect(ids).toContain(SLEEVE_LEVELS);
    expect(ids).toContain(RESLEEVE_UNLOCK);
    expect(SLEEVE_LEVELS).toBe('sleeve-levels');
    expect(RESLEEVE_UNLOCK).toBe('resleeve-unlock');
  });

  it('is applied once: a v8 save is left as it is', () => {
    const once = migrateSave(v7({ [SLEEVE_LEVELS]: 1 }));
    expect(migrateSave(once)).toBe(once);
  });

  it('does not change its input and tolerates a save without sleeves or with odd shapes', () => {
    const input = { version: 7, sleeves: { main: { purchased: { [SLEEVE_LEVELS]: 1 } } } };
    const copy = JSON.parse(JSON.stringify(input));
    migrateV7(input);
    expect(input).toEqual(copy);
    expect(migrateV7({ version: 7 })).toEqual({ version: 8 });
    expect(migrateV7({ version: 7, sleeves: { main: null } })).toEqual({ version: 8, sleeves: { main: null } });
    expect(migrateV7({ version: 7, sleeves: { main: { purchased: 'x' } } })).toEqual({ version: 8, sleeves: { main: { purchased: 'x' } } });
  });

  it.each(['v7-early-before-resleeve.json', 'v7-after-three-resleeves.json'])('a real v7 save (%s) migrates and loads', (name) => {
    const text = read(name);
    const owned = (JSON.parse(text).sleeves.main.purchased[SLEEVE_LEVELS] ?? 0) > 0;
    const state = deserializeState(migrateSave(text), gameConfig, numberFactory)!;
    expect(state).not.toBeNull();
    expect(state.sleeve.purchased[RESLEEVE_UNLOCK] ?? 0).toBe(owned ? 1 : 0);
    expect(deserializeState(text, gameConfig, numberFactory)).toBeNull(); // v7 is not read as it is
  });
});
