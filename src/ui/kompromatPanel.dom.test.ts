// @vitest-environment happy-dom
/** Automation switch wiring tests. Called by: Vitest. Calls: shared Kompromat and DOM kits. */
import { afterEach, describe, expect, it } from 'vitest';
import { mountTestUi, openTab } from '../testing/domMountKit';
import { kompromatGame } from '../testing/kompromatKit';

afterEach(() => {
  document.body.replaceChildren();
});

describe('Kompromat protocol switches', () => {
  it('delegates each protocol chip to its own control and preserves unsupported disabled chips', () => {
    const game = kompromatGame(true);
    const root = document.createElement('div');
    document.body.append(root);
    mountTestUi(root, game);
    openTab(root, 'automation');
    const sale = root.querySelector<HTMLButtonElement>('[data-protocol="autosale"][data-rarity="common"]')!;
    const channel = root.querySelector<HTMLButtonElement>('[data-protocol="backchannel"][data-rarity="common"]')!;
    sale.click();
    expect(game.automation().isAutosaleOn('common')).toBe(true);
    expect(game.automation().isAutoBackchannelOn('common')).toBe(false);
    channel.click();
    expect(game.automation().isAutoBackchannelOn('common')).toBe(true);
    expect(sale.getAttribute('aria-pressed')).toBe('true');
  });
});
