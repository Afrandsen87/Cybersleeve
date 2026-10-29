# Design findings (Phase 1 audit, 2026-10-29)

Lens: `incremental-design` skill and its references. Balance numbers are not tuned here; only structure.
Tags: **[V]** verified by me in code/data, **[S]** suspected (from a survey, not traced). **Kind**: GAMEPLAY (changes play), SAVE (needs version bump + migration), DOC (text only), STRUCT (no gameplay change).

Ordered by severity.

## High

### D1. The engine holds exactly one live sleeve and a flat wallet+sleeve state [V]
- Where: `engine.ts` (one `GameState`, `advance()` steps one), `api.ts` (no sleeve id on any query), `stateTypes.ts:55-115` (credits sits beside heat, network, iceRating, actions, purchased, inventory), `serialization.ts:44-72`.
- Why: DESIGN 13.7 plans several sleeves and organisations. Today wallet (credits, items, points) and sleeve (heat, network, ICE, action levels) are one record, so "a second sleeve" has nowhere to live.
- Good news [V]: synthetic sleeves are *records + closed form* (`synthSleeves.ts`: a frozen cps scalar per run). Keep that model for the derivative factor: N copies are a count times a recorded rate, never N simulations. That already fits "closed-form, never iterate".
- Fix: split `GameState` into `Wallet` (shared) and `SleeveState` (one live sleeve), keep a single sleeve for now, key queries by an optional sleeve id. STRUCT + SAVE (new shape, version bump, migration).

### D2. Synthetic sleeves and the corporation cannot express later layers [V]
- Where: `synthSleeves.ts:121-122` (income measured against the *live* sleeve), `corporation.ts:84` (`state.synths.length`, no assignment), `corporationTypes.ts:66-71` and `serialization.ts:98` (one corporation, one stocks number); DESIGN 11b "Owned corporations" has no state field.
- Why: organisations that sleeve ever more copies need per-corporation state and an assignment rule (which sleeves work for which corporation). Today every synth boosts the one corporation.
- Fix: corporations keyed by id (a map with one entry now); an explicit design decision on assignment (ask user). STRUCT + SAVE; the assignment rule is GAMEPLAY and is deferred until the user decides.

### D3. Re-sleeve gain does not scale with progress, so "when to reset" has no tension [S]
- Where: DESIGN 11 "Re-sleeve points: one per re-sleeve" (`resleever.ts:23`, points = runs x `pointsPerResleeve`).
- Why: `prestige-and-layers.md` says the gain should grow sub-linearly with how far the run went. Here resetting immediately yields the same point as resetting at 1e100 credits; the only reason to wait is the sleeve XP and the carried-over bits. The tree is 38 re-sleeves long by design, which makes the best play "reset as often as affordable".
- Fix (proposal): make points depend on the run (for example log10 of the run's best ICE Rating or credits per second, which the run record already stores). GAMEPLAY + SAVE only if stored points change meaning (points are derived from `runs.length`, so a derived formula needs a migration of old runs). **Ask the user** before touching.

## Medium

### D4. Skill points look plentiful, so the skill trees may be checklists, not choices [S]
- Where: 28 point-skills at 1 point each (Cybernetics 10, Anonymity 8, Leverage 10); points are +1 per decade of total action level (DESIGN 8).
- Why: if points outrun nodes within one or two lives, the player buys everything and "which first" is the only decision. Many chains are single-file (DF->SA->LE, BC->TI->DA->DC, SC->ST, PP->BO), so after each branch point there is no alternative.
- Fix: measure points vs nodes over a typical life before deciding; if it holds, make one tree choose-one (a cap on points spent per tree, or mutually exclusive siblings). GAMEPLAY. Report only until then.

### D5. Two buyables with the same effect and growth: ICE Rating boost vs Cascade failure [V]
- Where: `buyables/sleeve.ts:37` (x2 ICE Rating, 150,000, x100/copy) and `buyables/killServers.ts:60` (x2 ICE paid per run, 1e10, x100/copy).
- Verified: not dominated. Copy n of ICE boost costs 1.5e5 x 100^n, so Cascade copy 0 (1e10) is cheaper than ICE boost copy 3, so purchases interleave. But the pair is "buy whichever is cheaper next", with no decision. A survey claimed strict dominance; that is wrong.
- Fix: give Cascade a different lever (for example the node-share side of Kill servers) or fold the two into one ladder. GAMEPLAY; keep ids to avoid a migration, or SAVE if removed.

### D6. Dead or placeholder options [V]
- Study methods (1e15 cr): -0.01% sleeve XP per Practice Hacking sleeve level, capped 25% at level 2500. Sleeve level costs 10 x 2^L XP and 1 XP needs 10-100 runs, so a reachable level (around 20-30) cuts about 0.2-0.3%. Effectively dead at every stage unless sleeve XP income changes by orders of magnitude. GAMEPLAY (raise `perLevel` or drop the cap logic; tuning is out of scope, so flag).
- No effect yet: Synthetic Procurement (empty widget), Corporate access upgrade (only action needs rank 1), Stock acquisition (stocks do nothing), Clearance Escalation (access level 6 but only 5 actions exist). Intentional stubs for planned content; do not buy-gate the player into them without text saying so. DOC.
- 27 of 30 automation nodes are placeholders (DESIGN 8b). Fine if hidden until built; check `REVEAL_RULES` (see D9).

### D7. Corporation layer adds chores, not automation [V]
- Where: DESIGN 11b: "a run is started by clicking the card (there is no auto-run yet)".
- Why: `automation-and-attention.md`: do not add a chore at the layer just automated. The character layer has Auto-run per action. Fix: an auto-run purchase for corporation actions before the layer is widened. GAMEPLAY (additive, no save change if stored as a buyable).

### D8. The corporation has no currency and no decision of its own [V]
- Where: DESIGN 11b; stocks "do nothing yet"; owned corporations "mechanics come later".
- Why: `prestige-and-layers.md` question list: a new layer needs its own currency and first purchase. Right now it only spends credits. Fix: design before building more (open item 13.6). DOC/GAMEPLAY, no code now.

## Low

### D9. Reveal-rule gaps [S/V]
- Clearance Escalation text and DESIGN mention a "sixth action" while only five exist [V] (text could leak a future system; check its tip against `REVEAL_RULES` item 3). DOC.
- Back Channel is gated on Push malware Overclock in code but not in DESIGN 8 [S from survey]. DOC.
- Item and its unlocking purchase share a picture (Kompromat/Kompromat harvest, flame, zero-day, admin-key, chip) [S]. `REVEAL_RULES` only demands unique icons for skills, so this is allowed; note only.

### D10. Near-duplicate skills in the trees [S]
- DF/SA/LE (same +0.1 rarity weight per rarity), EK/DO (same payout-from-items), Hive Interface vs Synthetic Workers (same formula on two targets). Each names its target so no rule is broken, but they are one effect kind with different constants; they are fine as data if the code path is shared (see findings-code P7).

### D11. Options with no player agency [S]
- Skill shard (random action), Insider backstabbing (random file), Reflex Archive (rebuys everything automatically). Acceptable randomness/automation; only note that Skill shard timing is the sole input. No change proposed.

### D12. Flat unconditional buffs [S]
- 10 of the 28 point-skills (Overclocked Cortex, Bandwidth Leech, Muscle Memory, Quick Study, Parallel Threads, Neural Accelerant and Overdrive Spike in Cybernetics; the root and Blackout in Anonymity; as listed by the survey). They name what they scale, so the "no global multiplier" rule holds, but there is no trade-off. Tie to D4; no separate fix.

## Not problems (checked)
- Layer shape: the Corporation-as-prestige plan (stop re-sleeving when the tree is near done) fits `prestige-and-layers.md` once D8 is answered.
- Unlimited x2 / x100 ladders: a log-scale ladder is the genre norm; not flagged.
