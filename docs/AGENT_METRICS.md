# Subagent metrics

Experiment: does running implementation subagents on a cheaper model (haiku) save tokens versus sonnet once rework is counted? Phase 1 is the baseline (current setup); phase 2 switches implementation to the cheaper model and compares.

**How to log:** when a subagent reports back, add one row. Tokens come from the agent's completion report. `check fails` is how many times `npm run check` failed before it passed (0 = first try). Keep notes to a few words (why it failed, what was reworked).

| Date | Phase | Task (short) | Type | Agent | Model | Tokens | check fails | Reworked by orchestrator? | Notes |
|------|-------|--------------|------|-------|-------|--------|-------------|---------------------------|-------|
| 2026-10-29 | baseline | Digest Space Idle wiki | explore | n/a | haiku | 134348 | n/a | no | Browser reading; used a tab it did not create |
| 2026-10-29 | baseline | Digest CIFI wiki | explore | n/a | haiku | 152561 | n/a | no | Browser reading; reported missing pages honestly |

**Agent:** the `.claude/agents/` type (`scout`, `implementer`, `reviewer`), or `n/a` for rows before the agent types existed or orchestrator-only work.
**Type:** `explore`, `content` (data/uiText/docs), `logic` (engine/save/economy), `tests`, `refactor`.
**Phase:** `baseline`, `cheap` or `codex`.
**Codex rows** (`codex-task` skill): Agent `codex`, Model `codex`. Tokens come from Codex's own usage output, so also note the Claude-side tokens for the session (spec, review, rework) in Notes; the saving is the Claude-side difference against baseline rows of the same Type.

## Conclusions

(Fill in after both phases have a handful of rows per type: token difference, rework difference, and why.)
| 2026-10-29 | baseline | Audit: test structure survey | explore | n/a | haiku | 47514 | n/a | no | Good report, specific file lists |
| 2026-10-29 | baseline | Audit: docs-to-context map | explore | n/a | haiku | 39627 | n/a | no | Compact table, usable as is |
| 2026-10-29 | baseline | Audit: heat/crit/drop parallel mechanics | explore | n/a | haiku | 89055 | n/a | no | 13 findings, to be spot-verified |
| 2026-10-29 | baseline | Audit: layer-readiness of state/resleeve | explore | n/a | haiku | 125668 | n/a | no | Detailed 14 blockers with file:line; agent skipped stats/shop |
| 2026-10-29 | baseline | Audit: effects/speed/rewards duplication | explore | n/a | haiku | 172597 | n/a | no | 14 findings + file split proposals; strong |
| 2026-10-29 | baseline | Audit: buyable/action option data | explore | n/a | haiku | 91631 | n/a | no | Rich table; 2 flags to verify (Study methods, Cascade) |
| 2026-10-29 | baseline | Audit: skills/items/resleeve option data | explore | n/a | haiku | 115512 | n/a | no | Good tables; claims dominance none, dup icons; spot-check pending |
| 2026-10-29 | baseline | S0 core move (script, no subagents) | refactor | n/a | n/a | 0 | 1 (format only) | no | Orchestrator only; biome format fixes after path-length change |
| 2026-10-29 | baseline | S2 classify DECISIONS entries by context | explore | n/a | haiku | 61009 | n/a | no | JSON map of 82 entries, judgement calls reported |
| 2026-10-29 | baseline | S3 registry split + ownsKind (script + edits, no subagents) | refactor | n/a | n/a | 0 | 0 | no | Orchestrator only; 1 failed script run (regex) fixed before check |
| 2026-10-30 | baseline | Survey: sleeve/resleeve/synth for CR batch | explore | scout | haiku | 127113 | n/a | no | Caught existing 100e9 Unlock resleeving buyable |
| 2026-10-30 | baseline | Survey: actions/heat/augments/sort for CR batch | explore | scout | haiku | 139650 | n/a | no | Flagged Obfuscation going dead; sort claim verified |
| 2026-10-30 | baseline | Survey: skill trees/inventory reveal for CR batch | explore | scout | haiku | 110128 | n/a | no | Found zero-day shard bypass of ItemDrops |
| 2026-10-30 | baseline | CR batch pkg 1: tuning, autorun, augments, peak cps | logic | implementer | sonnet | 177815 | 4 (test-level, intermediate) | no | Moved autorun-off to activateBuyable; golden files updated |
| 2026-10-30 | baseline | CR batch pkg 2: Sleeve levels split, tree reveal (+1 fix round) | logic | implementer | sonnet | 247231 | 1 typecheck + 1 test round | yes (sent back: heat skill mask, button gap) | Needed v8 migration; fix round cheap |
| 2026-10-30 | baseline | CR batch pkg 3: reveals, seen items, widgets, XP tips | logic | implementer | sonnet | 249820 | ~5 test rounds | yes (doc merge conflicts) | No browser; UI checked by orchestrator |
| 2026-10-30 | baseline | CR batch review 1 | explore | reviewer | opus | 149108 | n/a | no | Found seen-items backfill bug, dup auto-run owner |
| 2026-10-30 | baseline | CR batch review-1 fixes | logic | implementer | sonnet | 163389 | 1 (format) | no | Worked directly in task worktree |
| 2026-10-30 | baseline | CR2 A first try (blocked by worktree pin) | logic | implementer | sonnet | 36263 | n/a | n/a | Pinned to orchestrator worktree; wasted spawn |
| 2026-10-30 | baseline | CR2 C first try (blocked by worktree pin) | logic | implementer | sonnet | 36758 | n/a | n/a | Same pin problem |
| 2026-10-30 | baseline | CR2 B: synth curve, reflex memory, costs line | logic | implementer | sonnet | 152191 | 1 (CRLF) + few test | no | Bypassed pin via PowerShell into cr2-b |
| 2026-10-30 | baseline | CR2 A retry: rarity, Kompromat price, Forensic hardening | logic | implementer | sonnet | 219313 | 1 (format) + 2 test | no | Duplicate commit subjects |
| 2026-10-30 | baseline | CR2 C retry: Auto Burn lane (10 skills) | logic | implementer | sonnet | 289285 | 1 (format) + ~25 test fixes | yes (merge: dup setOn/setEnabled writer) | Largest package |
| 2026-10-30 | baseline | CR2 review | explore | reviewer | opus | 160021 | n/a | no | 6 real Auto Burn bugs |
| 2026-10-30 | baseline | CR2 review fixes | logic | implementer | sonnet | 192925 | ~5 test rounds + 1 format | no | Added automation->heat boundary edge |
| 2026-10-31 | codex | Sleeve skills C: save v10 refund + synth safety | logic | codex | codex | 91401 | 1 pass after ~4 test/typecheck rounds | no | Committed itself via the git rules; found no extra audit fixes |
| 2026-10-31 | codex | Sleeve skills A: Sleeve Up!, requiresSleeveSkills, ??? rule, rename | logic | codex | codex | 98461 | ~3 test rounds + format | no (orchestrator committed) | Commit blocked: index.lock Permission denied despite the rules; spec was cold-start complete |
| 2026-10-31 | codex | Sleeve skills B: joined tree layout | logic | codex | codex | 48753 | 1 format round | no | Committed itself; screenshots looked right first time. Claude-side cost: 3 specs + reading reports |
| 2026-10-31 | codex | Main screen A-1: view logic (HUD, groups, heat strip, tax note) | logic | codex | codex | 60155 | quota ran out midway; orchestrator finished it (types, wiring, 2 missing test files, 11 test updates) | yes (finished by Opus) | Spec 10 KB; left ≥ written as =; formatSignificant rounding needed a rewrite |
| 2026-10-31 | codex-fallback | Main screen A-2: CSS split, chrome, HUD/tab/gauge widgets | ui | implementer | sonnet | 150978 | 1 test + 1 format | no | Fallback after the Codex quota ran out; the move commit was briefly broken (dangling @media), fixed in the next commit |
