# Vision: Big numbers and offline progress

Part of the long-term design target; index and status markers in `docs/VISION.md`.

## Numbers beyond 1e308

**Designer clarification: 1e308 is NOT a hard cap for most things, possibly for anything.** Several numbers will go far past it and that must work, with proper big-number maths. Research is needed to pick the best approach (e.g. a larger-exponent big-number representation, layered/logarithmic numbers). **Acceptable displays:** 1e100000, and if needed 1e2e3240 (tetrational-style). Designer's timing: build this **when progress actually reaches that scale**, expected around the **city level of the corporation phase**; not needed now. The final count of planets might be what ends the game.
- **Conflict with current code and docs:** `DESIGN.md` section 9 and `CLAUDE.md` say Infinity = 1e308 and clamp all amounts at it. That is the *current* state and a stop-gap; the target is that this limit is lifted (per amount, as needed). Any work on number handling must treat the 1e308 clamp as temporary. Decision pending: see `docs/DECISIONS.md` once made.

## Offline progress

No full offline simulation. Instead a **boost-time credit**: time spent away is banked as minutes of boost, spent later as faster game speed. Reuse the existing debug "Speed x10" mechanism for it. Details (earn rate, cap, UI) OPEN.
