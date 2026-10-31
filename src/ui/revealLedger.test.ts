/**
 * Readers of the reveal ledger in the view: stats, tabs, skills and purchases stay shown once noted, and the view collects the new keys.
 *
 * Called by: vitest. Calls: `buildViewModel`, `buildSkillLanes`, `RevealTracker`, `TabAttention`.
 */
import { describe, expect, it } from 'vitest';
import type { BuyableDefinition } from '../core';
import { num } from '../numbers';
import { game } from '../testing/gameKit';
import { setCredits } from '../testing/testConfig';
import { buildBuyableViews } from './view/buyableViews';
import { uiText } from './uiText';
import { RevealTracker } from './view/revealTracker';
import { buildSkillLanes } from './view/skillTree';
import { TabAttention } from './view/tabAttention';
import type { BuyableView } from './view/viewTypes';
import { buildViewModel } from './viewModel';

describe('RevealTracker', () => {
  it('shows what the ledger holds or the rule says, and collects only new keys', () => {
    const t = new RevealTracker(['stat:heat']);
    expect(t.reveals('stat', 'heat', false)).toBe(true);
    expect(t.reveals('stat', 'legend', false)).toBe(false);
    expect(t.reveals('tab', 'skills', true)).toBe(true);
    expect(t.reveals('stat', 'heat', true)).toBe(true);
    expect(t.fresh()).toEqual(['tab:skills']);
  });
});

describe('the view model and the ledger', () => {
  it('a noted stat and tab are shown although their rules say no', () => {
    const g = game();
    expect(buildViewModel(g).sleeve.stats.find((s) => s.id === 'heat')!.hidden).toBe(true);
    expect(buildViewModel(g).tabs[1]!.visible).toBe(false);
    g.noteRevealed(['stat:heat', 'tab:skills']);
    expect(buildViewModel(g).sleeve.stats.find((s) => s.id === 'heat')!.hidden).toBe(false);
    expect(buildViewModel(g).tabs[1]!.visible).toBe(true);
  });

  it('a noted purchase whose requirements are unmet is shown greyed and cannot be bought', () => {
    const g = game();
    setCredits(g, num(1000));
    const find = (tracker: RevealTracker) => buildBuyableViews(g, g.getConfig(), uiText, false, tracker).find((b) => b.id === 'dup')!;
    expect(find(new RevealTracker([])).available).toBe(false);
    const view = find(new RevealTracker(['buyable:dup']));
    expect([view.available, view.gated, view.clickable, view.affordable]).toEqual([true, true, false, false]);
    expect(g.activateBuyable('dup')).toBe('locked');
  });

  it('collects the keys it shows once, and nothing once they are noted', () => {
    const g = game();
    setCredits(g, num(100));
    const first = buildViewModel(g).newlyRevealed;
    expect(first).toContain('buyable:auto');
    g.noteRevealed(first);
    expect(buildViewModel(g).newlyRevealed).toEqual([]);
  });
});

describe('a noted skill', () => {
  const def = (id: string, extra: Partial<BuyableDefinition> = {}): BuyableDefinition => ({
    id,
    name: id,
    description: '',
    currency: 'skillPoints',
    cost: num(1),
    effect: { kind: 'placeholder' },
    ...extra,
  });
  const view = (id: string): BuyableView =>
    ({ id, name: id, description: '', symbol: id, costText: '1', owned: 0, clickable: true, tip: '' }) as unknown as BuyableView;
  const lay = (tracker: RevealTracker) => {
    const skills = [def('gate'), def('child', { requires: ['gate'] })];
    return buildSkillLanes({
      skills,
      viewById: new Map(skills.map((b) => [b.id, view(b.id)])),
      owned: () => 0,
      laneTitle: () => '',
      hiddenText: '???',
      open: true,
      revealAll: false,
      tracker,
    })[0]!.nodes.find((n) => n.view.id === 'child')!;
  };

  it('is masked without the ledger, and readable but locked with it', () => {
    const plain = lay(new RevealTracker([]));
    expect([plain.masked, plain.locked]).toEqual([true, false]);
    const noted = lay(new RevealTracker(['skill:child']));
    expect([noted.masked, noted.locked, noted.view.name]).toEqual([false, true, 'child']);
  });
});

describe('TabAttention', () => {
  it('blinks while earned is above seen, stops when the tab is opened, and blinks again for new points', () => {
    const a = new TabAttention();
    expect(a.blinks('skills', 1, 1, false)).toBe(true);
    expect(a.blinks('skills', 1, 0, false)).toBe(true); // spending the point does not clear it: the player has not looked
    expect(a.blinks('skills', 1, 0, true)).toBe(false);
    expect(a.blinks('skills', 2, 1, false)).toBe(true);
  });

  it('after a reload blinks only for unspent points, and follows a drop in earned points (re-sleeve)', () => {
    expect(new TabAttention().blinks('skills', 5, 0, false)).toBe(false);
    expect(new TabAttention().blinks('skills', 5, 2, false)).toBe(true);
    const a = new TabAttention();
    a.blinks('skills', 5, 0, true);
    expect(a.blinks('skills', 0, 0, false)).toBe(false);
    expect(a.blinks('skills', 1, 1, false)).toBe(true);
  });
});
