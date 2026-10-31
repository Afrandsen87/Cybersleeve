// @vitest-environment happy-dom
/** Automation-context target chip commands. Called by: Vitest. Calls: dispersalPanelGame, mountDispersalPanel. */
import { expect, it, vi } from 'vitest';
import { dispersalPanelGame } from '../testing/dispersalPanelKit';
import { widgetContext } from '../testing/widgetKit';
import { uiText } from './uiText';
import { buildDispersalView } from './view/dispersalView';
import { mountDispersalPanel } from './widgets/automation/dispersalPanel';

it('routes target chips through the owner and updates the meter and capacity', () => {
  const { game, config } = dispersalPanelGame();
  const controls = game.automation();
  const command = vi.spyOn(controls, 'setDispersalTarget');
  const refresh = vi.fn();
  const ctx = widgetContext(game, vi.fn(), refresh);
  const view = () => buildDispersalView(game, config, uiText.automation.dispersal);
  const panel = mountDispersalPanel(ctx, view(), controls, refresh);
  panel.render(view());
  const firstSlot = panel.controlTargets.get('slot-1');
  expect(firstSlot).toBe(panel.element.querySelector('.slots i'));
  expect(panel.controlTargets.get('ds-status')).toBe(panel.element);
  expect([...panel.controlTargets.keys()].filter((key) => key.startsWith('slot-'))).toHaveLength(view().maxSlots);
  expect(panel.controlTargets.get('row-target')?.contains(panel.targets.get('b')!)).toBe(true);
  panel.targets.get('b')!.click();
  expect(command).toHaveBeenCalledWith('b', true);
  expect(refresh).toHaveBeenCalledOnce();
  panel.render(view());
  expect(panel.targets.get('a')!.disabled).toBe(true);
  expect(panel.targets.get('b')!.getAttribute('aria-pressed')).toBe('true');
  expect(panel.element.querySelectorAll('.slots i.on')).toHaveLength(1);
  expect(panel.controlTargets.get('slot-1')).toBe(firstSlot);
  panel.targets.get('b')!.click();
  expect(command).toHaveBeenLastCalledWith('b', false);
});
