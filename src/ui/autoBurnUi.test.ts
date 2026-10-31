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

describe('the Auto Burn box in the Automation tab', () => {
  it('shows no switch and no input before their skills are owned, and no on/off button at all', () => {
    const { render, shown, box } = mount(1);
    render();
    expect(shown('.automation-switch')).toEqual([]);
    expect(shown('.automation-field')).toEqual([]);
    expect(box().querySelector('.automation-hint')).not.toBeNull();
  });

  it('shows each switch once its skill is owned, and a click sets it', () => {
    const { game, render, shown } = mount(3);
    render();
    expect(shown('.automation-switch').map((b) => b.textContent)).toEqual(['Hold at lower threshold', 'Switch on at upper threshold']);
    shown('.automation-switch')[0]!.click();
    expect(game.automation().autoBurn().rules().hold).toBe(true);
    render();
    expect(shown('.automation-switch')[0]!.classList.contains('on')).toBe(true);
  });

  it('shows the thresholds and the reserve with skills 8 and 9, and they change the settings', () => {
    const { game, render, shown } = mount(9);
    render();
    const inputs = shown('.automation-field input') as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(['10', '50', '0']);
    inputs[0]!.value = '20';
    inputs[0]!.dispatchEvent(new Event('change'));
    inputs[2]!.value = '4';
    inputs[2]!.dispatchEvent(new Event('change'));
    expect(game.automation().autoBurn().rules()).toMatchObject({ lower: 20, upperAt: 50, reserve: 4 });
  });
});

describe('the resume checklists', () => {
  it('appear under their switch with the owned heat-making things, and a tick sets the setting', () => {
    const { game, render, shown, box } = mount(7);
    render();
    const names = shown('.automation-check').map((r) => r.textContent);
    expect(names).toContain('hot');
    expect(names).not.toContain('cold'); // its Overclock makes no heat
    const hot = [...box().querySelectorAll<HTMLElement>('.automation-check')].find((r) => r.textContent === 'hot')!;
    const input = hot.querySelector('input')!;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    render();
    expect(Object.keys(game.automation().autoBurn().rules().resumeOverclocks)).toEqual(['hot']);
    expect(buildViewModel(game).automation.autoBurn.resumeOverclocks.items.find((i) => i.id === 'hot')?.ticked).toBe(true);
  });

  it('stay hidden before their skills are owned', () => {
    const { render, shown } = mount(5);
    render();
    expect(shown('.automation-checklist')).toEqual([]);
  });
});
