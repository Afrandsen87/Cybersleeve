/**
 * @module ui
 *
 * The Corporation tab: the corporation widget (empty for now) and the corporation's actions.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries` (the corporation queries), the text table.
 */
import type { CorporationEffect, CorporationQueries, StateQueries } from '../../core';
import { formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { DROP_CHANCE_DECIMALS, formatSeconds } from './viewFormat';
import type { CorporationActionView, CorporationView } from './viewTypes';

/**
 * Says in words what one effect of a corporation action does.
 *
 * Called by: {@link corporationView}. Calls: the text table (one entry per kind of effect).
 *
 * @param effect the configured effect
 * @param itemNames the display name of an item id
 * @param text the display text
 */
function describeEffect(effect: CorporationEffect, itemNames: (id: string) => string, text: UiText): string {
  const describe = text.corporation.effects[effect.kind] as (
    e: CorporationEffect,
    names: (id: string) => string,
    percent: string,
  ) => string;
  const percent = 'chance' in effect ? formatPlain(effect.chance * 100, DROP_CHANCE_DECIMALS) : '';
  return describe(effect, itemNames, percent);
}

/**
 * The Corporation tab.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.corporationActions`, `canStartCorporationAction`.
 *
 * @param engine the engine to read from
 * @param text the display text
 */
export function corporationView(engine: CorporationQueries & StateQueries, text: UiText): CorporationView {
  const state = engine.getState();
  const items = engine.getConfig().items.definitions;
  const itemNames = (id: string): string => items.find((d) => d.id === id)?.name ?? id;
  return {
    title: text.titles.corporation,
    // The corporation has no figures of its own yet, so its widget and the widgets beside it stay empty.
    stats: [],
    actions: engine.corporationActions().map((def): CorporationActionView => {
      const progress = state.corporation.actions[def.id];
      const running = progress?.running ?? false;
      const duration = formatSeconds(def.baseDurationMs, text);
      const effects = def.effects.map((e) => describeEffect(e, itemNames, text));
      return {
        id: def.id,
        name: def.name,
        running,
        progressPercent: (progress?.progress ?? 0) * 100,
        startable: engine.canStartCorporationAction(def.id),
        infoText: text.corporation.info(duration),
        get tip() {
          return text.corporation.tip({ name: def.name, duration, effects });
        },
      };
    }),
  };
}
