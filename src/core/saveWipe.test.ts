import { describe, expect, it } from 'vitest';
import { numberFactory } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { SAVE_VERSION, createConfig, createInitialState, deserializeState, serializeState } from './index';

const config = createConfig(testConfig, {});

/** The current save with its version replaced. */
function saveWithVersion(version: number): string {
  const data = JSON.parse(serializeState(createInitialState(config, numberFactory)));
  data.version = version;
  return JSON.stringify(data);
}

describe('the save wipe (version 6)', () => {
  it('a save of any earlier version is unreadable, so the game starts over', () => {
    for (let v = 0; v < SAVE_VERSION; v++) expect(deserializeState(saveWithVersion(v), config, numberFactory)).toBeNull();
  });

  it('a save of the current version is still read', () => {
    expect(deserializeState(saveWithVersion(SAVE_VERSION), config, numberFactory)).not.toBeNull();
  });
});
