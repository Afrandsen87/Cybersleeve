// @vitest-environment happy-dom
/**
 * @module ui
 * The stat widget draws group headers, hidden groups and bars, value tones and the header LED from the views.
 * Called by: vitest. Calls: buildStatWidget, renderStats, widgetKit.
 */
import { describe, expect, it } from 'vitest';
import { statGroup, statRow } from '../testing/widgetKit';
import { TipRegistry } from './tooltip';
import { buildStatWidget, renderStats } from './widgets/statWidget';

const bar = (hidden: boolean) => ({ label: 'cooldown', percent: 40, running: true, hidden });

describe('stat widget groups', () => {
  const rows = [statRow('access'), statRow('interfaceSpeed'), statRow('heat')];
  const groups = [statGroup('access', ['access']), statGroup('skill', ['interfaceSpeed']), statGroup('risk', ['heat'])];

  it('draws one header line before the first row of each group, in group order', () => {
    const widget = buildStatWidget('sleeve-widget', 'T', rows, { groups });
    const order = [...widget.root.querySelectorAll('.stats > *')].map((el) =>
      el.classList.contains('group-title') ? el.textContent : 'row',
    );
    expect(order).toEqual(['ACCESS', 'row', 'SKILL', 'row', 'RISK', 'row']);
  });

  it('hides the header of a hidden group and shows it again', () => {
    const widget = buildStatWidget('sleeve-widget', 'T', rows, { groups });
    const tips = new TipRegistry();
    renderStats(widget, rows, tips, { groups: [groups[0]!, statGroup('skill', ['interfaceSpeed'], true), groups[2]!] });
    expect(widget.groupTitles.get('skill')!.hidden).toBe(true);
    expect(widget.groupTitles.get('risk')!.hidden).toBe(false);
    renderStats(widget, rows, tips, { groups });
    expect(widget.groupTitles.get('skill')!.hidden).toBe(false);
  });

  it('a flat widget (no groups) has no header lines', () => {
    const widget = buildStatWidget('network-widget', 'T', rows);
    expect(widget.root.querySelector('.group-title')).toBeNull();
  });
});

describe('stat widget rows', () => {
  it('hides the cycle bar when its view says hidden, although the row is shown', () => {
    const shown = [statRow('legend', { bar: bar(false) })];
    const widget = buildStatWidget('sleeve-widget', 'T', shown);
    const tips = new TipRegistry();
    renderStats(widget, [statRow('legend', { bar: bar(true) })], tips);
    expect(widget.rows.get('legend')!.row.hidden).toBe(false);
    expect(widget.rows.get('legend')!.bar!.root.hidden).toBe(true);
    renderStats(widget, shown, tips);
    expect(widget.rows.get('legend')!.bar!.root.hidden).toBe(false);
  });

  it('puts the value tone in a data attribute and removes it again', () => {
    const widget = buildStatWidget('network-widget', 'T', [statRow('income')]);
    const tips = new TipRegistry();
    renderStats(widget, [statRow('income', { tone: 'danger' })], tips);
    expect(widget.rows.get('income')!.value.dataset['tone']).toBe('danger');
    renderStats(widget, [statRow('income')], tips);
    expect(widget.rows.get('income')!.value.dataset['tone']).toBeUndefined();
  });

  it('shows the header LED text and hides the LED while the status is null', () => {
    const widget = buildStatWidget('network-widget', 'T', [statRow('income')]);
    const tips = new TipRegistry();
    renderStats(widget, [statRow('income')], tips, { status: 'LINKED' });
    expect(widget.header.led.hidden).toBe(false);
    expect(widget.header.led.textContent).toBe('LINKED');
    renderStats(widget, [statRow('income')], tips, { status: null });
    expect(widget.header.led.hidden).toBe(true);
  });

  it('places an element handed in under its row, above the row bar', () => {
    const note = document.createElement('div');
    const widget = buildStatWidget('sleeve-widget', 'T', [statRow('heat', { bar: bar(false) })], { under: { heat: note } });
    const children = [...widget.root.querySelector('.stats')!.children];
    expect(children[1]).toBe(note);
    expect(children[2]!.classList.contains('xp')).toBe(true);
  });
});
