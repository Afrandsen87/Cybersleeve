/** Automation context: additive settings, defensive permissions and removed-placeholder refunds. */
import { createGame } from '../../app/createGame';
import { describe, expect, it } from 'vitest';
import { deserializeState, serializeState } from '..';
import { numberFactory } from '../../numbers';
import { rarityConfig, rarityGame } from '../../testing/rarityAutomationKit';

describe('rarity automation saves', () => {
  it('round-trips both maps and drops unknown or locked rarities', () => {
    const g = rarityGame([1, 2, 3, 4]);
    g.automation().setAutosale('common', true);
    g.automation().setAutoBackchannel('common', true);
    const text = serializeState(g.getState());
    expect(JSON.parse(serializeState(deserializeState(text, rarityConfig, numberFactory)!))).toEqual(JSON.parse(text));
    const data = JSON.parse(text);
    data.wallet.automation.autosale = { common: true, legendary: true, unknown: true };
    data.wallet.automation.autoBackchannel = { common: true, rare: true, unknown: true };
    const restored = deserializeState(JSON.stringify(data), rarityConfig, numberFactory)!;
    expect(restored.wallet.automation.autosale).toEqual({ common: true });
    expect(restored.wallet.automation.autoBackchannel).toEqual({ common: true });
  });
  it('loads missing settings off and removes slots 9/10, refunding their derived point cost', () => {
    const g = rarityGame([1, 2, 3, 7, 8, 9, 10]);
    const data = JSON.parse(serializeState(g.getState()));
    delete data.wallet.automation.autoBackchannel;
    const restored = deserializeState(JSON.stringify(data), rarityConfig, numberFactory)!;
    expect(restored.sleeve.purchased['skill-autosale-9']).toBeUndefined();
    expect(restored.sleeve.purchased['skill-autosale-10']).toBeUndefined();
    expect(restored.wallet.automation.autoBackchannel).toEqual({});
    expect(createGame({ config: rarityConfig, state: restored }).automation().pointsAvailable()).toBe(15); // five retained skills; two removed placeholders refunded
  });
});
