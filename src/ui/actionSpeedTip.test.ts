import { game } from '../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { killAction, setSleeveXp, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';

const tip = (g: ReturnType<typeof game>, index = 0): string => buildViewModel(g).actions[index]!.speedTip;

describe("the tooltip on an action card's speed line", () => {
  it('explains that speed is action level x sleeve level x interface speed, and that run time is base time / speed', () => {
    const text = tip(game());
    expect(text).toContain('Action Speed = Action Level x Sleeve Level x Interface Speed');
    expect(text).toContain('Run Time = Base Time / Action Speed');
  });

  it('names each factor with its level and how much a level is worth (test config: +100% per level)', () => {
    const g = game();
    (g.getState().sleeve.actions['a'] as { xp: unknown }).xp = num(10); // test config levels: level 1 at 5 XP
    const text = tip(g);
    expect(text).toContain('Action Level = 2 (level 1, +100% per level)');
    expect(text).toContain('Sleeve Level = 1 (level 0, +100% per level)');
    expect(text).toContain('Interface Speed = 1');
  });

  it('shows the interface speed as it is now, so raising it changes the tip', () => {
    const slow = game({ sleeve: { baseInterfaceSpeed: 0.1 } });
    expect(tip(slow)).toContain('Interface Speed = 0.1');
    expect(tip(game({ sleeve: { baseInterfaceSpeed: 4 } }))).toContain('Interface Speed = 4');
  });

  it('ends with the result: the speed shown on the card, and base time becoming the real run time', () => {
    const g = game({ sleeve: { baseInterfaceSpeed: 0.5 } });
    const card = buildViewModel(g).actions[0]!;
    const speed = card.speedText.replace('x', '');
    expect(card.speedTip).toContain(`Action Speed = ${speed}`);
    expect(card.speedTip).toContain(`Run Time = ${card.durationText} (10s / ${speed})`);
  });

  it('matches the speed the engine really uses: the factors multiply to the current speed', () => {
    const g = game({ sleeve: { baseInterfaceSpeed: 0.5 } });
    (g.getState().sleeve.actions['a'] as { xp: unknown }).xp = num(10);
    const product = g.speedFactors('a').reduce((p, f) => p * f.factor, 1);
    expect(product).toBeCloseTo(g.currentSpeed('a'), 10);
  });

  it('mentions the level bonus from purchases only when there is one', () => {
    expect(tip(game())).not.toContain('from purchases');
  });

  it('mentions the global speed lever only when it is not 1', () => {
    expect(tip(game())).not.toContain('Global Speed');
    expect(tip(game({ global: { speedMultiplier: 4 } }))).toContain('Global Speed = 4');
  });

  it('describes an exponential rule too', () => {
    const g = game({ speed: { actionLevel: { kind: 'exponential', base: 2 } } });
    expect(tip(g)).toContain('x2 per level');
  });

  it('is empty while the action is locked (the card then explains the lock instead)', () => {
    const g = game({ actions: [testConfig.actions[0]!, { ...killAction, requiredAccessLevel: 4 }] });
    expect(tip(g, 1)).toBe('');
    setSleeveXp(g, num(0));
    expect(tip(g, 0)).not.toBe('');
  });
});
