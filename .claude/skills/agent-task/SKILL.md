---
name: agent-task
description: Run a task end to end in its own git worktree and branch. For complicated tasks, split it across parallel subagents (each in its own worktree), then merge and verify. Serves a preview from the worktree and lands on main locally only after the user approves.
---

You are the **orchestrator** for a Cybersleeve task. You own the whole git lifecycle: worktrees, subagents, merging, verification and landing on `main`. The user must not have to touch git.

Task: $ARGUMENTS

## 1. Set up (always)

1. If you are not already inside `.claude/worktrees/`, create a worktree with the EnterWorktree tool, named with a short kebab-case slug of the task (for example "corporation-widgets"). This is the **task branch**. Confirm its path and branch.
2. Run `npm install` in it (each worktree has its own `node_modules`).
3. Read `CLAUDE.md`, then the parts of `DESIGN.md` and `docs/DECISIONS.md` that cover the mechanic you will touch.
4. If you need the dev server, use a port derived from the worktree name (`npm run dev -- --port <port>`) and say which. Saves live in the browser per origin, so worktrees do not share saves.
5. State the files and directories in scope. If the task did not name them and they are unclear, propose a scope and ask once.

## 2. Decide: do it yourself or fan out

Do it **yourself** in the task worktree when the task is small, touches a few files, or its parts depend tightly on each other.

**Fan out to subagents** when the task is complicated: it splits into 2 or more work packages that can be built independently (for example content for several actions, separate UI widgets, engine change plus its tests plus docs). Rules for the split:

- Packages must have **disjoint file scopes**. Shared files (types, `core/api.ts`, barrels, `docs/*`, `DESIGN.md`) go to exactly one package, or you edit them yourself first or last.
- If packages depend on a shared interface or type, make that change yourself on the task branch and commit it **before** spawning, so every subagent starts from it.
- Keep it to about 2 to 5 subagents. More does not help; merging cost grows.
- Write each subagent a self-contained prompt: the goal, its exact file scope, what is out of scope, the rules from `CLAUDE.md` that apply (SOLID, TSDoc, small files, no hard-coded tuning, tests split by feature), and the exact report format below. Do not assume it has seen this conversation.

Spawn them in one message, in parallel, with the Agent tool and `isolation: "worktree"`. Each subagent must:

- Work only inside its scope; if it needs something outside, stop and describe it instead.
- Commit small and often on its own worktree branch. Commit subjects follow the changelog rule in `CLAUDE.md`: one short player-facing line, or `chore:`/`docs:`/`test:`/`refactor:` for anything players do not see.
- Run the tests relevant to its area (`npx vitest run <path>`) and typecheck before finishing. It need not run the full `npm run check`; you do that after merging.
- Never push, never touch `main`, never touch other branches.
- Report: branch name, worktree path, what changed, test results, and anything it needs outside its scope.

## 3. Merge subagent work (orchestrator only)

When subagents finish, from the task worktree:

1. Review each report. Skim each branch diff (`git diff <task-branch>...<branch>`) for scope violations (files outside its scope) and obvious defects.
2. Merge each subagent branch into the task branch one at a time with `git merge --no-ff <branch>`.
3. Resolve conflicts yourself. They should be rare given disjoint scopes; if one is a real design disagreement rather than mechanical, stop and ask the user.
4. If a package is wrong or incomplete, fix it yourself or send the subagent back with SendMessage. Do not merge broken work.
5. Integrate cross-package pieces (barrels, docs, wiring) yourself, with tests.

## 4. Verify

In the task worktree run `npm run check` (typecheck, Biome, tests, build). Fix failures. Do not proceed to landing while it fails; report honestly if you cannot fix it.

Scope reminders: your change includes its docs (`docs/ARCHITECTURE.md`, `docs/CONFIG.md`, `DESIGN.md`, TSDoc, tests next to the code). Do not generate, edit or stage `docs/architecture.html`; only run `npm run docs` if the user asks. Outside scope without asking: `package.json`, `package-lock.json`, build and deploy config, the save version and migrations, and `CLAUDE.md`.

## 5. Preview and wait for approval (mandatory)

Never merge into `main` without the user's explicit approval of this task.

1. In the task worktree, start the dev server in the background on the port derived from the worktree name (`npm run dev -- --port <port>`, `run_in_background`). Confirm it responds.
2. Tell the user the URL (`http://localhost:<port>`), the task branch and worktree path, a short list of what to try, and the `npm run check` result. Then **stop and wait**. Do not land, clean up or start unrelated work.
3. If the user asks for changes, make them in the task worktree (re-spawn or message subagents if useful), re-run `npm run check`, and ask again. The dev server hot-reloads, so keep it running.
4. If the user rejects the task, stop the server and leave the worktree and branch in place; do not delete anything unless asked.
5. Only an explicit approval ("approved", "merge it", "looks good, land it") moves on to section 6.

## 6. Land on main (local only)

Only after approval and a passing `npm run check`:

1. In the primary checkout (`C:\Code\CyberSleeve`), confirm `main` is checked out and has no uncommitted changes to tracked files (`git status`). If it is dirty, or `main` moved so the merge is not clean, first merge `main` into the task branch, re-run `npm run check`, then retry. If that still cannot be done cleanly, stop and report; never stash, reset or discard the user's changes.
2. Merge with `git merge --no-ff <task-branch>` from the primary checkout. (Merge commits are skipped by the changelog, so the real commit subjects carry through.)
3. **Never push.** Pushing to `main` triggers the deploy; only the user does that.
4. Stop the preview dev server, then clean up what you created: remove the subagent worktrees and the task worktree (`git worktree remove`), and delete their merged branches (`git branch -d`). Never delete a branch you did not create or that is not fully merged.

## 7. Report

Before approval (end of section 5): what was built, which packages ran in parallel, `npm run check` result, the preview URL, and that nothing is merged yet.
After landing: that it is merged into local `main` (commit hash) and **not pushed**, and anything deferred or needing the user's decision.

## Safety

- Never run git checkout, reset, stash, rebase or force operations on branches you did not create.
- Never push. Never merge into `main` before `npm run check` passes and the user has approved after previewing.
- If anything is ambiguous or destructive, stop and ask instead of guessing.
