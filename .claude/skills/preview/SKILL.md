---
name: preview
description: Launch the Cybersleeve dev server and screenshot it in headless Chrome, optionally after loading a fixture save (mid-game state). Use for every "Looking at UI" check and whenever the run skill is asked to run or screenshot this app.
---

Screenshot the running game, optionally in a known save state, in one command.

## 1. Serve

From the worktree you are checking: `npm run dev -- --port <port> --strictPort` with `run_in_background` (port derived from the worktree name, as in `agent-task`). Saves live per origin, so each port starts empty.

## 2. Shoot

```
node .claude/skills/preview/shot.mjs <url> <out.png> [saveJsonFile] [evalJs]
```

- `url`: add `?debug` for the test aids, e.g. `http://localhost:5187/?debug`.
- `out.png`: write it into the session scratchpad, then Read the PNG and look at it.
- `saveJsonFile` loads a save first. Fixtures in `src/testing/fixtures/saves/`; use the current save version (`v10-*`):
  - `v10-early-before-resleeve.golden.json`: an early run
  - `v10-after-three-resleeves.golden.json`: mid-game (nodes, heat, inventory, skills)
  - Without a save the page starts fresh.
- `evalJs` runs after load and prints its value as `EVAL ...`: click a tab first (`[...document.querySelectorAll('button')].find(b => /skills/i.test(b.textContent))?.click()`), or read text to check without reading the image (`document.querySelector('.sleeve-widget')?.innerText`).
- `EXC` and `ERR` lines are page exceptions and console errors: report them.

Chrome path: env `CHROME`, else the default Windows install. The script needs Node 22+ (global `fetch` and `WebSocket`) and no npm packages.

## 3. Stop

Stop the dev server (TaskStop) when done, and always before removing its worktree.

## Pitfalls

- Seeding works only from a static file of the same origin (the script uses `/icon.svg`): on any app path the game boots and saves over the seed.
- If the save version changes, add new fixtures and update the list above; old-version saves are not read.
- If `--strictPort` fails, an earlier server still holds the port. It serves the same worktree, so you can shoot against it, but stop it before cleanup.
