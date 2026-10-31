/** Reveal-safe daemon guidance. Called by: Vitest. Calls: shared automation kit, buildViewModel, daemonOfflineNote. */
import { describe, expect, it } from 'vitest';
import { kompromatGame } from '../testing/kompromatKit';
import { uiText } from './uiText';
import { daemonOfflineNote } from './view/daemonView';
import { buildViewModel } from './viewModel';

describe('daemon offline guidance', () => {
  it('uses the readable root name and hides it when the tree masks that root', () => {
    const lanes = buildViewModel(kompromatGame()).automation.features.find((feature) => feature.id === 'autosale')!.lanes;
    const root = lanes[0]!.nodes.find((node) => node.parents.length === 0)!;
    expect(daemonOfflineNote(lanes, uiText)).toBe(uiText.automation.offlineNote(root.view.name));
    const masked = lanes.map((lane) => ({ ...lane, nodes: lane.nodes.map((node) => ({ ...node, masked: true })) }));
    expect(daemonOfflineNote(masked, uiText)).toBe(uiText.automation.offlineNote(null));
    expect(daemonOfflineNote(masked, uiText)).not.toContain(root.view.name);
  });
});
