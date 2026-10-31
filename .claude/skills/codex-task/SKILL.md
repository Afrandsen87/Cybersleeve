---
name: codex-task
description: Variant of agent-task that hands the implementation package to Codex CLI in its own worktree, then verifies and reviews with Claude. Use only when the user asks for Codex, or for a pilot batch.
---

You are the **orchestrator**. This skill is `agent-task` with one change: the implementer is Codex, not a Claude subagent. Follow `.claude/skills/agent-task/SKILL.md` for everything not stated here (sections 1, 4, 5, 6, 7 and Safety apply unchanged).

Task: $ARGUMENTS

## Differences from agent-task

### 0. No `npm install` (replaces agent-task section 1, step 2)

Skip `npm install` in the task worktree. `scripts/run-codex.ps1` links `node_modules` from the primary checkout when `package-lock.json` is unchanged, and installs only when the lockfile differs (a task that changes dependencies). Before removing the worktree at landing time, run `cmd /c rmdir <worktree>\node_modules` to drop the junction; never delete it recursively, or the primary checkout's modules go with it. Your own `npm run check` in the worktree uses the same link.

### 1. Spec (replaces "Decide: do it yourself or fan out")

Codex starts cold, has no conversation and cannot ask questions. Write one spec file in the scratchpad that holds everything it needs:

- Goal and the player-visible result, in a few lines.
- Context(s) in scope and the exact file list to create or edit. Name the existing owner function of each rule it extends.
- Files and behaviour that are out of scope. It must stop and say so instead of improvising.
- Tests to add (by feature, using `src/testing/testConfig.ts`) and docs to update (`docs/contexts/<context>.md`, `docs/ARCHITECTURE.md`, `docs/CONFIG.md`, `DESIGN.md`).
- Paths to read, not copies of the rules: `AGENTS.md` is its rulebook.
- Finish steps: run `npx vitest run <paths>` and `npm run typecheck`, commit small on the current branch with changelog-style subjects using only `git add`, `git commit`, `git status`, `git diff`, `git log` (the only git commands its rules allow; no push, reset, checkout or rebase), never push.
- Report format (under 300 words): files changed, test and typecheck result with failed attempts before green, decisions made, anything needed outside scope.

Do small edits (about 3 files or fewer) yourself; Codex only pays off for a package with real test and doc load. One Codex run per package, one package at a time.

### 2. Build (replaces the Agent tool step)

1. Make sure `AGENTS.md` matches `CLAUDE.md`. If not, ask the user to run `npm run agents:sync`; do not run it yourself.
2. In the task worktree (section 1 of agent-task), run `pwsh -NoProfile -File scripts/run-codex.ps1 -Worktree <task worktree> -Spec <spec file> -Report <report file>`. The script needs `scripts/codex-git.rules` installed at `~/.codex/rules/cybersleeve-git.rules` (UTF-8 without BOM); it fails with a message if missing.
3. Codex commits on the task branch itself (git runs outside its sandbox via those rules); no ff-merge or subagent worktree is needed. Check its commit subjects follow the changelog rule and fix them yourself if not.
4. If the script fails or the report says it needs something outside scope, fix the spec or the scope and rerun; do not patch around it silently.

### 3. Verify and review (replaces "Merge subagent work")

1. Read the report, then `git status --short` and `git diff --stat main...HEAD`. Check that no file is outside the spec's scope and that nothing is left uncommitted.
2. Run `npm run check` yourself. Do not accept Codex's own pass/fail.
3. Run one `reviewer` agent on `git diff main...HEAD` for every Codex package, not only for 3+ packages: Codex must not be the only reviewer of its own work. Fix the findings you agree with, yourself or through a short follow-up Codex spec.
4. Log the run in `docs/AGENT_METRICS.md` (Codex run, spec size, rework rounds, Claude-side token use) so the pilot can be compared with the subagent baseline.

Then continue with agent-task sections 4 to 7 (check, preview, wait for approval, land locally, never push).
