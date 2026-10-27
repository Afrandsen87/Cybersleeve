import { describe, expect, it } from 'vitest';
import { gameConfig } from './gameConfig';
import { ENTITY_ICONS } from './icons';

/** Currencies that skills are bought with (skills, automation skills, re-sleeve skills). */
const SKILL_CURRENCIES = new Set<string>(['skillPoints', 'automationPoints', 'resleevePoints']);

const skills = gameConfig.buyables.filter((b) => SKILL_CURRENCIES.has(b.currency ?? ''));
const skillIds = new Set(skills.map((s) => s.id));

describe('skill icons', () => {
  it('cover a non-trivial set of skills', () => {
    expect(skills.length).toBeGreaterThan(40);
  });

  it('are unique: no two skills show the same picture', () => {
    const owners = new Map<string, string[]>();
    for (const s of skills) {
      const name = ENTITY_ICONS[s.id];
      expect(name, `icon for ${s.id}`).toBeDefined();
      owners.set(name as string, [...(owners.get(name as string) ?? []), s.id]);
    }
    const shared = [...owners].filter(([, ids]) => ids.length > 1).map(([name, ids]) => `${name}: ${ids.join(', ')}`);
    expect(shared).toEqual([]);
  });

  it('are not borrowed from an action, item or other purchase', () => {
    const others = new Set(
      Object.entries(ENTITY_ICONS)
        .filter(([id]) => !skillIds.has(id))
        .map(([, name]) => name),
    );
    const borrowed = skills.map((s) => ENTITY_ICONS[s.id] as string).filter((name) => others.has(name));
    expect(borrowed).toEqual([]);
  });
});
