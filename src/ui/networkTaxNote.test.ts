/**
 * @module ui
 * Network tax-note and status tests using the shared test-config game kit.
 * Called by: vitest. Calls: game, flat, buildViewModel.
 */
import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { flat } from '../testing/flatState';
import { game } from '../testing/gameKit';
import { setCredits } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

describe('network tax note', () => {
  it('omits the note at zero tax and links only while nodes exist', () => {
    const g = game();
    expect(buildViewModel(g).network).toMatchObject({ taxNote: null, status: null });
    flat<{ network: unknown }>(g).network = num(1);
    expect(buildViewModel(g).network.status).toBe('LINKED');
  });

  it('shows partial tax with the heat and stop point', () => {
    const g = game();
    flat<{ network: unknown }>(g).network = num(1);
    flat<{ heat: number }>(g).heat = 25;
    expect(buildViewModel(g).network.taxNote).toBe('heat tax takes 25% (heat 25 ≥ 100)');
  });

  it('shows full tax beyond the stop point', () => {
    const g = game();
    flat<{ network: unknown }>(g).network = num(1);
    flat<{ heat: number }>(g).heat = 150;
    expect(buildViewModel(g).network.taxNote).toBe('heat tax takes 100% (heat 150 ≥ 100)');
  });

  it('omits the stop point while tax is capped', () => {
    const g = game({
      buyables: [{ id: 'cap', name: 'Cap', description: '', cost: num(1), effect: { kind: 'heatTaxCap', maxShare: 0.8 } }],
    });
    setCredits(g, num(1));
    expect(g.buy('cap')).toBe('purchased');
    flat<{ network: unknown }>(g).network = num(1);
    flat<{ heat: number }>(g).heat = 150;
    const note = buildViewModel(g).network.taxNote;
    expect(note).toBe('heat tax takes 80% (heat 150)');
    expect(note).not.toContain('≥');
  });

  it('shows no note and no red +0 while there are no nodes, whatever the heat', () => {
    const g = game();
    flat<{ heat: number }>(g).heat = 150;
    const network = buildViewModel(g).network;
    expect(network.taxNote).toBeNull();
    expect(network.stats.find((r) => r.id === 'income')?.tone).toBe('gain');
  });

  it('tones the income green, and red when the tax leaves a +0, and the node count cyan', () => {
    const g = game();
    flat<{ network: unknown }>(g).network = num(1);
    const tone = (id: string) => buildViewModel(g).network.stats.find((r) => r.id === id)?.tone;
    expect(tone('income')).toBe('gain');
    expect(tone('nodes')).toBe('info');
    flat<{ heat: number }>(g).heat = 150;
    expect(tone('income')).toBe('danger');
  });
});
