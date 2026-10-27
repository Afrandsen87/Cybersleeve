/**
 * Guards for the REAL content: Overclock, Focus, Burn leads and Zero-days. Invariants only, never tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { buildViewModel } from '../ui/viewModel';
import {
  ACCESS_UPGRADE,
  BURN_LEAD,
  BURN_LEADS,
  CRITICAL_SUCCESS,
  PERSISTENCE,
  RANSOMWARE,
  SKILL_COLD_TRAIL,
  SKILL_OBFUSCATION,
  ZERO_DAY,
  ZERO_DAY_EXPLOITS,
  FOCUS_UPGRADE,
  focusUnlockId,
  GROW_NETWORK,
  gameConfig,
  OVERCLOCK_UPGRADE,
  overclockUnlockId,
  PRACTICE_HACKING,
  PUSH_MALWARE,
} from './gameConfig';

describe('Overclock, Focus and Burn leads (real content)', () => {
  const rich = (): ReturnType<typeof createGame> => {
    const g = createGame({ random: () => 0 }); // every roll succeeds
    setCredits(g, num('1e100'));
    return g;
  };

  it('the Overclock upgrade is a sleeve buyable, unlimited, that gets dearer with every copy', () => {
    const b = gameConfig.buyables.find((x) => x.id === OVERCLOCK_UPGRADE)!;
    expect(b.actionId).toBeUndefined();
    expect(b.maxPurchases).toBe(Infinity);
    expect(b.costGrowth ?? 1).toBeGreaterThan(1);
  });

  it('every action with an Overclock effect has an unlock of its own, and no action without one does', () => {
    for (const a of gameConfig.actions) {
      const unlock = gameConfig.buyables.find((b) => b.id === overclockUnlockId(a.id));
      expect(unlock !== undefined, a.id).toBe(a.overclock !== undefined);
      if (unlock) expect(unlock.actionId).toBe(a.id);
    }
  });

  it('Grow network, Practice Hacking and Push malware each have an Overclock effect of their own', () => {
    const rules = [GROW_NETWORK, PRACTICE_HACKING, PUSH_MALWARE].map((id) => gameConfig.actions.find((a) => a.id === id)!.overclock);
    for (const rule of rules) expect(rule).toBeDefined();
    expect(new Set(rules.map((r) => JSON.stringify(r))).size).toBe(3);
  });

  it('the Overclock toggle appears when the action unlocks it, and makes Grow network faster', () => {
    const g = rich();
    expect(buildViewModel(g).actions.every((a) => a.overclock === null)).toBe(true);
    expect(g.buy(OVERCLOCK_UPGRADE)).toBe('purchased');
    expect(buildViewModel(g).actions.every((a) => a.overclock === null)).toBe(true); // the upgrade alone unlocks nothing
    expect(g.buy(overclockUnlockId(GROW_NETWORK))).toBe('purchased');
    expect(
      buildViewModel(g)
        .actions.filter((a) => a.overclock !== null)
        .map((a) => a.id),
    ).toEqual([GROW_NETWORK]);
    const before = g.currentDurationMs(GROW_NETWORK);
    g.toggleOverclock(GROW_NETWORK);
    expect(g.currentDurationMs(GROW_NETWORK)).toBeLessThan(before);
  });

  it('an overclocked Grow network adds heat while it runs, in fractions of a point', () => {
    const g = rich();
    g.buy(overclockUnlockId(GROW_NETWORK));
    g.toggleOverclock(GROW_NETWORK);
    g.startAction(GROW_NETWORK);
    g.tick(Math.min(10_000, g.currentDurationMs(GROW_NETWORK) - 1));
    const heat = g.getState().heat;
    expect(heat).toBeGreaterThan(0);
    expect(heat).toBeLessThan(1);
  });

  it('Grow network adds 2 heat per minute while overclocked', () => {
    expect(gameConfig.actions.find((a) => a.id === GROW_NETWORK)!.overclock!.heatPerMinute).toBe(2);
  });

  it('Practice Hacking overclocked pays 3x and each completed run costs 5 nodes, end to end', () => {
    const g = rich();
    while (!g.isUnlocked(PRACTICE_HACKING)) g.buy(ACCESS_UPGRADE);
    g.buy(overclockUnlockId(PRACTICE_HACKING));
    (g.getState() as unknown as { network: unknown }).network = num(100);
    const run = (): number => {
      g.startAction(PRACTICE_HACKING);
      g.tick(g.currentDurationMs(PRACTICE_HACKING) + 1);
      return g.getState().hackingProficiency.toNumber();
    };
    const plain = run();
    g.toggleOverclock(PRACTICE_HACKING);
    const before = g.getState().network.toNumber();
    const gained = run() - plain;
    expect(gained).toBeCloseTo(plain * 3, 9);
    expect(g.getState().network.toNumber()).toBe(before - 5);
  });

  it('Push malware overclocked pays the nodes of a Grow network run and makes 3x the heat, end to end', () => {
    const g = rich();
    while (!g.isUnlocked(PUSH_MALWARE)) g.buy(ACCESS_UPGRADE);
    g.buy(overclockUnlockId(PUSH_MALWARE));
    const push = gameConfig.actions.find((a) => a.id === PUSH_MALWARE)!;
    const complete = (): void => {
      g.startAction(PUSH_MALWARE);
      g.tick(g.currentDurationMs(PUSH_MALWARE) + 1);
    };
    complete();
    const plainHeat = g.getState().heat;
    expect(plainHeat).toBeCloseTo(push.heatPerRun!, 9);
    expect(g.getState().network.toNumber()).toBe(0);
    (g.getState() as unknown as { heat: number }).heat = 0; // a run takes a minute, so the cooldown would take a point meanwhile
    g.toggleOverclock(PUSH_MALWARE);
    complete();
    expect(g.getState().heat).toBeCloseTo(plainHeat * 3, 9);
    expect(g.getState().network.toNumber()).toBe(g.payoutPerRun(GROW_NETWORK).toNumber());
  });

  it('every action has a Focus unlock of its own', () => {
    for (const a of gameConfig.actions) {
      const unlock = gameConfig.buyables.find((b) => b.id === focusUnlockId(a.id));
      expect(unlock?.actionId, a.id).toBe(a.id);
    }
  });

  it('the Focus upgrade is a sleeve buyable whose cap gives every action a slot, counting the free one', () => {
    const b = gameConfig.buyables.find((x) => x.id === FOCUS_UPGRADE)!;
    expect(b.actionId).toBeUndefined();
    expect(b.effect.kind).toBe('focusSlots');
    const perCopy = b.effect.kind === 'focusSlots' ? b.effect.perCopy : 0;
    expect(gameConfig.focus.baseSlots + (b.maxPurchases as number) * perCopy).toBe(gameConfig.actions.length);
  });

  it('with the unlocks and every slot, all actions can be focused at once, and not before', () => {
    const g = rich();
    for (const a of gameConfig.actions) expect(g.buy(focusUnlockId(a.id))).toBe('purchased');
    expect(g.toggleFocus(gameConfig.actions[0]!.id)).toBe(true);
    expect(g.toggleFocus(gameConfig.actions[1]!.id)).toBe(false); // one free slot only
    const upgrade = gameConfig.buyables.find((x) => x.id === FOCUS_UPGRADE)!;
    for (let i = 0; i < (upgrade.maxPurchases as number); i++) expect(g.buy(FOCUS_UPGRADE)).toBe('purchased');
    expect(g.buy(FOCUS_UPGRADE)).toBe('max-reached');
    for (const a of gameConfig.actions) g.getState().focused[a.id] || g.toggleFocus(a.id);
    expect(gameConfig.actions.every((a) => g.getState().focused[a.id])).toBe(true);
  });

  it('Focus makes the focused action faster', () => {
    const g = rich();
    g.buy(focusUnlockId(GROW_NETWORK));
    const before = g.currentDurationMs(GROW_NETWORK);
    g.toggleFocus(GROW_NETWORK);
    expect(g.currentDurationMs(GROW_NETWORK)).toBeLessThan(before);
  });

  it("the unlocks cost a fixed multiple of the action's own Auto-run price (Grow network: 250 and 1,000), and the upgrades 1000x the old unlocks", () => {
    const cost = (id: string): number => gameConfig.buyables.find((b) => b.id === id)!.cost.toNumber();
    const autoRun = (actionId: string): number =>
      gameConfig.buyables.find((b) => b.actionId === actionId && b.effect.kind === 'autoRun')!.cost.toNumber();
    for (const a of gameConfig.actions) {
      if (a.overclock) expect(cost(overclockUnlockId(a.id)), a.id).toBeCloseTo(autoRun(a.id) * 25, 6);
      expect(cost(focusUnlockId(a.id)), a.id).toBeCloseTo(autoRun(a.id) * 100, 6);
    }
    expect(cost(overclockUnlockId(GROW_NETWORK))).toBe(250);
    expect(cost(focusUnlockId(GROW_NETWORK))).toBe(1_000);
    expect(cost(OVERCLOCK_UPGRADE)).toBe(250 * 1_000);
    expect(cost(FOCUS_UPGRADE)).toBe(1_000 * 1_000);
  });

  it('the Burn lead has no rarity: one row in the Inventory named "Burn lead", and its drop names no rarity weights', () => {
    expect(gameConfig.items.definitions.find((d) => d.id === BURN_LEAD)!.hasRarity).toBe(false);
    const leads = gameConfig.buyables.find((b) => b.id === BURN_LEADS)!;
    expect(leads.effect.kind === 'itemDrop' && leads.effect.drop.rarityWeights).toBeUndefined();
    const g = rich();
    (g.getState() as unknown as { inventory: Record<string, Record<string, number>> }).inventory[BURN_LEAD] = { common: 2 };
    const rows = buildViewModel(g).inventory.rows.filter((r) => r.itemId === BURN_LEAD);
    expect(rows.map((r) => r.label)).toEqual(['Burn lead']);
    expect(rows[0]!.tip).not.toMatch(/common|uncommon|rare|legendary|crisis/i);
  });

  it('the Burn lead is an item that cannot be sold, and using one is configured', () => {
    const item = gameConfig.items.definitions.find((d) => d.id === BURN_LEAD)!;
    expect(item.sellable).toBe(false);
    expect(gameConfig.items.burnLead?.itemId).toBe(BURN_LEAD);
  });

  it('Burn leads are bought on the Grow network card and make its runs drop leads, end to end', () => {
    const card = buildViewModel(createGame()).actions.find((a) => a.id === GROW_NETWORK)!;
    expect(card.buyables.map((b) => b.id)).toContain(BURN_LEADS);
    const g = rich();
    (g.getState().purchased as Record<string, number>)[overclockUnlockId(PUSH_MALWARE)] = 1; // the reveal gate of Burn leads
    expect(g.buy(BURN_LEADS)).toBe('purchased');
    g.startAction(GROW_NETWORK);
    g.tick(g.currentDurationMs(GROW_NETWORK) + 1);
    const held = Object.values(g.getState().inventory[BURN_LEAD] ?? {}).reduce((sum, n) => sum + n, 0);
    expect(held).toBeGreaterThanOrEqual(1);
  });

  it('using a Burn lead takes part of the heat away and uses the lead up, end to end', () => {
    const g = rich();
    (g.getState().purchased as Record<string, number>)[overclockUnlockId(PUSH_MALWARE)] = 1; // the reveal gate of Burn leads
    g.buy(BURN_LEADS);
    g.startAction(GROW_NETWORK);
    g.tick(g.currentDurationMs(GROW_NETWORK) + 1);
    const rarity = Object.keys(g.getState().inventory[BURN_LEAD]!)[0]!;
    const count = g.getState().inventory[BURN_LEAD]![rarity]!;
    (g.getState() as { heat: number }).heat = 40;
    expect(g.useBurnLead(rarity)).toBe(true);
    expect(g.getState().heat).toBeCloseTo(40 * (1 - gameConfig.items.burnLead!.heatFraction), 9);
    expect(g.getState().inventory[BURN_LEAD]![rarity]).toBe(count - 1);
  });
});

describe('Zero-days (real content)', () => {
  /** A game with plenty of credits and access level 3 (Push malware). */
  const rich = (): ReturnType<typeof createGame> => {
    const g = createGame({ random: () => 0.5 });
    setCredits(g, num('1e100'));
    for (let i = 0; i < 2; i++) g.buy(ACCESS_UPGRADE);
    return g;
  };

  it('the Zero-day has no rarity, cannot be sold, and is tied to Push malware', () => {
    const item = gameConfig.items.definitions.find((d) => d.id === ZERO_DAY)!;
    expect(item.hasRarity).toBe(false);
    expect(item.sellable).toBe(false);
    expect(gameConfig.items.zeroDay).toEqual({ itemId: ZERO_DAY, actionId: PUSH_MALWARE });
    const exploits = gameConfig.buyables.find((b) => b.id === ZERO_DAY_EXPLOITS)!;
    expect(exploits.actionId).toBe(PUSH_MALWARE);
    expect(exploits.effect.kind === 'itemDrop' && exploits.effect.drop.rarityWeights).toBeUndefined();
  });

  it('the Inventory shows one toggleable row named "Zero-day", lit while the toggle is on, end to end', () => {
    const g = rich();
    (g.getState() as unknown as { inventory: Record<string, Record<string, number>> }).inventory[ZERO_DAY] = { common: 2 };
    const row = () => buildViewModel(g).inventory.rows.find((r) => r.itemId === ZERO_DAY)!;
    expect(row()).toMatchObject({ label: 'Zero-day', toggleable: true, on: false, canUse: true, sellable: false });
    expect(g.toggleZeroDays()).toBe(true);
    expect(row().on).toBe(true);
    expect(row().tip).toContain('Switched on');
  });

  it('Zero-day exploits cost 5 million credits; Persistence is a one-time 1-trillion-credit buyable on Push malware that triples critical successes', () => {
    const find = (id: string) => gameConfig.buyables.find((b) => b.id === id)!;
    expect(find(ZERO_DAY_EXPLOITS).cost.eq(num(5_000_000))).toBe(true);
    const persistence = find(PERSISTENCE);
    expect(persistence.cost.eq(num(1e12))).toBe(true);
    expect(persistence.actionId).toBe(PUSH_MALWARE);
    expect(persistence.maxPurchases ?? 1).toBe(1);
    expect(persistence.effect).toEqual({ kind: 'criticalBoost', factor: 3 });
  });

  it('Ransomware sits on the Push malware card and links its critical runs to Grow network', () => {
    const ransomware = gameConfig.buyables.find((b) => b.id === RANSOMWARE)!;
    expect(ransomware.actionId).toBe(PUSH_MALWARE);
    expect(ransomware.effect).toEqual({ kind: 'criticalLink', targetActionId: GROW_NETWORK });
  });

  it('Ransomware, end to end: a Zero-day critical Push malware run banks a guaranteed critical for Grow network, which then spends it', () => {
    const g = rich();
    g.buy(CRITICAL_SUCCESS); // Ransomware waits for critical successes to exist
    g.buy(RANSOMWARE);
    (g.getState() as unknown as { inventory: Record<string, Record<string, number>> }).inventory[ZERO_DAY] = { common: 1 };
    g.toggleZeroDays();
    g.startAction(PUSH_MALWARE);
    g.tick(g.currentDurationMs(PUSH_MALWARE) + 1);
    expect(g.getState().bankedCriticals).toEqual({ [GROW_NETWORK]: 1 });
    const nodes = g.getState().network.toNumber();
    const reward = g.payoutPerRun(GROW_NETWORK).toNumber();
    g.startAction(GROW_NETWORK);
    g.tick(g.currentDurationMs(GROW_NETWORK) + 1);
    expect(g.getState().bankedCriticals).toEqual({});
    expect(g.getState().network.toNumber() - nodes).toBeGreaterThanOrEqual(reward * gameConfig.criticalSuccess.rewardMultiplier);
  });

  it('Obfuscation is a one-point skill that lowers the heat of Push malware Overclock from 3x to 2x', () => {
    const skill = gameConfig.buyables.find((b) => b.id === SKILL_OBFUSCATION)!;
    expect(skill.currency).toBe('skillPoints');
    expect(skill.effect).toEqual({ kind: 'overclockHeatFactor', targetActionId: PUSH_MALWARE, factor: 2 });
    expect(gameConfig.actions.find((a) => a.id === PUSH_MALWARE)!.overclock?.heatPerRunFactor).toBe(3);
    const g = rich();
    g.buy(overclockUnlockId(PUSH_MALWARE));
    expect(g.overclockStatus(PUSH_MALWARE)!.heatPerRunFactor).toBe(3);
    (g.getState().actions[gameConfig.actions[0]!.id] as { xp: unknown }).xp = num(1e6); // plenty of skill points
    (g.getState().purchased as Record<string, number>)[SKILL_COLD_TRAIL] = 1; // Obfuscation grows from it
    expect(g.buy(SKILL_OBFUSCATION)).toBe('purchased');
    expect(g.overclockStatus(PUSH_MALWARE)!.heatPerRunFactor).toBe(2);
  });

  it('an empty stack cannot be switched on: the tile is not usable', () => {
    const row = buildViewModel(rich()).inventory.rows.find((r) => r.itemId === ZERO_DAY)!;
    expect(row).toMatchObject({ toggleable: true, on: false, canUse: false, count: 0 });
  });

  it('a switched-on Zero-day makes the next Push malware run critical and is used up', () => {
    const g = rich();
    (g.getState() as unknown as { inventory: Record<string, Record<string, number>> }).inventory[ZERO_DAY] = { common: 1 };
    g.toggleZeroDays();
    const xpBefore = g.getState().actions[PUSH_MALWARE]!.xp.toNumber();
    const xpPerRun = g.xpPerRun(PUSH_MALWARE).toNumber();
    g.startAction(PUSH_MALWARE);
    g.tick(g.currentDurationMs(PUSH_MALWARE) + 1);
    expect(g.getState().inventory[ZERO_DAY]?.['common'] ?? 0).toBe(0);
    expect(g.getState().zeroDaysOn).toBe(false);
    expect(g.getState().actions[PUSH_MALWARE]!.xp.toNumber() - xpBefore).toBeCloseTo(xpPerRun * gameConfig.criticalSuccess.xpMultiplier, 9);
  });
});
