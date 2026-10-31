// @vitest-environment happy-dom
/**
 * @module ui
 * Automation context: integrated docked selection, installation and control feedback.
 * Called by: Vitest. Calls: automationLaneBuyables, widgetContext, buildAutomationWidget.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../app/createGame';
import { gameConfig } from '../content/gameConfig';
import { flat } from '../testing/flatState';
import { automationAdds } from './view/automationAdds';
import { createConfig } from '../core';
import { num } from '../numbers';
import { automationLaneBuyables, laneSkillId } from '../testing/automationKit';
import { setCredits, testConfig } from '../testing/testConfig';
import { widgetContext } from '../testing/widgetKit';
import { buildViewModel } from './viewModel';
import { buildAutomationWidget, renderAutomation } from './widgets/automationWidget';

/** Shared DOM kit built from testConfig; queued frames never use browser timers.
 * Called by: integrated inspector cases. Calls: createGame, widgetContext, buildAutomationWidget.
 * @returns game, observed commands, mounted tab and fixed DOM accessors
 */
function kit() {
  const game = createGame({
    config: createConfig(testConfig, {
      automation: { autoBurnCeiling: 10, autoBurnUpper: 50 },
      buyables: [
        ...testConfig.buyables,
        {
          id: 'core',
          name: 'Core',
          description: '',
          cost: num(1),
          maxPurchases: Infinity,
          effect: { kind: 'automationPoints', perCopy: 1 },
        },
        ...automationLaneBuyables(),
      ],
    }),
  });
  setCredits(game, num(1e8));
  for (let i = 0; i < 20; i++) game.buy('core');
  const activate = vi.fn((id: string) => {
    game.buy(id);
  });
  const refresh = vi.fn();
  const ctx = widgetContext(game, activate, refresh);
  const view = () => buildViewModel(game).automation;
  const widget = buildAutomationWidget(ctx, view(), game.automation(), refresh);
  document.body.append(widget.root);
  renderAutomation(widget, view());
  const node = (id: string) => widget.root.querySelector<HTMLButtonElement>(`.skill-node[data-id="${id}"]`)!;
  const pane = () => widget.root.querySelector<HTMLElement>('.automation-slot > .firmware-inspector')!;
  const row = (lane: string) => widget.root.querySelector<HTMLElement>(`.automation-feat[data-feature="${lane}"]`)!;
  return { game, activate, refresh, ctx, widget, view, node, pane, row };
}

beforeEach(() => {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 0),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('Automation docked inspector', () => {
  it('registers every real-content addition target in mounted panels', () => {
    const config = createConfig(testConfig, gameConfig);
    const game = createGame({ config });
    const purchased = flat<{ purchased: Record<string, number> }>(game).purchased;
    for (const skill of config.buyables) purchased[skill.id] = 1;
    const ctx = widgetContext(
      game,
      () => {},
      () => {},
    );
    ctx.selection.revealAll = true;
    const view = buildViewModel(game, undefined, ctx.text, ctx.selection).automation;
    const widget = buildAutomationWidget(ctx, view, game.automation(), () => {});
    document.body.append(widget.root);
    const registered = new Map([...widget.autoBurn.controlTargets, ...widget.kompromat.controlTargets, ...widget.dispersal.controlTargets]);
    const skills = config.buyables.filter((skill) => skill.currency === 'automationPoints');
    for (const skill of skills) {
      const addition = automationAdds(skill, skills, (id) => id, ctx.text.firmware);
      expect(addition, skill.id).not.toBeNull();
      expect(registered.has(addition!.target), skill.id).toBe(true);
    }
  });

  it('restores the pin or closes when keyboard focus leaves a non-pinned lane', () => {
    const tab = kit();
    const other = tab.node(laneSkillId('autoBurn', 1));
    other.focus();
    other.blur();
    expect(tab.widget.root.querySelector('.automation-feat.open')).toBeNull();
    tab.node(laneSkillId('autosale', 1)).click();
    other.focus();
    expect(tab.row('autoBurn').classList.contains('open')).toBe(true);
    other.blur();
    expect(tab.row('autosale').classList.contains('open')).toBe(true);
    expect(tab.pane().querySelector('.inspector-name')!.textContent).toBe('autosale 1');
  });

  it('does not flash hidden purchases, but flashes visible increases and restarts feedback', () => {
    const tab = kit();
    renderAutomation(tab.widget, tab.view(), false);
    tab.game.buy(laneSkillId('autosale', 1));
    renderAutomation(tab.widget, tab.view(), false);
    renderAutomation(tab.widget, tab.view(), true);
    const target = tab.widget.kompromat.controlTargets.get('chip-sale-common')!;
    expect(target.classList.contains('fresh')).toBe(false);
    const burnTarget = tab.widget.autoBurn.controlTargets.get('ab-status')!;
    burnTarget.classList.add('fresh');
    const reflow = vi.spyOn(burnTarget, 'offsetWidth', 'get');
    tab.game.buy(laneSkillId('autoBurn', 1));
    renderAutomation(tab.widget, tab.view(), true);
    expect(burnTarget.classList.contains('fresh')).toBe(true);
    expect(reflow).toHaveBeenCalled();
  });

  it('remeasures masking and installation changes, but not point changes', () => {
    const tab = kit();
    const measure = tab.widget.root.querySelector<HTMLElement>('.automation-inspector-measure')!;
    const bounds = vi.spyOn(measure, 'getBoundingClientRect');
    tab.game.buy('core');
    renderAutomation(tab.widget, tab.view());
    expect(bounds).not.toHaveBeenCalled();
    tab.game.buy(laneSkillId('autosale', 1));
    renderAutomation(tab.widget, tab.view());
    expect(bounds).toHaveBeenCalled();
    bounds.mockClear();
    const view = tab.view();
    const masked = {
      ...view,
      features: view.features.map((feature) => ({
        ...feature,
        lanes: feature.lanes.map((lane) => ({ ...lane, nodes: lane.nodes.map((node) => ({ ...node, masked: true })) })),
      })),
    };
    tab.widget.inspector.render(masked, true, true);
    expect(bounds).toHaveBeenCalled();
  });

  it('clicking pins and opens its row without buying; INSTALL activates and refreshes exactly once', () => {
    const tab = kit();
    const id = laneSkillId('autosale', 1);
    expect(tab.widget.root.querySelector('.automation-feat.open')).toBeNull();
    tab.node(id).click();
    expect(tab.ctx.selection.automationSelected).toBe(id);
    expect(tab.row('autosale').classList.contains('open')).toBe(true);
    expect(tab.activate).not.toHaveBeenCalled();
    tab.pane().querySelector<HTMLButtonElement>('.firmware-install')!.click();
    expect(tab.activate).toHaveBeenCalledExactlyOnceWith(id);
    expect(tab.refresh).toHaveBeenCalledTimes(1);
    renderAutomation(tab.widget, tab.view());
    expect(tab.ctx.selection.automationSelected).toBe(id);
    expect(tab.pane().querySelector<HTMLButtonElement>('.firmware-install')!.disabled).toBe(true);
    expect(tab.pane().querySelector('.inspector-why')!.textContent).toBe(tab.ctx.text.firmware.alreadyRunning);
  });

  it('close, Escape and a second click unpin and close the row', () => {
    const tab = kit();
    const node = tab.node(laneSkillId('autosale', 1));
    for (const close of [
      () => tab.pane().querySelector<HTMLButtonElement>('.inspector-close')!.click(),
      () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
      () => node.click(),
    ]) {
      node.click();
      close();
      expect(tab.ctx.selection.automationSelected).toBeNull();
      expect(tab.widget.root.querySelector('.automation-feat.open')).toBeNull();
    }
  });

  it('returns immediately to the pin on leaving another node in the pinned lane', () => {
    const tab = kit();
    tab.node(laneSkillId('autosale', 1)).click();
    const sibling = tab.node(laneSkillId('autosale', 2));
    sibling.dispatchEvent(new Event('mouseenter'));
    expect(tab.pane().querySelector('.inspector-name')!.textContent).toBe('autosale 2');
    sibling.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: tab.row('autosale') }));
    expect(tab.pane().querySelector('.inspector-name')!.textContent).toBe('autosale 1');
  });

  it('keeps a different lane preview through its row and pane, then restores the pinned lane', () => {
    const tab = kit();
    tab.node(laneSkillId('autosale', 1)).click();
    const other = tab.node(laneSkillId('autoBurn', 1));
    other.dispatchEvent(new Event('mouseenter'));
    other.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: tab.pane() }));
    expect(tab.row('autoBurn').classList.contains('open')).toBe(true);
    expect(tab.pane().querySelector('.inspector-name')!.textContent).toBe('autoBurn 1');
    expect(tab.ctx.selection.automationSelected).toBe(laneSkillId('autosale', 1));
    tab.row('autoBurn').dispatchEvent(new Event('mouseleave'));
    expect(tab.row('autosale').classList.contains('open')).toBe(true);
    expect(tab.pane().querySelector('.inspector-name')!.textContent).toBe('autosale 1');
  });

  it('keeps an unpinned preview towards INSTALL and drops transient hover when hidden', () => {
    const tab = kit();
    const node = tab.node(laneSkillId('autosale', 1));
    node.dispatchEvent(new Event('mouseenter'));
    node.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: tab.row('autosale') }));
    expect(tab.pane().querySelector('.inspector-mode')!.textContent).toBe(tab.ctx.text.firmware.preview);
    expect(tab.pane().querySelector<HTMLElement>('.inspector-close')!.hidden).toBe(true);
    renderAutomation(tab.widget, tab.view(), false);
    expect(tab.widget.root.querySelector('.automation-feat.open')).toBeNull();
    expect(tab.ctx.selection.automationSelected).toBeNull();
    renderAutomation(tab.widget, tab.view(), true);
    expect(tab.widget.root.querySelector('.automation-feat.open')).toBeNull();
  });

  it('flashes a newly revealed target once and previews only visible controls', () => {
    const tab = kit();
    const id = laneSkillId('autosale', 1);
    const node = tab.node(id);
    const target = tab.widget.kompromat.controlTargets.get('chip-sale-common')!;
    node.dispatchEvent(new Event('mouseenter'));
    expect(target.classList.contains('preview')).toBe(false);
    tab.pane().querySelector<HTMLButtonElement>('.firmware-install')!.click();
    renderAutomation(tab.widget, tab.view());
    expect(target.classList.contains('fresh')).toBe(true);
    target.dispatchEvent(new Event('animationend'));
    renderAutomation(tab.widget, tab.view());
    expect(target.classList.contains('fresh')).toBe(false);
    node.dispatchEvent(new Event('mouseenter'));
    expect(target.classList.contains('preview')).toBe(true);
    node.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: tab.pane() }));
    expect(target.classList.contains('preview')).toBe(false);
  });

  it('keeps the pane stable and does not remeasure on unchanged renders', () => {
    const tab = kit();
    tab.node(laneSkillId('autosale', 1)).click();
    const pane = tab.pane();
    const measure = tab.widget.root.querySelector<HTMLElement>('.automation-inspector-measure')!;
    const measureBounds = vi.spyOn(measure, 'getBoundingClientRect');
    const observer = new MutationObserver(() => {});
    observer.observe(pane, { attributes: true, childList: true, characterData: true, subtree: true });
    renderAutomation(tab.widget, tab.view());
    const changes = observer.takeRecords().map((record) => ({
      type: record.type,
      attribute: record.attributeName,
      target: (record.target as HTMLElement).className,
    }));
    observer.disconnect();
    expect(tab.pane()).toBe(pane);
    expect(changes).toEqual([]);
    expect(measureBounds).not.toHaveBeenCalled();
  });
});
