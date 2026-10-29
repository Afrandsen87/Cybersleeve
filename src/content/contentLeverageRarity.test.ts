/**
 * The rarity skills of the leverage branch (real content): nothing rare can drop at first, and Deep Files, Sealed Archives and
 * Black Ledger each open one rarity in a chain.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { gameConfig, KOMPROMAT, KOMPROMAT_HARVEST } from './gameConfig';
import { SKILL_BLACK_LEDGER, SKILL_DEEP_FILES, SKILL_SEALED_ARCHIVES } from './ids';
import { flat } from '../testing/flatState';

const skill = (id: string) => gameConfig.buyables.find((b) => b.id === id)!;

describe('Kompromat rarity skills (real content)', () => {
  it('form a chain Deep Files -> Sealed Archives -> Black Ledger, each opening one rarity', () => {
    expect(skill(SKILL_SEALED_ARCHIVES).parents).toEqual([SKILL_DEEP_FILES]);
    expect(skill(SKILL_BLACK_LEDGER).parents).toEqual([SKILL_SEALED_ARCHIVES]);
    expect(skill(SKILL_DEEP_FILES).effect).toMatchObject({ kind: 'rarityWeightBonus', itemId: KOMPROMAT, rarityId: 'rare' });
    expect(skill(SKILL_SEALED_ARCHIVES).effect).toMatchObject({ kind: 'rarityWeightBonus', itemId: KOMPROMAT, rarityId: 'legendary' });
    expect(skill(SKILL_BLACK_LEDGER).effect).toMatchObject({ kind: 'rarityWeightBonus', itemId: KOMPROMAT, rarityId: 'crisis' });
  });

  it('at the start only common and uncommon can drop; each skill opens exactly its rarity', () => {
    const g = createGame();
    const state = flat<{ purchased: Record<string, number> }>(g);
    state.purchased[KOMPROMAT_HARVEST] = 1;
    const can = (r: string) => g.dropSources(KOMPROMAT, r).length > 0;
    expect(['common', 'uncommon', 'rare', 'legendary', 'crisis'].map(can)).toEqual([true, true, false, false, false]);
    state.purchased[SKILL_DEEP_FILES] = 1;
    expect(['rare', 'legendary', 'crisis'].map(can)).toEqual([true, false, false]);
    state.purchased[SKILL_SEALED_ARCHIVES] = 1;
    expect(['rare', 'legendary', 'crisis'].map(can)).toEqual([true, true, false]);
    state.purchased[SKILL_BLACK_LEDGER] = 1;
    expect(['rare', 'legendary', 'crisis'].map(can)).toEqual([true, true, true]);
  });
});
