# Subagent metrics

Experiment: does running implementation subagents on a cheaper model (haiku) save tokens versus sonnet once rework is counted? Phase 1 is the baseline (current setup); phase 2 switches implementation to the cheaper model and compares.

**How to log:** when a subagent reports back, add one row. Tokens come from the agent's completion report. `check fails` is how many times `npm run check` failed before it passed (0 = first try). Keep notes to a few words (why it failed, what was reworked).

| Date | Phase | Task (short) | Type | Agent | Model | Tokens | check fails | Reworked by orchestrator? | Notes |
|------|-------|--------------|------|-------|-------|--------|-------------|---------------------------|-------|
| 2026-10-29 | baseline | Digest Space Idle wiki | explore | n/a | haiku | 134348 | n/a | no | Browser reading; used a tab it did not create |
| 2026-10-29 | baseline | Digest CIFI wiki | explore | n/a | haiku | 152561 | n/a | no | Browser reading; reported missing pages honestly |

**Agent:** the `.claude/agents/` type (`scout`, `implementer`, `reviewer`), or `n/a` for rows before the agent types existed or orchestrator-only work.
**Type:** `explore`, `content` (data/uiText/docs), `logic` (engine/save/economy), `tests`, `refactor`.
**Phase:** `baseline` or `cheap`.

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
