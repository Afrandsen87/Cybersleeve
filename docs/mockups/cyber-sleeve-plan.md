# Plan: Cyber-Sleeve tag, Cyber-Sleeve upgrade and Cyber-Sleeve Adaption

Status: agreed with the user 2026-11-01, not built. Source: `docs/vision/story.md` (the sixth sleeve action) plus the user's decisions below. Build in one batch via `/agent-task`.

Contexts: economy (tags), effects (boost scaling), actions (new action, unlock gate, run ICE, levels, XP reduction), resleeve (skill change), save (migration), ui (tooltip badge, poster).

## Decisions (user, 2026-11-01)

- **Tags.** Buyables get an optional list of tags, data in content. First tag: **Cyber-Sleeve**. Tags are explicit per buyable (not derived from `requiresSleeveSkills`); more tags may follow for other designs.
- **Tagged now (only these three):**
  - *Network Safety Protocols* (`runIceChance`): the boost multiplies the **ICE gained per proc** (the "+1 base ICE"), not the chance.
  - *Networked Sleeve* (`levelBonusFromSleeveSkills`): the boost multiplies the **levels added**, floored: only whole levels count (`floor(skills x boost)`).
  - *Study methods* (`sleeveXpReduction`): the boost multiplies the **resulting divisor**: XP needed = base / ((1 + perLevel x level x copies) x boost) (confirmed).
- **Cyber-Sleeve upgrade** replaces Clearance Escalation (Reach lane, same place and price): it **unlocks the sixth action directly**. The Access upgrade stays capped at 4 copies (access level 5); the `buyableCapBonus` on it goes away. (The user may raise access later for the political route.)
- **Cyber-Sleeve Adaption**, the sixth action: a regular action (action XP, action levels, sleeve XP and sleeve levels like the others). Each completed run adds **+0.1% additively** to the Cyber-Sleeve boost: `boost = 1 + 0.001 x runs` (100 runs = x1.10). Levels do not scale it. It is a **free action**: no heat (confirmed). Base duration at least 30x Build Legend (300 s), so 9,000 s. Its output (the run count) **resets on re-sleeve**. Tuning is accepted as is: interface speed is high by then.
- **Badge.** The tag is shown as a small badge at the **bottom of the tagged upgrades' tooltips** only (not on the buttons). Tooltips get a full redesign later; only the badge is designed now.

## Work

1. **Tags (economy).** `tags?: readonly TagId[]` on `BuyableDefinition` (`core/effects/buyableTypes.ts`); tag ids in `content/ids.ts`; validation in `core/config` (known tag; a tagged buyable's effect kind must declare what the tag boost scales).
2. **Boost owner (one code path).** One function returns a tag's boost from state (`1 + perRun x Adaption run count`, `perRun` in content). The registry entries of the three kinds (`core/effects/entries/sleeveEntries.ts`) declare that they are boostable; their existing owners apply it:
   - `core/actions/runIce.ts` (ICE amount),
   - `core/effects/queries.ts:54` (level bonus, floored),
   - `core/actions/xpReductions.ts` (divisor).
   UI formats boosted values from these owners only.
3. **Unlock gate (actions).** New effect kind `unlockAction` (one union member + one registry entry). `kernel/actionAccess.ts` `actionIsUnlocked` and `ActionRunner` accept an action unlocked by an owned `unlockAction` buyable, in addition to `requiredAccessLevel`. **Changes a standing rule** ("actions are gated only by access level"; the user approved the change): update `CLAUDE.md`, `AGENTS.md` (ask before `npm run agents:sync`), the incremental-design skill, and add a `docs/DECISIONS.md` entry.
4. **Skill (resleeve).** `content/buyables/resleeveBranches/reach.ts`: rename the id, name and text to Cyber-Sleeve upgrade; give it the `unlockAction` effect; give it a new unique icon. Drop the 5th-copy note from the Access upgrade text and comment (`content/buyables/sleeve.ts`).
5. **Action (actions).** New entry in `content/actions.ts` (+ its own `content/buyables/<action>.ts` if it gets buyables), a new reward kind that counts runs toward the boost, batched in closed form; a poster message on unlock.
6. **Save.** Version bump and migration: rename the skill id in saved purchases; clamp Access upgrade copies to 4.
7. **UI.** Badge at the bottom of the three tooltips, text in `ui/uiText.ts`. Following `docs/REVEAL_RULES.md`, the badge (and any boost text) shows only once the action has been revealed.
8. **Tests and docs.** Unit tests per feature; extend `batching.test.ts`, `testing/invariants.ts` and `core/properties.test.ts`; content invariant tests for the tag and the action; update `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/CONFIG.md` and the context slices (economy, effects, actions, resleeve, ui).

## Checks to report with the change

- **Impact:** the boost lifts three different levers (ICE, Practice Hacking levels, sleeve XP), so the action competes with the other actions for focus; nothing becomes dead. Networked Sleeve's floor means small boosts add nothing until `skills x boost` crosses an integer: expected, as decided.
- **Layer readiness:** the boost is per sleeve (read from that sleeve's action state), no global singleton; copies scale from records.
- **Numbers:** run count is a Decimal; the boost stays finite near 1e308; the ICE amount and divisor are clamped as their owners already do.
