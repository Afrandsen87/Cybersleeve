// @vitest-environment happy-dom
/**
 * @module ui
 * Verifies the shared inspector's optional dock without changing the Firmware default.
 * Called by: Vitest. Calls: widgetContext, skillViews, buildInspectorView, mountFirmwareInspector.
 */
import { describe, expect, it, vi } from 'vitest';
import { pointGame } from '../testing/skillsTabKit';
import { skillLane, skillNode } from '../testing/skillViews';
import { widgetContext } from '../testing/widgetKit';
import { buildInspectorView } from './view/firmwareInspector';
import { mountFirmwareInspector } from './widgets/firmwareInspector';

/** Builds the shared pure presentation using injected test fixtures. Called by: tests. Calls: buildInspectorView. */
function fixture(owned = 0, masked = false) {
  const ctx = widgetContext(pointGame(), vi.fn(), vi.fn());
  const view = buildInspectorView({
    selectedId: 'a',
    lanes: [skillLane([skillNode('a', { masked }, { owned, affordable: owned === 0, clickable: owned === 0 })])],
    sleeveLanes: [],
    pointsText: '1',
    sleevePointsText: '0',
    text: ctx.text.firmware,
    adds: 'control',
  })!;
  return { ctx, view };
}

describe('shared inspector docking option', () => {
  it('preserves the default headerless Firmware presentation and empty-section hiding', () => {
    const { ctx, view } = fixture();
    const widget = mountFirmwareInspector(ctx);
    widget.render({ ...view, adds: null });
    expect(widget.element.querySelector('.inspector-header')).toBeNull();
    expect(widget.element.querySelector<HTMLElement>('.inspector-adds')!.hidden).toBe(true);
    expect(widget.element.querySelector<HTMLElement>('.inspector-requires')!.hidden).toBe(true);
    expect(widget.element.querySelector<HTMLElement>('.inspector-unlocks')!.hidden).toBe(true);
  });
  it('shows every docked section and invokes the existing buy path once', () => {
    const { ctx, view } = fixture();
    const close = vi.fn();
    const onInstall = vi.fn();
    const widget = mountFirmwareInspector(ctx, { docked: true, onClose: close, onInstall });
    widget.render(view, 'pinned', true);
    expect(widget.element.querySelector('.inspector-mode')!.textContent).toBe(ctx.text.firmware.pinned);
    expect(widget.element.querySelector('.inspector-adds-text')!.textContent).toBe('control');
    expect(widget.element.querySelector<HTMLElement>('.inspector-requires')!.hidden).toBe(false);
    expect(widget.element.querySelector<HTMLElement>('.inspector-unlocks')!.hidden).toBe(false);
    widget.element.querySelector<HTMLButtonElement>('.firmware-install')!.click();
    expect(onInstall).toHaveBeenCalledExactlyOnceWith('a');
    expect(ctx.activate).toHaveBeenCalledExactlyOnceWith('a');
    expect(ctx.refresh).toHaveBeenCalledTimes(1);
    widget.element.querySelector<HTMLButtonElement>('.inspector-close')!.click();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('keeps installed cost and disabled button visible with an already-running line', () => {
    const { ctx, view } = fixture(1);
    const widget = mountFirmwareInspector(ctx, { docked: true });
    widget.render(view);
    const button = widget.element.querySelector<HTMLButtonElement>('.firmware-install')!;
    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe(ctx.text.firmware.installed);
    expect(widget.element.querySelector('.inspector-why')!.textContent).toBe(ctx.text.firmware.alreadyRunning);
    expect(widget.element.querySelector<HTMLElement>('.inspector-cost')!.hidden).toBe(false);
    expect(widget.element.querySelector<HTMLElement>('.inspector-close')!.hidden).toBe(true);
  });
  it('does not leak ADDS for an encrypted node', () => {
    const { ctx, view } = fixture(0, true);
    expect(view.adds).toBeNull();
    const widget = mountFirmwareInspector(ctx, { docked: true });
    widget.render(view);
    expect(widget.element.querySelector<HTMLElement>('.inspector-adds')!.hidden).toBe(true);
    expect(widget.element.textContent).not.toContain('control');
  });
});
