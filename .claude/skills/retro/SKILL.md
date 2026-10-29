---
name: retro
description: Review the current session for lessons and propose where to record them (CLAUDE.md, code comment, DECISIONS.md or memory). Runs only when the user types /retro.
disable-model-invocation: true
---

Run a retrospective on this session. Write nothing until the user approves.

1. Review what happened: tasks done, retries, wrong turns, files read that turned out not to matter, subagents spawned and the model each used, anything the user corrected.
2. Ask yourself: "How could this have been done faster with fewer tokens?" Name the 3 to 5 biggest costs or mistakes, each with the evidence from this session.
3. For each, state the lesson as a **positive instruction** (what to do, e.g. "batch the file reads", "set model haiku for survey subagents"), never only as a prohibition.
4. Say where each lesson belongs and why:
   - a standing rule for every session -> `CLAUDE.md` (keep it short; check for something to delete in the same edit)
   - a rule about one piece of code -> a comment next to that code
   - a design decision and its reason -> `docs/DECISIONS.md`
   - a preference about how the user likes to work -> memory
   - a procedure -> an edit to the relevant skill
5. Also report overhead worth trimming: anything in `CLAUDE.md` that was stale or never used this session, and context-heavy things (suggest the user run `/context`).
6. Present the proposals as a numbered list and ask which to apply. Apply only the chosen ones. If `CLAUDE.md` changed, ask whether to regenerate `AGENTS.md` (`npm run agents:sync`).
