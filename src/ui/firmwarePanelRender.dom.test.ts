// @vitest-environment happy-dom
/**
 * @module ui
 * When the Firmware tab draws: nothing while hidden (a hover in progress is dropped), and the inspector only when what it reads changed.
 * Called by: Vitest. Calls: mountSkillsPanel, buildViewModel, widgetContext.
 */
import { describe, expect, it, vi } from 'vitest';
import { pointGame } from '../testing/skillsTabKit';
import { widgetContext } from '../testing/widgetKit';
import { buildViewModel } from './viewModel';
import { mountSkillsPanel } from './widgets/skillsPanel';

/** A Firmware panel over the small skills config, drawn once while shown. */
function shownPanel() {
  const game = pointGame();
  const ctx = widgetContext(game, vi.fn(), vi.fn());
  const view = buildViewModel(game).skills;
  const panel = mountSkillsPanel(ctx, view);
  panel.render(view);
  const name = (): string => panel.root.querySelector('.inspector-name')!.textContent ?? '';
  return { game, panel, view, name };
}

describe('Firmware tab drawing', () => {
  it('draws nothing while the tab is hidden, and catches up when it is shown again', () => {
    const { game, panel } = shownPanel();
    const points = (): string => panel.root.querySelector('.firmware-points .n')!.textContent ?? '';
    expect(points()).toBe('1');
    panel.root.hidden = true;
    game.buy('s1');
    panel.render(buildViewModel(game).skills);
    expect(points()).toBe('1');
    expect(panel.root.querySelector('[data-id="s1"]')!.classList.contains('installed')).toBe(false);
    panel.root.hidden = false;
    panel.render(buildViewModel(game).skills);
    expect(points()).toBe('0');
    expect(panel.root.querySelector('[data-id="s1"]')!.classList.contains('installed')).toBe(true);
  });

  it('drops a hover that was in progress when the tab was left', () => {
    const { panel, view, name } = shownPanel();
    panel.root.querySelector('[data-id="s1"]')!.dispatchEvent(new Event('click'));
    panel.root.querySelector('[data-id="s2"]')!.dispatchEvent(new Event('mouseenter'));
    expect(name()).toBe('Skill s2');
    panel.root.hidden = true;
    panel.render(view);
    panel.root.hidden = false;
    panel.render(view);
    expect(name()).toBe('Skill s1');
    expect(panel.root.querySelectorAll('.onpath, .next')).toHaveLength(0);
  });

  it('rebuilds the inspector only when a node or the points changed', () => {
    const { game, panel, name } = shownPanel();
    const label = panel.root.querySelector('.inspector-name')!;
    label.textContent = 'untouched';
    panel.render(buildViewModel(game).skills);
    expect(name()).toBe('untouched');
    game.buy('s1');
    panel.render(buildViewModel(game).skills);
    expect(name()).not.toBe('untouched');
  });
});
