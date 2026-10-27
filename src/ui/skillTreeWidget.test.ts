// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { type SpeedControl, mountUi } from './dom';
import { HALF_TILE, STEP_PX, TILE_PX } from './widgets/skillTree';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

const skill = (id: string, extra: Partial<BuyableDefinition> = {}): BuyableDefinition => ({
  id,
  name: `Skill ${id}`,
  description: `Does ${id}.`,
  symbol: id.toUpperCase(),
  currency: 'skillPoints',
  cost: num(1),
  effect: { kind: 'placeholder' },
  ...extra,
});
/** Two branches: green has a root and two kids; red has a root with a gate (the purchase `dual` of the test config). */
const skills = [
  skill('g1', { branch: 'green' }),
  skill('g2', { branch: 'green', parents: ['g1'] }),
  skill('g3', { branch: 'green', parents: ['g1'] }),
  skill('r1', { branch: 'red', requires: ['dual'] }),
  skill('r2', { branch: 'red', parents: ['r1'] }),
];
const inert = { id: 'z', name: 'Z', baseDurationMs: 1_000, reward: num(0), xpPerRun: num(1) };
const config = createConfig(testConfig, { actions: [...testConfig.actions, inert], buyables: [...testConfig.buyables, ...skills] });

type Loose = { actions: Record<string, { xp: unknown }>; purchased: Record<string, number> };
const loose = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

beforeEach(() => {
  document.body.innerHTML = '';
});

const mount = () => {
  const root = document.createElement('div');
  document.body.append(root);
  const game = createGame({ config });
  const render = mountUi(root, game, speed, () => {});
  const tree = () => root.querySelector<HTMLElement>('.skills-widget:not(.resleeve-skills)')!;
  const node = (symbol: string) => [...tree().querySelectorAll<HTMLButtonElement>('.skill-node')].find((b) => b.textContent === symbol)!;
  return { root, game, render, tree, node };
};

describe('the skill tree on the screen', () => {
  it('shows a lane for every branch with its title, and every skill in it, before anything is earned', () => {
    const { tree } = mount();
    const lanes = [...tree().querySelectorAll<HTMLElement>('.skill-lane')];
    expect(lanes.map((l) => l.dataset['branch'])).toEqual(['green', 'red']);
    expect(lanes.map((l) => l.querySelector('.lane-title')!.textContent)).toEqual(['green', 'red']); // no title in the text table: the id shows
    expect(tree().querySelectorAll('.skill-node')).toHaveLength(5);
    expect([...tree().querySelectorAll<HTMLButtonElement>('.skill-node')].every((b) => !b.hidden)).toBe(true);
  });

  it('places every skill on the grid: depth to the right, siblings below one another', () => {
    const { tree } = mount();
    const places = [...tree().querySelectorAll<HTMLElement>('.skill-node')].map((b) => [
      b.textContent,
      b.style.getPropertyValue('--col'),
      b.style.getPropertyValue('--row'),
    ]);
    expect(places).toEqual([
      ['G1', '0', '0'],
      ['G2', '1', '0'],
      ['G3', '1', '1'],
      ['?', '0', '0'],
      ['?', '1', '0'],
    ]);
  });

  it('sizes each lane to its grid and draws one line per parent-child pair', () => {
    const { tree } = mount();
    const [green, red] = [...tree().querySelectorAll<HTMLElement>('.lane-grid')];
    expect([green!.style.getPropertyValue('--cols'), green!.style.getPropertyValue('--rows')]).toEqual(['2', '2']);
    expect([red!.style.getPropertyValue('--cols'), red!.style.getPropertyValue('--rows')]).toEqual(['2', '1']);
    expect(green!.querySelectorAll('.lane-edge')).toHaveLength(2);
    expect(red!.querySelectorAll('.lane-edge')).toHaveLength(1);
  });

  it('a line leaves the parent at its right edge and stops at the left edge of the child, not at their centres', () => {
    const { tree } = mount();
    const [green] = [...tree().querySelectorAll<HTMLElement>('.lane-grid')];
    const [toG2, toG3] = [...green!.querySelectorAll('.lane-edge')].map((e) => e.getAttribute('d'));
    const out = 0.5 + HALF_TILE; // the right edge of the parent in column 0
    const into = 1.5 - HALF_TILE; // the left edge of a child in column 1
    expect(HALF_TILE).toBeCloseTo(TILE_PX / STEP_PX / 2, 10);
    expect(toG2).toBe(`M ${out} 0.5 H 1 V 0.5 H ${into}`); // same row: a straight line
    expect(toG3).toBe(`M ${out} 0.5 H 1 V 1.5 H ${into}`); // one row down: a step in the middle of the gap
  });

  it('hands the size of a cell and of a button to the style sheet, so the lines and the buttons agree', () => {
    const { tree } = mount();
    const element = tree().querySelector<HTMLElement>('.skill-tree')!;
    expect(element.style.getPropertyValue('--step')).toBe(`${STEP_PX}px`);
    expect(element.style.getPropertyValue('--tile')).toBe(`${TILE_PX}px`);
  });

  it('masks a skill whose gate is not met: ? on the button, ??? in the label, and it cannot be bought', () => {
    const { node, tree } = mount();
    const masked = [...tree().querySelectorAll<HTMLButtonElement>('.skill-node.masked')];
    expect(masked).toHaveLength(2); // the gated root and its child, which inherits the masking
    expect(masked.map((b) => b.getAttribute('aria-label'))).toEqual(['???', '???']);
    expect(masked.every((b) => b.disabled)).toBe(true);
    expect(node('G1').classList.contains('masked')).toBe(false);
  });

  it('unmasks the gated branch when its gate is owned, restoring the symbol and label', () => {
    const { node, tree, render, game } = mount();
    loose(game).purchased['dual'] = 1;
    render();
    expect(tree().querySelectorAll('.skill-node.masked')).toHaveLength(0);
    expect(node('R1').getAttribute('aria-label')).toBe('Skill r1');
    expect(node('R2').getAttribute('aria-label')).toBe('Skill r2');
  });

  it('dims a readable skill whose parent is not owned, and lights the line once the parent is bought', () => {
    const { node, tree, render, game } = mount();
    loose(game).actions['z']!.xp = num(10); // the first skill point
    render();
    expect(node('G2').classList.contains('locked')).toBe(true);
    expect(node('G2').hidden).toBe(false);
    expect(tree().querySelectorAll('.lane-edge.lit')).toHaveLength(0);
    node('G1').click();
    render();
    expect(game.ownedCount('g1')).toBe(1);
    expect(node('G2').classList.contains('locked')).toBe(false);
    expect(tree().querySelectorAll('.lane-edge.lit')).toHaveLength(2);
    expect(node('G1').classList.contains('owned')).toBe(true);
  });

  it('has a note at the top of the tab that ??? skills unlock as you play on, until no skill is masked any more', () => {
    const { root, render, game } = mount();
    const note = root.querySelector<HTMLElement>('.skills-panel > .skills-note')!;
    expect(root.querySelector('.skills-panel')!.firstElementChild).toBe(note);
    expect(note.textContent).toBe('Skills that read ??? will be unlocked as you play further.');
    expect(note.hidden).toBe(false);
    loose(game).purchased['dual'] = 1; // the gated branch reads now: nothing is masked
    render();
    expect(note.hidden).toBe(true);
  });

  it('clicking a skill that cannot be bought yet does nothing', () => {
    const { node, game } = mount();
    node('G2').click();
    expect(game.ownedCount('g2')).toBe(0);
  });
});
