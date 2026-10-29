# Context: save

Save format, state lifetimes, serialization and versions.

Code: `src/core/save/` (see `docs/review/file-map.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Architecture (from docs/ARCHITECTURE.md)

### State lifetimes
| Field | Re-sleeve | New game |
|---|---|---|
| `corporation` (the progress of the corporation's actions; it is not the character) | kept | reset |
| `runs` (one record per finished sleeve-run: its own credits per second, action level total and the level of every action), `synths` (each points at a run) and the owned re-sleeve skills (buyables paid in `resleevePoints`, the list `CARRIED_OVER_BUYABLE_CURRENCIES`) | kept | reset |
| `lastLifePurchases` (the action-card purchases the ending life owned, for Reflex Archive; written by `recordLastLife` at every re-sleeve, so it is replaced, not kept) | rewritten | reset |
| `automation` and the automation purchases (Automation core, automation skills), `hackingProficiency`, `iceRating` | only while the matching retention skill is owned (`carryRetention` in `core/resleeve/resleeveCarry.ts`: Daemon Persistence keeps the first, Residual Proficiency a log of the second, Residual Firewall a power of the third) | reset |
| `focusStacks` (Focus slots on an action beyond its first, Overdrive Cap) | reset | reset |
| per action: sleeveXp, runsTowardSleeveXp (the positive list `CARRIED_OVER_ACTION_FIELDS`; nothing else survives; the applied `augments` do not) | kept | reset |
| `peakCredits` and `peakNetwork` (the most held this life; they decide which purchases appear, see `reveal.ts` and `Shop.isRevealed`; `GameEngine` raises them after every slice, sale and start) | reset | reset |
| credits (to `startingCredits`), network, action xp/progress, purchases (all copies), inventory, the Overclock and Focus switches | reset | reset |

### Persistence
`serializeState`/`deserializeState` (versioned JSON, numbers as strings, defensive parsing; only the current format, version 6, is read: the game has not been released, so a save of another version is treated as unreadable and backed up). A scalar the save lacks keeps its fresh-game value, so adding a scalar to `fields.ts` needs no new version; changing the meaning of a field does, with a migration. Behind `SaveGame` on an injected `KeyValueStore` (`localStorage` in the browser). Autosave every 10 s, when the page is hidden and on `pagehide`. **One tab plays:** `main.ts` first calls `claimGame(navigator.locks)` (`app/tabGuard.ts`): the first tab takes a named Web Lock and keeps it until it closes; a later tab is told the game is taken and shows a notice BEFORE it loads the save, so the tab that was playing never stops. Without Web Locks the fallback `watchForOtherTab` (`storage` event) stops the tab that sees another tab write the save (there the tab that saves first wins).

Loading is defensive: the inventory keeps only known items and rarities with whole counts above 0 (a save without one loads empty, so no new version was needed; saving leaves used-up stacks out for the same reason, so save, load, save gives the same text), the Overclock and Focus switches keep only known actions that are switched on, a switch only where the action has bought its unlock (Overclock also needs an Overclock effect), Focus only up to the number of slots (base plus bought) (older saves without them load with both off), negative amounts become 0, non-finite times are dropped, the run counter is reduced modulo `runsPerSleeveXp`, copy counts are capped at a safe integer, and a buyable whose `requires` or `parents` are not owned is discarded. Each successfully loaded save is also copied to `cybersleeve.save.previous` (the last known-good save of a session start). A save that exists but cannot be read (corrupt, or from a newer version) is copied to `cybersleeve.save.unreadable` and the game falls back to the previous known-good save, so the next autosave cannot destroy progress. **Export and import** (`SaveGame.exportText` / `importText`, `app/saveTransfer.ts`): the player copies the save as text and can paste one back; a pasted save is validated, stored, and the page reloads (saving is switched off first so the running game cannot overwrite it). The temporary "Reset save" button calls `GameEngine.newGame()` (a full wipe, including sleeve XP) and `SaveGame.clear()` (removes the main and the previous save); it keeps the unreadable-save backup.

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-25 (by the user, after the second review)*
- Only the current save version is read (nothing has been released). Changing the meaning of a saved field needs a version bump and a migration; adding a scalar does not.

*Group: Decided 2026-10-26 (by the user, after the full review)*
- **Saves:** the last successfully loaded save is kept as `cybersleeve.save.previous` and used when the main save is unreadable; the player can export the save as text and import it (`app/saveTransfer.ts`). Importing stops autosaving and reloads.
