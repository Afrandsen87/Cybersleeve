/**
 * Guards for the REAL game content. These check invariants that must hold whatever the tuning is (a valid
 * configuration, nothing unreachable, every purchase works), not the tuning numbers themselves, so retuning
 * `gameConfig.ts` does not break them. Exact behaviour is tested against `testing/testConfig.ts` elsewhere.
 */

import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { validateConfig } from '../core';
import { num } from '../numbers';
import { markResleeved, openResleeving } from '../testing/sleeveLevelsKit';
import { setCredits } from '../testing/testConfig';
import { buildViewModel } from '../ui/viewModel';
import {
  ACCESS_UPGRADE,
  PERSISTENCE,
  RANSOMWARE,
  SLEEVE_LEVELS,
  SKILL_INCORPORATION,
  SKILL_DEEP_CONDITIONING,
  SKILL_SLEEVE_EUPHORIA,
  SKILL_SYNTHETIC_SLEEVES,
  ZERO_DAY_EXPLOITS,
  gameConfig,
  KOMPROMAT,
  KOMPROMAT_HARVEST,
  MALWARE_AUTO_RUN,
  MALWARE_ICE,
  MALWARE_OUTPUT,
  PRACTICE_HACKING,
  PUSH_MALWARE,
  SKILLS,
} from './gameConfig';
import { skillViews } from '../testing/skillViews';

describe('real game content (src/content/gameConfig.ts)', () => {
  it('is a valid configuration', () => {
    expect(validateConfig(gameConfig)).toEqual([]);
  });

  it('can start: the first action is available without any purchase', () => {
    const first = gameConfig.actions[0]!;
    expect(first.requiredAccessLevel ?? 1).toBeLessThanOrEqual(gameConfig.sleeve.baseAccessLevel);
  });

  it('every action is reachable: its required access level is the base level plus what the access buyables can grant', () => {
    const granted =
      gameConfig.sleeve.baseAccessLevel +
      gameConfig.buyables.reduce((sum, b) => (b.effect.kind === 'accessLevel' ? sum + b.effect.amount * (b.maxPurchases ?? 1) : sum), 0);
    for (const a of gameConfig.actions) {
      expect(a.requiredAccessLevel ?? 1, `${a.id} needs an unreachable access level`).toBeLessThanOrEqual(granted);
    }
  });

  it('access levels form a ladder with no gaps: every level an action needs is reached one purchase at a time', () => {
    const needed = [...new Set(gameConfig.actions.map((a) => a.requiredAccessLevel ?? 1))].sort((x, y) => x - y);
    for (let i = 1; i < needed.length; i++) expect(needed[i]! - needed[i - 1]!, 'a level is skipped').toBe(1);
    expect(needed[0]).toBe(gameConfig.sleeve.baseAccessLevel);
  });

  it('buying access upgrades one at a time opens the actions in order of their required level', () => {
    const g = createGame();
    setCredits(g, num('1e100'));
    const byLevel = [...gameConfig.actions].sort((x, y) => (x.requiredAccessLevel ?? 1) - (y.requiredAccessLevel ?? 1));
    for (const a of byLevel) {
      while (!g.isUnlocked(a.id)) expect(g.buy(ACCESS_UPGRADE), `${a.id} could not be unlocked`).toBe('purchased');
      const open = gameConfig.actions.filter((x) => g.isUnlocked(x.id)).map((x) => x.requiredAccessLevel ?? 1);
      expect(Math.max(...open)).toBeLessThanOrEqual(g.sleeveStats().accessLevel);
    }
  });

  it('every action has an auto-run buyable that really restarts it, also when starting costs nodes', () => {
    for (const a of gameConfig.actions) {
      const auto = gameConfig.buyables.find((b) => b.actionId === a.id && b.effect.kind === 'autoRun');
      if (!auto) continue;
      const g = createGame();
      setCredits(g, num('1e100'));
      (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num('1e100');
      while (!g.isUnlocked(a.id)) expect(g.buy(ACCESS_UPGRADE)).toBe('purchased');
      expect(g.buy(auto.id), `${auto.id} could not be bought`).toBe('purchased');
      expect(g.isAutoRun(a.id)).toBe(true);
      g.startAction(a.id);
      const oneRun = g.currentDurationMs(a.id);
      g.tick(oneRun * 3.5);
      expect(g.getState().sleeve.actions[a.id]!.xp.gte(num(3)), `${a.id} did not restart itself`).toBe(true);
    }
  });

  it("Push malware's auto-run is the button of the square on its card, and not in its row of purchases", () => {
    const card = buildViewModel(createGame()).actions.find((x) => x.id === PUSH_MALWARE)!;
    expect(card.square.locked).toBe(true);
    expect(card.square.cells[0]).toMatchObject({ id: 'autoRun', mode: 'buy', buyableId: MALWARE_AUTO_RUN });
    expect(card.buyables.find((b) => b.id === MALWARE_AUTO_RUN)!.inSquare).toBe(true);
    const row = card.buyables.filter((b) => !b.inSquare).map((b) => b.id);
    expect(row).toEqual([MALWARE_OUTPUT, MALWARE_ICE, ZERO_DAY_EXPLOITS, RANSOMWARE, PERSISTENCE]); // by base price
  });

  it("Push malware's row of purchases is sorted by price, cheapest first", () => {
    const card = buildViewModel(createGame()).actions.find((x) => x.id === PUSH_MALWARE)!;
    const prices = card.buyables.filter((b) => !b.inSquare).map((b) => gameConfig.buyables.find((d) => d.id === b.id)!.cost.toNumber());
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('every buyable can be bought once enough credits are available (no dead gates)', () => {
    const g = createGame();
    setCredits(g, num('1e100'));
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num('1e100'); // some buyables are paid in network nodes
    // Buy in config order, repeating until nothing more can be bought once (a gate may be listed after what it unlocks).
    // Skills are paid in skill points or re-sleeve points, not credits: they have their own tests below.
    markResleeved(g); // Skill transfer and Faster conditioning wait for the second sleeve run
    const bought = gameConfig.buyables.filter((b) => b.currency !== 'skillPoints' && b.currency !== 'resleevePoints');
    for (let pass = 0; pass < bought.length; pass++) {
      for (const b of bought) if (g.canBuy(b.id)) expect(g.buy(b.id)).toBe('purchased');
    }
    for (const b of bought) expect(g.ownedCount(b.id), `${b.id} was never purchasable`).toBeGreaterThan(0);
  });

  it('a new game has no skill point, the first comes when an action reaches level 1, and every root skill can be bought with it', () => {
    expect(createGame().skillPoints()).toBe(0);
    for (const id of SKILLS.filter((s) => !gameConfig.buyables.find((b) => b.id === s)?.parents?.length)) {
      const g = createGame();
      expect(g.canBuy(id), `${id} can be bought without a point`).toBe(false);
      // a skill is offered only once the purchase that unlocks it is owned
      for (const r of gameConfig.buyables.find((b) => b.id === id)?.requires ?? [])
        (g.getState().sleeve.purchased as Record<string, number>)[r] = 1;
      (g.getState().sleeve.actions[gameConfig.actions[0]!.id] as { xp: unknown }).xp = num(10); // the first action reaches level 1
      expect(g.actionLevel(gameConfig.actions[0]!.id)).toBe(1);
      expect(g.skillPoints()).toBe(1);
      expect(g.canBuy(id), `${id} cannot be bought with the first point`).toBe(true);
      expect(g.buy(id)).toBe('purchased');
      expect(g.skillPoints()).toBe(0);
    }
  });

  it('there is one skill for each of the twenty-eight in the design, all costing 1 point and none belonging to an action', () => {
    const skills = gameConfig.buyables.filter((b) => b.currency === 'skillPoints');
    expect(skills.map((b) => b.id)).toEqual([...SKILLS]);
    expect(skills).toHaveLength(28);
    for (const b of skills) {
      expect(b.cost.eq(num(1)), b.id).toBe(true);
      expect(b.actionId, b.id).toBeUndefined();
    }
  });

  it('a new game has no re-sleeve point; each re-sleeve gives one, and every lane is bought from its root', () => {
    const g = createGame();
    expect(g.resleevePoints()).toBe(0);
    expect(g.canBuy(SKILL_SLEEVE_EUPHORIA)).toBe(false);
    openResleeving(g);
    g.resleeve();
    expect(g.resleevePoints()).toBe(1);
    expect(g.canBuy(SKILL_DEEP_CONDITIONING), 'a node under Sleeve Euphoria is locked until it is bought').toBe(false);
    expect(g.buy(SKILL_SLEEVE_EUPHORIA)).toBe('purchased');
    expect(g.resleevePoints()).toBe(0);
    g.resleeve();
    expect(g.buy(SKILL_SYNTHETIC_SLEEVES)).toBe('purchased');
    g.resleeve();
    expect(g.buy(SKILL_INCORPORATION)).toBe('purchased');
    expect(g.resleevePoints()).toBe(0);
  });

  it('Incorporation says in its tooltip that it opens the Corporation tab (once the first re-sleeve has shown what the skills are)', () => {
    const g = createGame();
    openResleeving(g);
    g.resleeve();
    const view = skillViews(buildViewModel(g).skills.resleeve.lanes).find((b) => b.id === SKILL_INCORPORATION)!;
    expect(view.tip).toContain('opens the Corporation tab');
  });

  it('every action can be unlocked by playing (no action is permanently locked)', () => {
    const g = createGame();
    setCredits(g, num('1e100'));
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num('1e100');
    for (let pass = 0; pass < gameConfig.buyables.length; pass++) {
      for (const b of gameConfig.buyables) if (g.canBuy(b.id)) g.buy(b.id);
    }
    g.tick(1);
    for (const a of gameConfig.actions) expect(g.isUnlocked(a.id), `${a.id} stays locked`).toBe(true);
  });

  it('a fresh game runs: starting the first action eventually pays credits, network nodes or interface speed', () => {
    const g = createGame();
    const first = gameConfig.actions[0]!;
    g.startAction(first.id);
    g.tick(g.currentDurationMs(first.id) + 1);
    const s = g.getState();
    expect(s.sleeve.actions[first.id]!.xp.isZero()).toBe(false);
    expect(s.wallet.credits.isZero() && s.sleeve.network.isZero() && s.sleeve.hackingProficiency.isZero()).toBe(false);
  });

  it('every item a buyable can drop exists, and the harvest is the second purchase on the Practice Hacking card', () => {
    const itemIds = new Set(gameConfig.items.definitions.map((i) => i.id));
    for (const b of gameConfig.buyables) if (b.effect.kind === 'itemDrop') expect(itemIds.has(b.effect.drop.itemId), b.id).toBe(true);
    const card = buildViewModel(createGame()).actions.find((a) => a.id === PRACTICE_HACKING)!;
    expect(card.buyables[1]!.id).toBe(KOMPROMAT_HARVEST);
  });

  it('a harvested file can be sold for credits, end to end', () => {
    const g = createGame({ random: () => 0 }); // every roll succeeds: every run drops the most common file
    setCredits(g, num(1000));
    while (!g.isUnlocked(PRACTICE_HACKING)) g.buy(ACCESS_UPGRADE);
    expect(g.buy(KOMPROMAT_HARVEST)).toBe('purchased');
    g.startAction(PRACTICE_HACKING);
    g.tick(g.currentDurationMs(PRACTICE_HACKING) + 1);
    const common = g.getState().wallet.inventory[KOMPROMAT]!['common']!;
    expect(common).toBeGreaterThanOrEqual(1);
    const before = g.getState().wallet.credits;
    expect(g.sellItems(KOMPROMAT, 'common', 'all')).toBe(common);
    expect(
      g
        .getState()
        .wallet.credits.sub(before)
        .eq(num(100 * common)),
    ).toBe(true);
  });

  it('the view model builds for the real content', () => {
    const vm = buildViewModel(createGame());
    expect(vm.actions.map((a) => a.id)).toEqual(gameConfig.actions.map((a) => a.id));
    for (const b of gameConfig.buyables) {
      if (b.id === SLEEVE_LEVELS) continue; // it is the Re-sleeve button, not in a list (tested below)
      const owner =
        b.currency === 'skillPoints'
          ? skillViews(vm.skills.lanes)
          : b.currency === 'resleevePoints'
            ? skillViews(vm.skills.resleeve.lanes)
            : b.currency === 'automationPoints'
              ? skillViews(vm.automation.features.flatMap((f) => f.lanes))
              : b.corporationActionId !== undefined
                ? vm.corporation.actions.find((a) => a.id === b.corporationActionId)!.buyables
                : b.effect.kind === 'corporateRank'
                  ? vm.corporation.buyables
                  : b.actionId === undefined
                    ? vm.sleeve.buyables
                    : vm.actions.find((a) => a.id === b.actionId)!.buyables;
      expect(owner.map((v) => v.id)).toContain(b.id);
    }
  });

  it('the sleeve-levels unlock is the Re-sleeve button: for sale once in reach, then the Re-sleeve action after a lockout', () => {
    const g = createGame();
    expect(buildViewModel(g).resleeveBuy).toBeNull(); // not in reach in a new game
    setCredits(g, num('1e11'));
    (g.getState() as unknown as { sleeve: { peakCredits: unknown } }).sleeve.peakCredits = num('1e11');
    const vm = buildViewModel(g);
    expect(vm.resleeveShown).toBe(false);
    expect(vm.resleeveBuy).toMatchObject({ id: SLEEVE_LEVELS, affordable: true });
    g.buy(SLEEVE_LEVELS);
    const after = buildViewModel(g);
    expect(after.resleeveShown).toBe(true);
    expect(after.resleeveBuy).toBeNull();
    expect(after.canResleeve).toBe(false);
    g.tick(5_000);
    expect(buildViewModel(g).canResleeve).toBe(true);
  });

  it('the player is never charged a negative or non-finite price', () => {
    const g = createGame();
    for (const b of gameConfig.buyables) {
      const price = g.costOf(b.id);
      expect(price.isFinite() && !price.isNegative()).toBe(true);
    }
  });
});
