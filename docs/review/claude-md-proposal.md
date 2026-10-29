# Proposed instruction edits (NOT applied)

Apply after the first context is migrated (migration Step 3). Afterwards ask the user whether to run `npm run agents:sync`; do not regenerate `AGENTS.md` unprompted.

## 1. `CLAUDE.md`

**Add under "Engineering principles"** (after "Build incrementally"):

```
- **Bounded contexts:** code lives in `src/core/<context>/` (map: `docs/review/target-architecture.md`, later `docs/contexts/README.md`). A context exposes only its `index.ts` and narrow `*Queries` interfaces; never import another context's other files (`core/boundaries.test.ts` enforces it).
- **One mechanic, one code path:** a rule (heat tax, crit cover, reward payout, drop share, curves) has exactly one owner function or service in its context. Before writing logic, grep for the rule; reuse or extend the owner. Two paths for one rule is a defect, not a style choice. UI formats values from the owner and never re-derives them.
- **Name the context:** every new mechanic states its context in the PR/report and in its TSDoc, and registers its effect-kind entry from that context.
```

**Add under "How to work"**:

```
- **Load a context's slice only:** read `docs/contexts/<context>.md` and that context's files and tests, not whole `DESIGN.md`, `ARCHITECTURE.md`, `CONFIG.md` or `DECISIONS.md`. Cross-context work lists the contexts it touches first.
- **Impact check for new or changed mechanics** (report it with the change): no dead option (never worth taking), no option that dominates at every stage, no option with fixed outcome whatever the player does. Reason from the content data and formulas; leave tuning alone. Same-effect, same-growth options are a fake choice.
- **Layer-readiness check:** say what the change assumes about the number of sleeves, corporations and prestige layers. No new global singleton, no hard-coded currency name, no state that is per-sleeve but stored as wallet (or the reverse). Copies scale in closed form from records, never by simulating N copies.
```

**Add to the Definition of done**, item 4: `...; no file imports another context's internals; the context's doc slice and test kit are updated.`

## 2. `.claude/skills/incremental-design/SKILL.md`

**Add a section before "Quick checklist"**:

```
## Review every new mechanic against these references

Before proposing or approving a mechanic, read the reference that matches and answer in the proposal:
1. `references/anti-patterns.md`: which pattern could this be? (fake choice, dead upgrade, flat buff, layer-as-multiplier, chore at the same layer.)
2. `references/economy-and-pacing.md`: price against its neighbours, time to afford, payback, which wall it moves.
3. `references/prestige-and-layers.md`: for any reset or layer, the four questions; gain must grow sub-linearly with run progress.
4. `references/automation-and-attention.md`: which chore it removes, which decision replaces it.
5. Impact spread: list the sibling options and state, with the formula, that none is dead, always-dominant or fixed-outcome.
6. Layer-readiness: what happens with N sleeves and several corporations.
7. Context: which bounded context owns it, and which existing service it reuses.
```

**Add to the Quick checklist**: `- Which existing service does this reuse, so the rule has one code path?`

## 3. `docs/REVEAL_RULES.md`

Add one checklist item (small, optional):

```
5. A tooltip, description or doc line never names content that does not exist yet (for example a "sixth action" when five exist). Describe the effect, not the future system.
```
And in "Skills and skill trees": `- An item and the purchase that unlocks it may share a picture; a skill never may.` (documents the current practice).

## 4. Other small edits to consider
- `.claude/skills/agent-task/SKILL.md`: add "state the context(s) in scope" to step 1.5 and "use `docs/review/step-prompt-template.md` for refactor steps".
- `CLAUDE.md` line "Orientation → Layout, commands and folders: `docs/ARCHITECTURE.md`" becomes `docs/contexts/README.md` after Step 14.
