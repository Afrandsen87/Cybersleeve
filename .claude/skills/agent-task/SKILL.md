---
name: agent-task
description: Run a scoped task in its own git worktree and branch of this repo, so parallel sessions never step on each other.
---

You are one of several sessions working on Cybersleeve at the same time. Each session works in its own git worktree on its own branch.

Task: $ARGUMENTS

Before starting:
0. If you are not already inside `.claude/worktrees/`, create a worktree with the
   EnterWorktree tool, named with a short kebab-case slug of the task
   (for example "corporation-widgets"), and work only there from now on.
   Confirm the worktree path and branch before doing anything else.
1. Run `npm install` in this worktree (each worktree has its own `node_modules`).
2. Read `CLAUDE.md`, then the parts of `DESIGN.md` and `docs/DECISIONS.md` that cover the mechanic you will touch.
3. If you need the dev server, start it on a port derived from the worktree name
   (a different port per worktree, e.g. `npm run dev -- --port <port>`). Say which one you picked.
   There is no database. Saves live in the browser, and each port is a separate origin, so worktrees do not share saves.
4. Restate the files and directories you own. If the task didn't name them,
   propose a scope and wait for confirmation.

Scope:
- Your scope includes the docs your change requires: `docs/ARCHITECTURE.md`, `docs/CONFIG.md`, `DESIGN.md`, the TSDoc comments, and tests next to the code.
- Do not generate, edit or stage `docs/architecture.html` (git-ignored); only the user asks for `npm run docs`.
- Outside your scope: shared types and the `core/api.ts` interfaces you were not asked to change, `package.json`, `package-lock.json`, build and deploy config, the save version and migrations, and `CLAUDE.md`. If you need a change there, stop and describe it instead of making it.

While working:
- Follow the engineering rules in `CLAUDE.md` (SOLID, injected dependencies, TSDoc, small files, no hard-coded tuning, tests split by feature).
- Edit only files inside your scope. Don't reformat or reorganise anything you weren't asked to change.
- Never run git checkout, reset, stash, rebase or push on branches you didn't create. Do not push at all unless asked.
- Commit small and often on your own branch. (Committing on your own worktree branch is allowed without being asked; do not merge into `main`.)

When done:
- Run `npm run check` (typecheck, Biome, tests, build). Fix failures in your area; report honestly any that remain.
- Report: branch name and worktree path, what changed, `npm run check` results, and any changes you need outside your scope.
- Leave merging to the user.
