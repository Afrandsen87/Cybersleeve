/** Automation context: additive target settings, defensive loading and removed-skill refunds. */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { deserializeState, serializeState } from '..';
import { numberFactory } from '../../numbers';
import { dispersalConfig, dispersalGame } from '../../testing/dispersalKit';

describe('dispersal save settings', () => {
  it('round trips target ids with stable serialized text', () => {
    const g = dispersalGame(2);
    g.automation().setDispersalTarget('a', true);
    g.automation().setDispersalTarget('b', true);
    const text = serializeState(g.getState());
    const restored = deserializeState(text, dispersalConfig, numberFactory)!;
    expect(restored.wallet.automation.dispersalTargets).toEqual(['a', 'b']);
    const once = serializeState(restored); // key order of the first text follows purchase order, so compare the second round
    expect(serializeState(deserializeState(once, dispersalConfig, numberFactory)!)).toBe(once);
  });
  it('drops unknown, access-locked, duplicate and over-cap targets in configuration order', () => {
    const data = JSON.parse(serializeState(dispersalGame(1).getState()));
    data.wallet.automation.dispersalTargets = ['unknown', 'locked', 'b', 'a', 'a'];
    const restored = deserializeState(JSON.stringify(data), dispersalConfig, numberFactory)!;
    expect(restored.wallet.automation.dispersalTargets).toEqual(['a']);
  });
  it('drops every target when the feature is locked', () => {
    const data = JSON.parse(serializeState(dispersalGame(0).getState()));
    data.wallet.automation.dispersalTargets = ['a'];
    expect(deserializeState(JSON.stringify(data), dispersalConfig, numberFactory)!.wallet.automation.dispersalTargets).toEqual([]);
  });
  it('ignores the former percentage map and defaults a missing target field to empty', () => {
    const data = JSON.parse(serializeState(dispersalGame(2).getState()));
    delete data.wallet.automation.dispersalTargets;
    data.wallet.automation.dispersal = { a: 50, b: 50 };
    const restored = deserializeState(JSON.stringify(data), dispersalConfig, numberFactory)!;
    expect(restored.wallet.automation.dispersalTargets).toEqual([]);
    expect(JSON.parse(serializeState(restored)).wallet.automation.dispersal).toBeUndefined();
  });
  it('drops removed slot 10 and refunds its derived point cost', () => {
    const data = JSON.parse(serializeState(dispersalGame(9).getState()));
    data.sleeves.main.purchased['skill-dispersal-10'] = 1;
    const restored = deserializeState(JSON.stringify(data), dispersalConfig, numberFactory)!;
    expect(restored.sleeve.purchased['skill-dispersal-10']).toBeUndefined();
    expect(createGame({ config: dispersalConfig, state: restored }).automation().pointsAvailable()).toBe(11);
  });
});
