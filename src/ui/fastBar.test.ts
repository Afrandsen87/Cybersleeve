// @vitest-environment happy-dom
/**
 * Fast run bars: a run shorter than the threshold draws its bar full, and while Auto-run is on the runs per second are written on it.
 *
 * Called by: vitest. Calls: `buildViewModel`, `fastBarView`, the DOM test kit.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { mountTestUi } from '../testing/domMountKit';
import { setCredits, testConfig } from '../testing/testConfig';
import { num } from '../numbers';
import { FAST_BAR_MS, fastBarView } from './view/fastBar';
import { uiText } from './uiText';
import { buildViewModel } from './viewModel';

/** The test action `a` with a run of the given length (levels out of reach, so the speed stays put). */
const withDuration = (baseDurationMs: number) =>
  createConfig(testConfig, {
    actions: [{ ...testConfig.actions[0]!, baseDurationMs }],
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
  });

const card = (g: ReturnType<typeof createGame>) => buildViewModel(g).actions[0]!;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('fastBarView', () => {
  it('is full below the threshold and not at or above it', () => {
    expect(fastBarView(FAST_BAR_MS - 1, true, false, uiText).full).toBe(true);
    expect(fastBarView(FAST_BAR_MS, true, false, uiText).full).toBe(false);
    expect(fastBarView(10_000, true, true, uiText)).toEqual({ full: false, rateText: null });
  });

  it('writes the runs per second only while Auto-run is on', () => {
    expect(fastBarView(100, true, true, uiText).rateText).toBe('10/s');
    expect(fastBarView(100, true, false, uiText).rateText).toBeNull();
    expect(fastBarView(40, true, true, uiText).rateText).toBe('25/s');
    expect(fastBarView(150, true, true, uiText).rateText).toBe('6.7/s');
  });

  it('is not full while the action is not running, even with Auto-run on', () => {
    expect(fastBarView(100, false, true, uiText)).toEqual({ full: false, rateText: null });
  });

  it('ignores a zero, negative, NaN or infinite duration', () => {
    for (const d of [0, -5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(fastBarView(d, true, true, uiText)).toEqual({ full: false, rateText: null });
  });
});

describe('the run bar in the view model', () => {
  it('carries the current duration of a run', () => {
    expect(card(createGame({ config: withDuration(100) })).durationMs).toBe(100);
  });

  it('a manual fast run shows full while it runs, and no rate', () => {
    const g = createGame({ config: withDuration(100) });
    expect(card(g)).toMatchObject({ progressPercent: 0, barText: null });
    g.startAction('a');
    g.tick(30);
    expect(card(g)).toMatchObject({ running: true, progressPercent: 100, barText: null });
  });

  it('with Auto-run on, a fast bar is full and says how many runs it completes each second', () => {
    const g = createGame({ config: withDuration(100) });
    setCredits(g, num(100));
    g.buy('auto');
    g.tick(30);
    expect(card(g)).toMatchObject({ progressPercent: 100, barText: '10/s' });
  });

  it('an Auto-run that cannot start (the start cost is out of reach) stays empty and says nothing', () => {
    const costly = createConfig(withDuration(100), {
      actions: [{ ...withDuration(100).actions[0]!, startCost: { currency: 'credits', amount: num(1e9) } }],
    });
    const g = createGame({ config: costly });
    setCredits(g, num(100));
    g.buy('auto');
    g.tick(30);
    expect(card(g)).toMatchObject({ running: false, progressPercent: 0, barText: null });
  });

  it('a normal bar is animated and has no text, with Auto-run on or off', () => {
    const g = createGame({ config: withDuration(10_000) });
    setCredits(g, num(100));
    g.buy('auto');
    g.tick(2_500);
    const a = card(g);
    expect(a.barText).toBeNull();
    expect(a.progressPercent).toBeGreaterThan(0);
    expect(a.progressPercent).toBeLessThan(100);
  });

  it('the rate follows the current duration (it is not tuning of its own)', () => {
    const g = createGame({ config: withDuration(100) });
    setCredits(g, num(100));
    g.buy('auto');
    g.tick(30);
    const fast = card(g);
    expect(fast.barText).toBe(`${Math.round(1000 / fast.durationMs)}/s`);
  });
});

describe('the run bar on the screen', () => {
  const mount = (baseDurationMs: number) => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: withDuration(baseDurationMs) });
    const render = mountTestUi(root, game);
    const fill = () => root.querySelector<HTMLElement>('.action .bar-fill')!;
    const label = () => root.querySelector<HTMLElement>('.action .bar-label')!;
    return { game, render, fill, label };
  };

  it('writes the rate on a full bar while Auto-run is on', () => {
    const { game, render, fill, label } = mount(100);
    setCredits(game, num(100));
    game.buy('auto');
    game.tick(30);
    render();
    expect(fill().style.transform).toBe('scaleX(1)');
    expect(label().textContent).toBe('10/s');
  });

  it('shows a manual fast run full with no text, and a slow bar with no text at all', () => {
    const fast = mount(100);
    fast.game.startAction('a');
    fast.game.tick(30);
    fast.render();
    expect(fast.fill().style.transform).toBe('scaleX(1)');
    expect(fast.label().textContent).toBe('');
    document.body.innerHTML = '';
    const slow = mount(10_000);
    setCredits(slow.game, num(100));
    slow.game.buy('auto');
    slow.game.tick(2_500);
    slow.render();
    expect(slow.label().textContent).toBe('');
    expect(slow.fill().style.transform).not.toBe('scaleX(1)');
  });
});
