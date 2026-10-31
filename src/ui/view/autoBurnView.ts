/**
 * @module ui
 *
 * The Auto Burn panel's view: the status line, the heat strip and the protocol rows, built only from the Auto Burn owners (`rules()`,
 * `status()`, `stepOwned()`), so no condition is re-derived here. Each part is shown with the skill that makes it (docs/REVEAL_RULES.md).
 *
 * @remarks
 * Called by: `automationView.ts`. Calls: `AutoBurnControls`, `resumeChecklists`, `heatStripLayout`, `formatPlain`.
 */
import type { ActionQueries, AutoBurnControls, AutoBurnSwitch, GameConfig } from '../../core';
import { formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { resumeChecklists } from './autoBurnChecklist';
import { heatStripLayout } from './autoBurnStrip';
import type { AutoBurnView, BurnChipView, BurnRowView, BurnSwitchView, BuyableView } from './viewTypes';

/**
 * The Auto Burn panel. Pure: reads the owners and mutates nothing.
 *
 * Called by: `automationView`. Calls: `AutoBurnControls.rules`, `.status`, `.stepOwned`, `resumeChecklists`, `heatStripLayout`, `formatPlain`.
 * @param burn automation owner
 * @param engine Overclock ownership queries
 * @param config configured actions and purchases
 * @param views purchase ownership
 * @param text display words
 * @returns panel display data
 */
export function autoBurnView(
  burn: AutoBurnControls,
  engine: Pick<ActionQueries, 'overclockStatus' | 'isUnlocked'>,
  config: GameConfig,
  views: ReadonlyMap<string, BuyableView>,
  text: UiText,
): AutoBurnView {
  const rules = burn.rules();
  const status = burn.status();
  const t = text.automation.autoBurn;
  const owned = (step: Parameters<AutoBurnControls['stepOwned']>[0]): boolean => burn.stepOwned(step);
  const led = (name: AutoBurnSwitch): BurnSwitchView => ({ name, on: rules[name], text: rules[name] ? t.on : t.off });
  const reserve = owned('reserve');
  const floor = formatPlain(rules.lower);
  const redline = formatPlain(rules.upperAt);
  const lists = resumeChecklists(burn, engine, config, views);
  const chips = (items: typeof lists.resumeAutoRuns.items, icon: string, kind: string): BurnChipView[] =>
    items.map((i) => ({ id: i.id, name: i.name, on: i.ticked, icon, kind, locked: i.locked, ...(i.locked ? { tip: t.lockedTip } : {}) }));
  const failsafe: BurnChipView[] = [
    {
      id: 'offOverclocks',
      name: t.overclocks,
      on: rules.offOverclocks,
      icon: 'overclock',
      kind: '',
      locked: false,
      switchName: 'offOverclocks',
    },
    ...(owned('offActions')
      ? [
          {
            id: 'offActions',
            name: t.autoRuns,
            on: rules.offActions,
            icon: 'auto-run',
            kind: '',
            locked: false,
            switchName: 'offActions' as const,
          },
        ]
      : []),
  ];
  const conditions = [t.trigger(redline), t.throttle(floor), t.failsafe(floor, reserve), t.restart(floor, reserve)];
  const ids = ['trigger', 'throttle', 'failsafe', 'restart'] as const;
  const visible = [owned('upper'), owned('hold'), owned('offOverclocks'), owned('onActions')];
  const rows: BurnRowView[] = ids.map((id, i) => ({
    id,
    visible: visible[i] ?? false,
    tag: t.tags[i] ?? '',
    condition: conditions[i] ?? '',
    arrow: t.actions[i] ? t.arrow : '',
    action: t.actions[i] ?? '',
    firing: status.firing[id],
    ...(id === 'trigger' ? { switch: led('upper') } : id === 'throttle' ? { switch: led('hold') } : {}),
    chips: id === 'failsafe' ? failsafe : [],
    subrows:
      id === 'restart'
        ? [
            {
              id: 'autoRuns',
              visible: owned('onActions'),
              switch: led('onActions'),
              chips: chips(lists.resumeAutoRuns.items, 'auto-run', t.autoRunKind),
              empty: t.emptyAutoRuns,
            },
            {
              id: 'overclocks',
              visible: owned('onOverclocks'),
              switch: led('onOverclocks'),
              chips: chips(lists.resumeOverclocks.items, 'overclock', t.overclockKind),
              empty: t.emptyOverclocks,
            },
          ]
        : [],
  }));
  const layout = heatStripLayout(rules.lower, rules.upperAt, status.heat, owned('upper'));
  return {
    status: {
      visible: rules.toggle,
      activity: status.activity,
      ...t.activities[status.activity],
      heat: `${t.heat} ${formatPlain(status.heat)}`,
      leads: `${t.leads} ${formatPlain(status.held)}`,
      toggle: `${t.inventory} ${status.toggleOn ? t.on : t.off}`,
    },
    strip: {
      visible: owned('hold'),
      layout,
      zones: t.zones,
      floor: { visible: owned('hold'), value: rules.lower, text: floor, label: t.floor, editable: owned('thresholds') },
      redline: { visible: owned('upper'), value: rules.upperAt, text: redline, label: t.redline, editable: owned('thresholds') },
      heat: `${formatPlain(status.heat)}${layout.overflow ? t.overflowMark : ''}`,
    },
    rows,
    reserve: { visible: reserve, value: rules.reserve, label: t.reserve },
  };
}
