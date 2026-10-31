// @vitest-environment happy-dom
/**
 * @module ui
 * The tab bar draws the count badge and the `data-tab` hook from the tab views.
 * Called by: vitest. Calls: buildTabBar, widgetKit.
 */
import { describe, expect, it } from 'vitest';
import { tabView } from '../testing/widgetKit';
import { buildTabBar } from './widgets/tabBar';

const tabs = (skills: number | null, automation: number | null) => [
  tabView('character', null),
  tabView('skills', skills),
  tabView('automation', automation, false),
];

describe('tab bar badges', () => {
  it('shows the count in the badge and hides the badge while the count is null', () => {
    const bar = buildTabBar(tabs(3, null), () => {});
    bar.render(tabs(3, null), 'character');
    const badge = (id: string) => bar.root.querySelector<HTMLElement>(`[data-tab="${id}"] .tab-badge`)!;
    expect(badge('skills').hidden).toBe(false);
    expect(badge('skills').textContent).toBe('3');
    expect(badge('character').hidden).toBe(true);
    bar.render(tabs(null, 2), 'character');
    expect(badge('skills').hidden).toBe(true);
    expect(badge('automation').textContent).toBe('2');
  });

  it('marks each button with its tab id (the badge colour is chosen by it in CSS) and keeps the label apart from the badge', () => {
    const bar = buildTabBar(tabs(1, 1), () => {});
    bar.render(tabs(1, 1), 'skills');
    expect([...bar.root.querySelectorAll<HTMLElement>('.tab')].map((b) => b.dataset['tab'])).toEqual(['character', 'skills', 'automation']);
    expect(bar.root.querySelector('[data-tab="skills"] .tab-label')!.textContent).toBe('skills');
    expect(bar.root.querySelector('[data-tab="skills"]')!.classList.contains('active')).toBe(true);
  });

  it('hides a tab that is not visible and tells the screen which tab was clicked', () => {
    const clicked: string[] = [];
    const bar = buildTabBar(tabs(1, 1), (id) => clicked.push(id));
    bar.render(tabs(1, 1), 'character');
    expect(bar.root.querySelector<HTMLElement>('[data-tab="automation"]')!.hidden).toBe(true);
    bar.root.querySelector<HTMLElement>('[data-tab="skills"]')!.click();
    expect(clicked).toEqual(['skills']);
  });
});
