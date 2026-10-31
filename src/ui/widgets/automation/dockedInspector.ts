/**
 * @module ui
 * Automation context: persistent dock placement, pointer wiring and finite scroll compensation.
 * Called by: automationWidget. Calls: shared Firmware inspector, dockedFocus, rowHolds, scrollAnchor.
 */
import type { AutomationTarget } from '../../view/automationTargets';
import type { AutomationView } from '../../view/automationViewTypes';
import { buildInspectorView } from '../../view/firmwareInspector';
import { emptyDockedFocus, transitionDockedFocus, type DockedFocusEvent } from '../../view/dockedFocus';
import { rowHolds } from '../../view/rowHolds';
import { type UiContext, h, setClass } from '../domKit';
import { mountFirmwareInspector } from '../firmwareInspector';
import { createScrollAnchor } from '../scrollAnchor';
import type { SkillTreeWidget } from '../skillTree';

/** Persistent daemon row geometry. Called by: automationWidget. Calls: nothing. */
export interface DockedRow {
  readonly element: HTMLElement;
  readonly slot: HTMLElement;
  readonly tree: SkillTreeWidget;
}

/** Builds one inspector, an offscreen measuring instance and stable event handlers.
 * Called by: buildAutomationWidget. Calls: shared inspector and pure transition helpers.
 * @param ctx interface dependencies
 * @param root tab container
 * @param rows daemon rows in display order
 * @param initial owner-sourced initial view
 * @param controls stable panel controls keyed by effect target
 * @returns selection and render hooks
 */
export function mountDockedInspector(
  ctx: UiContext,
  root: HTMLElement,
  rows: ReadonlyMap<string, DockedRow>,
  initial: AutomationView,
  controls: ReadonlyMap<AutomationTarget, HTMLElement>,
) {
  let view = initial;
  let focus = emptyDockedFocus();
  let holds = new Map<string, number>();
  let anchorElement: HTMLElement | null = null;
  let spacerHeight = 0;
  let shown = true;
  let measuredKey: string | null = null;
  const previousOwned = new Map<string, number>();
  const spacer = h('div', 'automation-anchor-spacer');
  const parking = h('div', 'automation-inspector-parking');
  const inspector = mountFirmwareInspector(ctx, {
    docked: true,
    onClose: () => dispatch({ type: 'close' }),
    onInstall: (id) => {
      const lane = laneOf(id);
      if (lane) {
        focus = transitionDockedFocus(emptyDockedFocus(), { type: 'clickNode', node: { id, lane } });
        ctx.selection.automationSelected = id;
        paint();
      }
    },
  });
  const measure = mountFirmwareInspector(ctx, { docked: true });
  measure.element.classList.add('automation-inspector-measure');
  parking.append(inspector.element);
  root.append(parking, measure.element, spacer);
  const anchor = createScrollAnchor({
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    measureTop: () => anchorElement?.getBoundingClientRect().top ?? Number.NaN,
    scrollBy: (dy) => window.scrollBy(0, dy),
    roomBelow: () => document.documentElement.scrollHeight - window.innerHeight - window.scrollY,
    growSpacer: (px) => {
      spacerHeight += px;
      spacer.style.height = `${spacerHeight}px`;
    },
  });

  /** Resolves node identity from visible lane data. Called by: events. Calls: nothing. */
  function laneOf(id: string): string | null {
    return view.features.find((feature) => feature.lanes.some((lane) => lane.nodes.some((node) => node.view.id === id)))?.id ?? null;
  }

  /** Builds the shared reveal-safe presentation. Called by: paint, measure. Calls: buildInspectorView. */
  function presentation(id: string) {
    const feature = view.features.find((entry) => entry.id === laneOf(id));
    const built = buildInspectorView({
      selectedId: id,
      lanes: view.features.flatMap((entry) => entry.lanes),
      sleeveLanes: [],
      pointsText: view.pointsValueText,
      sleevePointsText: '',
      text: ctx.text.firmware,
      adds: feature?.additions.get(id)?.text ?? null,
    });
    // every lane's own title is the same "FIRMWARE" caption, so the pane names the daemon instead
    return built && feature ? { ...built, branchTitle: feature.name } : built;
  }

  /** Updates selection and the shared inspector without rebuilding controls. Called by: events, render. Calls: presentation. */
  function paint(): void {
    inspector.render(focus.focusedId ? presentation(focus.focusedId) : null, focus.mode ?? 'preview', focus.pinned !== null);
    for (const [lane, row] of rows) row.tree.select(focus.pinned?.lane === lane ? focus.pinned.id : null);
    for (const control of controls.values()) setClass(control, 'preview', false);
    const hovered = focus.hovered;
    if (hovered) {
      const target = view.features.find((feature) => feature.id === hovered.lane)?.additions.get(hovered.id)?.target;
      const control = target ? controls.get(target) : undefined;
      if (control && !control.closest('[hidden]')) setClass(control, 'preview', true);
    }
  }

  /** Applies focus and geometry atomically, capturing the pointer anchor before layout changes.
   * Called by: pointer, click and keyboard events. Calls: transitionDockedFocus, rowHolds, paint.
   */
  function dispatch(event: DockedFocusEvent, underPointer: HTMLElement | null = null): void {
    const next = transitionDockedFocus(focus, event);
    if (next.openLane !== focus.openLane) {
      anchorElement = underPointer;
      if (anchorElement) anchor.start();
      else anchor.cancel();
      const heights = new Map([...rows].map(([lane, row]) => [lane, row.element.getBoundingClientRect().height]));
      holds = rowHolds([...rows.keys()], focus.openLane, next.openLane, heights, holds);
      for (const [lane, row] of rows) {
        row.element.style.minHeight = holds.has(lane) ? `${holds.get(lane)}px` : '';
        setClass(row.element, 'open', lane === next.openLane);
        if (lane === next.openLane) row.slot.append(inspector.element);
      }
      if (!next.openLane) {
        parking.append(inspector.element);
        spacerHeight = 0;
        spacer.style.height = '';
        anchor.cancel();
      }
    }
    focus = next;
    ctx.selection.automationSelected = focus.pinned?.id ?? null;
    paint();
  }

  for (const [lane, row] of rows) {
    row.element.addEventListener('mouseleave', (event) => {
      const target = event.relatedTarget;
      dispatch(
        { type: 'leaveRow', lane },
        target instanceof HTMLElement
          ? (target.closest<HTMLElement>('.skill-node') ?? target.closest<HTMLElement>('.automation-feat'))
          : null,
      );
    });
    for (const button of row.tree.element.querySelectorAll<HTMLElement>('.skill-node')) {
      const id = button.dataset['id']!;
      button.addEventListener('mouseenter', () => dispatch({ type: 'enterNode', node: { id, lane } }, button));
      button.addEventListener('focus', () => dispatch({ type: 'enterNode', node: { id, lane } }, button));
      /** Routes keyboard and pointer exits. Called by: blur, mouseleave. Calls: dispatch. */
      const leave = (event: MouseEvent | FocusEvent): void => {
        const target = event.relatedTarget;
        const to =
          target instanceof Node && inspector.element.contains(target)
            ? 'pane'
            : target instanceof Node && row.element.contains(target)
              ? 'row'
              : 'outside';
        dispatch(
          { type: 'leaveNode', lane, to },
          target instanceof HTMLElement
            ? (target.closest<HTMLElement>('.skill-node') ?? target.closest<HTMLElement>('.automation-feat'))
            : null,
        );
      };
      button.addEventListener('mouseleave', leave);
      button.addEventListener('blur', leave);
    }
  }
  document.addEventListener('keydown', (event) => {
    if (shown && event.key === 'Escape') dispatch({ type: 'escape' });
  });
  /** Measures changed presentation shapes. Called by: render. Calls: presentation, inspector.render, getBoundingClientRect. */
  function measureHeight(): void {
    const nodes = view.features.flatMap((feature) => feature.lanes.flatMap((lane) => lane.nodes));
    const key = JSON.stringify(nodes.map((node) => [node.view.id, node.masked, node.view.owned > 0]));
    if (key === measuredKey) return;
    let height = 0;
    for (const node of nodes) {
      measure.render(presentation(node.view.id), 'pinned', true);
      height = Math.max(height, measure.element.getBoundingClientRect().height);
    }
    root.style.setProperty('--automation-inspector-height', height + 'px');
    measuredKey = key;
  }

  /** Tracks hidden ownership too; visible increases restart feedback. Called by: render. Calls: classList, offsetWidth. */
  function trackInstalls(flash: boolean): void {
    for (const feature of view.features)
      for (const node of feature.lanes.flatMap((lane) => lane.nodes)) {
        const before = previousOwned.get(node.view.id);
        if (flash && before !== undefined && node.view.owned > before) {
          const target = feature.additions.get(node.view.id)?.target;
          const control = target ? controls.get(target) : undefined;
          if (control && !control.closest('[hidden]')) {
            control.classList.remove('fresh');
            void control.offsetWidth;
            control.classList.add('fresh');
          }
        }
        previousOwned.set(node.view.id, node.view.owned);
      }
  }

  const restored = ctx.selection.automationSelected;
  if (restored && laneOf(restored)) dispatch({ type: 'clickNode', node: { id: restored, lane: laneOf(restored)! } });
  else paint();
  return {
    /** Pins a node through the pure state machine. Called by: tree selection. Calls: dispatch. */
    select(id: string): void {
      const lane = laneOf(id);
      if (!lane) return;
      const button = [...rows.get(lane)!.tree.element.querySelectorAll<HTMLElement>('.skill-node')].find(
        (node) => node.dataset['id'] === id,
      );
      dispatch({ type: 'clickNode', node: { id, lane } }, button ?? rows.get(lane)!.element);
    },
    /** Refreshes only changed inspector data and measurements. Called by: renderAutomation. Calls: presentation, paint. */
    render(next: AutomationView, changed: boolean, visible: boolean): void {
      view = next;
      if (changed || previousOwned.size === 0) trackInstalls(visible && shown); // `changed` is reported while hidden too
      if (!visible) {
        if (shown) {
          dispatch({ type: 'hide' });
          for (const row of rows.values()) row.tree.clearHover();
          anchor.cancel();
        }
        shown = false;
        return;
      }
      if (changed || !shown || measuredKey === null) measureHeight();
      if (changed || !shown) paint();
      shown = true;
    },
  };
}
