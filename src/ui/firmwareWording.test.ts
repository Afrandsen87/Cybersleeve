/**
 * @module ui
 * Firmware naming invariants for real player text and content; no tuning assertions.
 * Called by: Vitest. Calls: uiText functions and real content definitions.
 */
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../content/gameConfig';
import { uiText } from './uiText';

/** Action competence keeps its existing names; the stat group also describes competence. */
const ALLOWED_SKILL_TEXT = ['Skill shards', 'Skill shard', 'Skill transfer', 'SKILL'] as const;

/**
 * Walk plain text recursively without inspecting identifiers or invoking structured-argument functions.
 * Called by: wording tests and itself. Calls: Object.values; has no side effects.
 */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/**
 * Check displayed words while allowing only the named competence phrases.
 * Called by: wording tests. Calls: Vitest assertions; has no game side effects.
 */
function checkWording(text: string): void {
  expect(text, text).not.toMatch(/firmwares/i);
  const remaining = ALLOWED_SKILL_TEXT.reduce((value, allowed) => value.replaceAll(allowed, ''), text);
  expect(remaining, text).not.toMatch(/skill/i);
}

describe('player-facing firmware wording', () => {
  it('sweeps every plain uiText value and real content name and description', () => {
    const content = [...gameConfig.buyables, ...gameConfig.actions, ...gameConfig.items.definitions];
    for (const text of [
      ...strings(uiText),
      ...content.flatMap((entry) => strings({ name: entry.name, description: 'description' in entry ? entry.description : undefined })),
    ]) {
      checkWording(text);
    }
  });

  it('checks changed function output, including the interface-speed firmware factor', () => {
    for (const text of [
      uiText.skills.points('2'),
      uiText.skills.resleevePoints('2'),
      uiText.tips.interfaceSpeed({
        base: '1',
        boosts: '0',
        networkFactor: null,
        nodes: '0',
        hackingMultiplier: '1',
        curve: { scale: 1, exponent: 1 },
        skillFactor: '1.05',
        total: '1.05',
      }),
    ])
      checkWording(text);
  });
});
