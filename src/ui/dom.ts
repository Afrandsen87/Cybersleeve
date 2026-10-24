/**
 * @module ui
 *
 * Thin DOM binding. Builds the screen once, then only updates text/attributes each frame.
 * All decisions about WHAT to show live in `viewModel.ts` (tested); this file only places it.
 */
import type { GameEngine } from '../core';
import { ConfirmGate } from './confirmGate';
import { buildViewModel, type BuyableView } from './viewModel';

/** Number of cells in the action grid (3 columns x 2 rows). Cells without an action are shown empty. */
const ACTION_GRID_SLOTS = 6;

/** The fast-forward switch as the UI sees it (satisfied by `SpeedToggle`). */
export interface SpeedControl {
  readonly enabled: boolean;
  readonly factor: number;
  toggle(): boolean;
}

/** Handles to update one action card. */
interface ActionCard {
  /** The whole card (a container, because it holds several buttons). */
  readonly root: HTMLElement;
  /** The clickable area that starts the action. */
  readonly button: HTMLButtonElement;
  readonly title: HTMLElement;
  readonly info: HTMLElement;
  readonly bar: HTMLElement;
  readonly reward: HTMLElement;
  readonly levelXp: XpBar;
  readonly sleeveXp: XpBar;
  /** Square purchase buttons of this action, by buyable id. */
  readonly buyables: ReadonlyMap<string, HTMLButtonElement>;
}

/** Handles to update the Sleeve widget. */
interface SleeveWidget {
  readonly root: HTMLElement;
  readonly access: HTMLElement;
  readonly interfaceSpeed: HTMLElement;
  readonly heat: HTMLElement;
  readonly heatCooldown: XpBar;
  readonly buyables: ReadonlyMap<string, HTMLButtonElement>;
}

/** Handles to update one small experience bar with its label. */
interface XpBar {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly fill: HTMLElement;
}

/**
 * Mounts the game UI into `root` and returns a function that refreshes it.
 *
 * Called by: `main.ts`. Calls: `buildViewModel`, `GameEngine.startAction/buy/resleeve`.
 *
 * @param root container element
 * @param engine the engine to display and command
 * @param speed the test fast-forward switch shown in the corner
 * @param onResetSave called when the temporary "Reset save" button is pressed; must wipe the game and the stored save
 * @returns `render`, to be called after every tick
 */
export function mountUi(root: HTMLElement, engine: GameEngine, speed: SpeedControl, onResetSave: () => void): () => void {
  const initial = buildViewModel(engine);
  root.innerHTML = '';

  const header = h('header');
  const credits = h('div', 'credits');
  const network = h('div', 'network');
  header.append(credits, network);

  const actionsEl = h('section', 'actions');
  const cards = new Map<string, ActionCard>();
  for (const a of initial.actions) {
    const root = h('div', 'action');
    const button = h('button', 'action-main') as HTMLButtonElement;
    const title = h('div', 'action-title');
    const info = h('div', 'action-info');
    const bar = h('div', 'bar-fill');
    const track = h('div', 'bar');
    track.append(bar);
    const reward = h('div', 'action-reward');
    button.append(title, info, track, reward);
    button.addEventListener('click', () => engine.startAction(a.id));

    const levelXp = xpBar();
    const sleeveXp = xpBar();

    const { element: upgrades, buttons: buyables } = upgradeRow(a.buyables, (id) => engine.buy(id));

    root.append(button, levelXp.root, sleeveXp.root, upgrades);
    actionsEl.append(root);
    cards.set(a.id, { root, button, title, info, bar, reward, levelXp, sleeveXp, buyables });
  }

  for (let i = initial.actions.length; i < ACTION_GRID_SLOTS; i++) actionsEl.append(h('div', 'action empty'));

  const sleeveWidget = buildSleeveWidget(initial.sleeve.buyables, (id) => engine.buy(id));

  // Re-sleeving wipes most progress, so it takes two clicks: the first arms the gate, the second confirms.
  const resleeveGate = new ConfirmGate();
  const resleeveBtn = h('button', 'resleeve') as HTMLButtonElement;
  resleeveBtn.addEventListener('click', () => {
    if (resleeveGate.request()) engine.resleeve();
    render();
  });
  const resleeveCancel = h('button', 'resleeve-cancel', 'Cancel') as HTMLButtonElement;
  resleeveCancel.addEventListener('click', () => {
    resleeveGate.cancel();
    render();
  });
  const resleeveRow = h('div', 'resleeve-row');
  resleeveRow.append(resleeveBtn, resleeveCancel);

  const speedBtn = h('button', 'speed-toggle') as HTMLButtonElement;
  speedBtn.title = 'Test aid: fast-forward game time';
  speedBtn.addEventListener('click', () => speed.toggle());

  const resetBtn = h('button', 'reset-save', 'Reset save') as HTMLButtonElement;
  resetBtn.title = 'Temporary: wipes the game and starts over';
  resetBtn.addEventListener('click', () => {
    onResetSave();
    render();
  });

  const corner = h('div', 'corner-controls');
  corner.append(resetBtn, speedBtn);

  const layout = h('div', 'layout');
  layout.append(actionsEl, sleeveWidget.root);
  root.append(corner, header, layout, resleeveRow);

  function render(): void {
    const vm = buildViewModel(engine);
    credits.textContent = `${vm.creditsText} credits`;
    network.textContent = `Network: ${vm.networkText} nodes (+${vm.passiveIncomeText} credits/s)`;
    for (const a of vm.actions) {
      const card = cards.get(a.id);
      if (!card) continue;
      card.title.textContent = a.name;
      card.info.textContent = a.unlocked
        ? `${a.speedText} speed | ${a.durationText} per run${a.auto ? ' | auto' : ''}`
        : `Locked: needs access level ${a.requiredAccessLevel}`;
      setXpBar(card.levelXp, `Level ${a.level}`, a.xpText, a.nextLevelXpText, a.levelProgressPercent);
      setXpBar(
        card.sleeveXp,
        `Sleeve level ${a.sleeve.level}`,
        a.sleeve.xpText,
        a.sleeve.nextLevelXpText,
        a.sleeve.progressPercent,
        `${a.sleeve.runsToNextXp} runs to next XP`,
      );
      card.reward.textContent =
        `+${a.rewardText} ${a.rewardUnit} per run (output x${a.outputMultiplierText})` +
        (a.heatPerRun > 0 ? ` | +${a.heatPerRun} heat per run` : '');
      card.button.disabled = !a.unlocked;
      card.root.classList.toggle('locked', !a.unlocked);
      card.bar.style.width = `${a.progressPercent}%`;
      card.root.classList.toggle('running', a.running);
      renderUpgrades(card.buyables, a.buyables);
    }
    sleeveWidget.access.textContent = vm.sleeve.accessLevelText;
    sleeveWidget.interfaceSpeed.textContent = vm.sleeve.interfaceSpeedText;
    sleeveWidget.heat.textContent = vm.sleeve.heatText;
    sleeveWidget.heatCooldown.label.textContent = vm.sleeve.heatCooling ? 'Heat cooldown' : 'Heat cooldown (paused: no heat)';
    sleeveWidget.heatCooldown.fill.style.width = `${vm.sleeve.heatCooldownPercent}%`;
    renderUpgrades(sleeveWidget.buyables, vm.sleeve.buyables);
    if (!vm.canResleeve) resleeveGate.cancel();
    resleeveBtn.disabled = !vm.canResleeve;
    resleeveBtn.textContent = resleeveGate.isArmed
      ? 'Confirm re-sleeve: credits, network, levels and purchases reset'
      : 'Re-sleeve (test: no requirement)';
    resleeveBtn.classList.toggle('armed', resleeveGate.isArmed);
    resleeveCancel.hidden = !resleeveGate.isArmed;
    speedBtn.textContent = `Speed x${speed.factor}`;
    speedBtn.classList.toggle('on', speed.enabled);
  }
  return render;
}

/** Builds a row of square purchase buttons; clicking one calls `buy(id)`. */
function upgradeRow(
  views: readonly BuyableView[],
  buy: (id: string) => unknown,
): { element: HTMLElement; buttons: Map<string, HTMLButtonElement> } {
  const element = h('div', 'upgrades');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const b of views) {
    const upgrade = h('button', 'upgrade', b.symbol) as HTMLButtonElement;
    upgrade.addEventListener('click', () => buy(b.id));
    element.append(upgrade);
    buttons.set(b.id, upgrade);
  }
  return { element, buttons };
}

/** Updates square purchase buttons (visibility, enabled state, hover tooltip text) from their view data. */
function renderUpgrades(buttons: ReadonlyMap<string, HTMLButtonElement>, views: readonly BuyableView[]): void {
  for (const b of views) {
    const upgrade = buttons.get(b.id);
    if (!upgrade) continue;
    upgrade.hidden = !b.available;
    upgrade.disabled = b.maxed || !b.affordable;
    upgrade.classList.toggle('owned', b.owned > 0);
    const owned = b.repeatable ? ` (owned: ${b.owned})` : '';
    upgrade.dataset['tip'] = b.maxed ? `${b.name} - owned\n${b.description}` : `${b.name}${owned}\n${b.costText} credits\n${b.description}`;
  }
}

/** Builds the Sleeve widget: global stats and the sleeve-wide purchases. */
function buildSleeveWidget(views: readonly BuyableView[], buy: (id: string) => unknown): SleeveWidget {
  const root = h('aside', 'sleeve-widget');
  const stats = h('div', 'stats');
  const stat = (label: string): HTMLElement => {
    const row = h('div', 'stat');
    const value = h('span', 'stat-value');
    row.append(h('span', 'stat-label', label), value);
    stats.append(row);
    return value;
  };
  const access = stat('Access level');
  const interfaceSpeed = stat('Interface speed');
  const heat = stat('Heat');
  const heatCooldown = xpBar();
  stats.append(heatCooldown.root);
  const { element, buttons } = upgradeRow(views, buy);
  root.append(h('h2', undefined, 'Sleeve'), stats, element);
  return { root, access, interfaceSpeed, heat, heatCooldown, buyables: buttons };
}

/** Builds an empty small experience bar (label above a thin grey/teal bar). */
function xpBar(): XpBar {
  const label = h('div', 'xp-label');
  const fill = h('div', 'xp-fill');
  const track = h('div', 'xp-bar');
  track.append(fill);
  const root = h('div', 'xp');
  root.append(label, track);
  return { root, label, fill };
}

function setXpBar(bar: XpBar, name: string, xp: string, next: string, percent: number, extra?: string): void {
  bar.label.textContent = `${name} - XP ${xp}/${next}${extra ? ` | ${extra}` : ''}`;
  bar.fill.style.width = `${percent}%`;
}

function h(tag: string, className?: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}
