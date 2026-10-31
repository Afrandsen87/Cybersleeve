/** Automation context: pure Kompromat protocols from owner queries. Called by: automationView. Calls: itemCount. */
import { type BuyableDefinition, type GameConfig, type ItemQueries, type SkillQueries, type StateQueries, itemCount } from '../../core';
import { formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import type { BuyableView, SkillLaneView } from './viewTypes';
import type { KompromatChipView, KompromatView } from './kompromatViewTypes';

/** Static content indexes. Called by: kompromatView. Calls: nothing. */
const configCache = new WeakMap<GameConfig, ReturnType<typeof indexConfig>>();
/** Indexes rarity permission candidates once in content order. Called by: kompromatView. Calls: nothing. */
function indexConfig(config: GameConfig) {
  const sale = new Map<string, BuyableDefinition[]>();
  const channel = new Map<string, BuyableDefinition[]>();
  for (const skill of config.buyables) {
    const effect = skill.effect;
    const rarity =
      effect.kind === 'allowsAutoBackchannel' || effect.kind === 'allowsAutosale'
        ? effect.rarity
        : effect.kind === 'unlocksAutomation' && effect.feature === 'autosale'
          ? effect.allowsAutosale
          : undefined;
    if (rarity === undefined) continue;
    const map = effect.kind === 'allowsAutoBackchannel' ? channel : sale;
    const candidates = map.get(rarity) ?? [];
    candidates.push(skill);
    map.set(rarity, candidates);
  }
  return {
    sale,
    channel,
    channelSkill: config.buyables.find((skill) => skill.effect.kind === 'backChannel'),
    items: config.items.definitions.filter((item) => item.sellable !== false && item.hasRarity !== false),
  };
}

/** Builds permission switches, inventory counts and safely masked dependency wording.
 * Called by: automationView. Calls: AutomationControls, itemCount.
 * @param engine owner queries
 * @param config content definitions
 * @param viewById purchase views for ownership
 * @param text interface wording
 * @param firmwareLanes existing Firmware views, preserving their reveal decisions
 * @returns display data without side effects
 */
export function kompromatView(
  engine: SkillQueries & Pick<ItemQueries, 'backChannel'> & Pick<StateQueries, 'getState'>,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
  firmwareLanes: readonly SkillLaneView[],
): KompromatView {
  const automation = engine.automation();
  const channel = engine.backChannel();
  const state = engine.getState();
  const words = text.automation.kompromat;
  let indexed = configCache.get(config);
  if (!indexed) {
    indexed = indexConfig(config);
    configCache.set(config, indexed);
  }
  const { channelSkill } = indexed;
  const channelLane = firmwareLanes.find((lane) => lane.nodes.some((node) => node.view.id === channelSkill?.id));
  const channelNode = channelLane?.nodes.find((node) => node.view.id === channelSkill?.id);
  const heldByRarity = new Map(config.items.rarities.map((rarity) => [rarity.id, 0]));
  for (const item of indexed.items)
    for (const rarity of config.items.rarities)
      heldByRarity.set(rarity.id, (heldByRarity.get(rarity.id) ?? 0) + itemCount(state, item.id, rarity.id));
  /** Maps each rarity to its permission owner and current switch state.
   * Called by: kompromatView. Calls: AutomationControls, itemCount.
   */
  function chips(backchannel: boolean): KompromatChipView[] {
    const allowed = automation.allowedRarities(backchannel ? 'autoBackchannel' : 'autosale');
    return config.items.rarities.map((rarity, rarityIndex) => {
      const skill = (backchannel ? indexed!.channel : indexed!.sale)
        .get(rarity.id)
        ?.find((skill) => (viewById.get(skill.id)?.owned ?? 0) > 0);
      const disabled = backchannel && channel?.molesByRarity[rarity.id] === undefined;
      const held = heldByRarity.get(rarity.id) ?? 0;
      return {
        id: rarity.id,
        name: rarity.name,
        skillId: skill?.id ?? null,
        rarityIndex,
        visible: allowed.includes(rarity.id),
        disabled,
        on: backchannel ? automation.isAutoBackchannelOn(rarity.id) : automation.isAutosaleOn(rarity.id),
        heldText: words.held(formatPlain(held)),
      };
    });
  }
  const sale = chips(false);
  const backchannel = chips(true);
  const hasChannel = backchannel.some((chip) => chip.visible);
  const sales = sale.filter((chip) => chip.visible && chip.on).length;
  const channels = backchannel.filter((chip) => chip.visible && chip.on && !chip.disabled).length;
  const active = sales + channels > 0;
  const note = channel
    ? ''
    : channelNode && !channelNode.masked && channelLane
      ? words.needs(channelNode.view.name, channelLane.title)
      : words.needsMasked;
  return {
    active,
    status: active ? words.active : words.standby,
    summary: words.status(sales, sale.filter((chip) => chip.visible).length, hasChannel ? channels : null),
    rows: [
      { id: 'backchannel', visible: hasChannel, dimmed: !channel, condition: words.onDrop, note, chips: backchannel },
      { id: 'autosale', visible: true, dimmed: false, condition: hasChannel ? words.thenCondition : words.onDrop, note: '', chips: sale },
    ],
  };
}
