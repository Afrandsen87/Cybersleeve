// @vitest-environment happy-dom
/**
 * Auto Burn on the screen: the Inventory Burn lead tile (a click that uses a lead, then a toggle once skill 1 is owned) and the Auto Burn box in the
 * Automation tab (only what the owned skills added is shown).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { burnGame, burnState } from '../testing/autoBurnKit';
import { mountTestUi } from '../testing/domMountKit';
import { buildViewModel } from './viewModel';

const mount = (steps: number) => {
  const root = document.createElement('div');
  document.body.append(root);
  const game = burnGame(steps, 5, 100);
  const render = mountTestUi(root, game);
  const tile = () => [...root.querySelectorAll<HTMLButtonElement>('.item-tile')].find((t) => t.getAttribute('aria-label') === 'Lead')!;
  const box = () => root.querySelector<HTMLElement>('.automation-autoBurn')!;
  const shown = (selector: string) => [...box().querySelectorAll<HTMLElement>(selector)].filter((e) => !e.hidden);
  return { root, game, render, tile, box, shown };
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Burn lead tile', () => {
  it('before the first skill a click uses one lead, and the tile is no toggle', () => {
    const { game, render, tile } = mount(0);
    render();
    expect(buildViewModel(game).inventory.rows.find((r) => r.itemId === 'lead')).toMatchObject({ usable: true, toggleable: false });
    tile().click();
    expect(burnState(game).inventory['lead']!['common']).toBe(4);
  });

  it('with the first skill a click switches the toggle, and the tile shows it is on', () => {
    const { game, render, tile } = mount(1);
    render();
    expect(buildViewModel(game).inventory.rows.find((r) => r.itemId === 'lead')).toMatchObject({
      usable: false,
      toggleable: true,
      on: false,
    });
    tile().click();
    expect(game.burnLeadToggle()?.on).toBe(true);
    expect(burnState(game).inventory['lead']!['common']).toBe(5); // switching it uses nothing by itself
    render();
    expect(tile().classList.contains('on')).toBe(true);
    tile().click();
    expect(game.burnLeadToggle()?.on).toBe(false);
  });

  it('its tip explains the rule in force', () => {
    const { game } = mount(2);
    const tip = () => buildViewModel(game).inventory.rows.find((r) => r.itemId === 'lead')!.tip;
    expect(tip()).toContain('uses one lead every second');
    game.automation().autoBurn().setSwitch('hold', true);
    expect(tip()).toContain('bring heat down to 10');
  });
});

describe('the Auto Burn panel commands', () => {
  it('shows plain notch values before Tune Thresholds and inputs after it', () => {
    const fixed = mount(7);
    fixed.render();
    expect(fixed.box().querySelector<HTMLInputElement>('.notch-label.floor input')!.hidden).toBe(true);
    expect(fixed.box().querySelector('.notch-label.floor')!.textContent).toBe('Floor10');
    const editable = mount(8);
    editable.render();
    expect(editable.box().querySelector<HTMLInputElement>('.notch-label.floor input')!.hidden).toBe(false);
    expect(editable.box().querySelector<HTMLInputElement>('.notch-label.redline input')!.hidden).toBe(false);
  });
  it('wires both LED switches and failsafe chips through the existing controls', () => {
    const { game, render, box } = mount(5);
    render();
    box().querySelector<HTMLButtonElement>('.t-throttle .led')!.click();
    box().querySelector<HTMLButtonElement>('.t-trigger .led')!.click();
    box().querySelector<HTMLButtonElement>('.t-failsafe .chip')!.click();
    expect(game.automation().autoBurn().rules()).toMatchObject({ hold: true, upper: true, offOverclocks: true });
  });
  it('wires threshold and Reserve inputs and preserves focused input text', () => {
    const { game, render, box } = mount(9);
    render();
    const input = box().querySelector<HTMLInputElement>('.notch-label.floor input')!;
    input.value = '20';
    input.dispatchEvent(new Event('change'));
    const reserve = box().querySelector<HTMLInputElement>('.status input')!;
    reserve.value = '4';
    reserve.dispatchEvent(new Event('change'));
    expect(game.automation().autoBurn().rules()).toMatchObject({ lower: 20, upperAt: 50, reserve: 4 });
    input.focus();
    input.value = '7';
    render();
    expect(input.value).toBe('7');
  });
  it('keeps chips mounted across renders and wires both restart target types', () => {
    const { game, render, box } = mount(7);
    render();
    const chips = [...box().querySelectorAll<HTMLButtonElement>('.t-restart .chip')];
    const auto = chips.find((c) => c.textContent === 'hotAUTO-RUN')!;
    const oc = chips.find((c) => c.textContent === 'hotOVERCLOCK')!;
    auto.click();
    oc.click();
    render();
    expect(game.automation().autoBurn().rules()).toMatchObject({ resumeAutoRuns: { 'auto-hot': true }, resumeOverclocks: { hot: true } });
    expect(box().contains(auto)).toBe(true);
    expect(auto.classList.contains('on')).toBe(true);
    expect(box().contains(oc)).toBe(true);
  });
});
