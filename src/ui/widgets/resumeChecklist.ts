/**
 * @module ui
 *
 * A checklist of checkboxes under an Auto Burn resume switch (which Overclocks or Auto-runs the switch turns on).
 *
 * @remarks
 * Called by: `automationWidget.ts`. Calls: `domKit.ts`.
 */
import type { ResumeChecklistView } from '../viewModel';
import { h } from './domKit';

/** A mounted checklist. */
export interface ResumeChecklistWidget {
  /** The list's element (hidden until the switch's skill is owned). */
  readonly element: HTMLElement;
  /** Writes the view into the list, rebuilding the rows only when the set of things changed. */
  render(view: ResumeChecklistView): void;
}

/**
 * Mounts an empty checklist.
 *
 * Called by: `buildAutomationWidget`.
 *
 * @param onTick called when the player ticks or unticks a row, with the thing's id and the new state
 */
export function mountResumeChecklist(onTick: (id: string, ticked: boolean) => void): ResumeChecklistWidget {
  const element = h('div', 'automation-checklist');
  let key = '';
  const boxes = new Map<string, HTMLInputElement>();
  return {
    element,
    render(view) {
      element.hidden = !view.visible || view.items.length === 0;
      const nextKey = view.items.map((i) => i.id).join('\n');
      if (nextKey !== key) {
        key = nextKey;
        boxes.clear();
        element.replaceChildren(
          ...view.items.map((item) => {
            const row = h('label', 'automation-check');
            const box = h('input') as HTMLInputElement;
            box.type = 'checkbox';
            box.addEventListener('change', () => onTick(item.id, box.checked));
            boxes.set(item.id, box);
            row.append(box, h('span', undefined, item.name));
            return row;
          }),
        );
      }
      for (const item of view.items) {
        const box = boxes.get(item.id);
        if (box) box.checked = item.ticked;
      }
    },
  };
}
