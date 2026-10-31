/**
 * The v8 -> v9 migration (the change batch): reveal ledger, Auto Burn resume lists, Pick Targets dropped, and the sleeve-level total on the
 * newest run record (a post-load step through `SaveGame`).
 *
 * Called by: vitest. Calls: `migrateSave`, `migrateV8`, `needsProgressionBackfill`, `SaveGame`, `MemoryStore`, real content ids.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../content/gameConfig';
import { MemoryStore, SAVE_KEY, SaveGame } from '../../app/persistence';
import { numberFactory } from '../../numbers';
import { SAVE_VERSION } from '..';
import { migrateSave, migrateV8, needsProgressionBackfill } from './migrate';

const PICK_TARGETS = 'skill-autoBurn-8';
const v8 = (extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    version: 8,
    wallet: {
      runs: [
        { creditsPerSecond: '5', actionLevelsTotal: 3 },
        { creditsPerSecond: '9', actionLevelsTotal: 7 },
      ],
    },
    sleeves: {
      main: { purchased: { [PICK_TARGETS]: 1, other: 2 }, autoBurn: { overclocksOff: { a: true }, autoRunsOff: { b: true } }, ...extra },
    },
  });

describe('v8 to v9', () => {
  it('writes the current version and adds the ledger', () => {
    expect(SAVE_VERSION).toBe(10);
    const out = JSON.parse(
      migrateSave(
        v8(),
        gameConfig.buyables.filter((b) => b.currency === 'resleevePoints').map((b) => b.id),
      ),
    );
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.wallet.revealed).toEqual([]);
  });

  it('drops Pick Targets and pre-ticks the resume lists from the off lists', () => {
    const out = JSON.parse(
      migrateSave(
        v8(),
        gameConfig.buyables.filter((b) => b.currency === 'resleevePoints').map((b) => b.id),
      ),
    );
    expect(out.sleeves.main.purchased).toEqual({ other: 2 });
    expect(out.wallet.automation.autoBurn.resumeOverclocks).toEqual({ a: true });
    expect(out.wallet.automation.autoBurn.resumeAutoRuns).toEqual({ b: true });
  });

  it('is pure and tolerates a save without sleeves', () => {
    const input = { version: 8, wallet: {} };
    expect(migrateV8(input)).toMatchObject({ version: 9 });
    expect(input).toEqual({ version: 8, wallet: {} });
  });

  it('flags only older saves for the post-load backfill', () => {
    expect(needsProgressionBackfill(v8())).toBe(true);
    expect(needsProgressionBackfill(JSON.stringify({ version: 9 }))).toBe(false);
    expect(needsProgressionBackfill('not json')).toBe(false);
  });

  it('SaveGame loads a v8 save: older runs get 0, the newest the current sleeve-level total, then it round trips', () => {
    const golden = JSON.parse(
      readFileSync(new URL('../../testing/fixtures/saves/v9-after-three-resleeves.golden.json', import.meta.url), 'utf8'),
    ) as { version: number; wallet: { runs: unknown[] } };
    const runCount = golden.wallet.runs.length;
    const store = new MemoryStore();
    const save = new SaveGame(store, gameConfig, numberFactory);
    store.setItem(SAVE_KEY, JSON.stringify({ ...golden, version: 8 }));
    const state = save.load()!;
    const totals = state.wallet.runs.map((r) => r.sleeveLevelsTotal);
    expect(totals.slice(0, -1).every((t) => t === 0)).toBe(true);
    expect(totals).toHaveLength(runCount);
    expect(state.wallet.revealed).toEqual([]);
    expect(save.save(state)).toBe(true);
    expect(save.load()!.wallet.runs.map((r) => r.actionLevelsTotal)).toEqual(state.wallet.runs.map((r) => r.actionLevelsTotal));
  });

  it('importing a v8 save stores the backfilled state, so the next load does not lose the backfill', () => {
    const golden = JSON.parse(
      readFileSync(new URL('../../testing/fixtures/saves/v9-after-three-resleeves.golden.json', import.meta.url), 'utf8'),
    ) as object;
    const store = new MemoryStore();
    const save = new SaveGame(store, gameConfig, numberFactory);
    expect(save.importText(JSON.stringify({ ...golden, version: 8 }))).toBe(true);
    expect(JSON.parse(store.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION);
    expect(needsProgressionBackfill(store.getItem(SAVE_KEY)!)).toBe(false);
    const runs = save.load()!.wallet.runs;
    expect(runs[runs.length - 1]!.sleeveLevelsTotal).toBe(save.load()!.wallet.runs[runs.length - 1]!.sleeveLevelsTotal);
  });
});
