# Plan: Auto Burn panel redesign

Approved mockup: [autoburn.html](autoburn.html). Contexts: **automation** (one new read-only status owner) and **ui** (view, widget, text, styles), plus **content** (skill icons). No game rule changes, no save change, no tuning change.

Build with `/agent-task` in one worktree, as two packages in order:

1. **Core status owner** (small; the orchestrator does it).
2. **UI package** (large; delegated), built on the interface from package 1.

## Package 1: core status owner (context: automation)

The status line and the glowing rows must not re-derive Auto Burn's conditions in the UI (one mechanic, one code path). Add one owner and make `AutoBurn.step` use it.

- New `src/core/automation/autoBurnStatus.ts` with pure functions:
  - `shouldSwitchOff(rules, s)`: toggle on, available leads <= 0, heat > lower. **Moved** out of `AutoBurn.switchOff`.
  - `shouldSwitchOn(rules, s)`: available > 0, heat < lower. **Moved** out of `AutoBurn.switchOn`.
  - `autoBurnStatus(rules, s): AutoBurnStatus`, where `s = { heat, toggleOn, held, usable }`:
    - `activity`, first match wins:
      - `standby`: toggle off
      - `idle`: no heat to cool (`heatNeedsCooling`)
      - `blocked`: leads not usable, because an Overclock holds heat
      - `dry`: available <= 0
      - `holding`: hold on and heat <= `heatHoldTarget(lower)`
      - `burning`: otherwise
    - `firing`:
      - `trigger`: `rules.upper` and heat >= upperAt
      - `throttle`: `rules.hold` and activity is `burning`
      - `failsafe`: `shouldSwitchOff` and (offOverclocks or offActions)
      - `restart`: `shouldSwitchOn` and (onActions or onOverclocks)
    - Also returns `held`, `available` (held minus reserve, 0 when not usable), `heat` and `toggleOn`, so the UI never subtracts the reserve itself.
- `AutoBurn`: the private `available()`, `switchOff` and `switchOn` call these helpers, with no change in behaviour. Add `status(): AutoBurnStatus` to `AutoBurnControls`.
- Export the types through the core barrel.
- Tests: new `autoBurnStatus.test.ts`, using `testing/autoBurnKit.ts`, extended if needed. Cover:
  - every activity and every firing flag
  - reserve > held
  - heat 0, fractional heat below 1, huge heat, NaN heat (clamped, no throw)
  - the existing `autoBurn*.test.ts` and `batching.test.ts` still pass, which shows the refactor changes nothing
- No new state, so `invariants.ts` and `properties.test.ts` stay unchanged.

## Package 2: UI (contexts: ui, content)

### Text (`src/ui/uiText.ts`, `uiTextTypes.ts`)

- Replace `automation.autoBurn`: drop `hint`, `switches`, `holdAt` and `upperAt`. Add:
  - names: **Floor**, **Redline**, **Reserve**
  - row tags TRIGGER, THROTTLE, FAILSAFE and RESTART, with condition and action templates as in the mockup (`WHEN heat ≥ {redline} → switch the Burn toggle on`, ...)
  - one word and one reason per activity (STANDBY, IDLE, BLOCKED, DRY, HOLDING, BURNING)
  - ON and OFF
  - kind labels AUTO-RUN and OVERCLOCK
  - an empty-list line ("No heat-making Auto-runs owned yet")
  - an Inventory-toggle label
- New feature description: "A daemon that burns leads to keep your heat in check, and stops or restarts heat-making work."
- Keep the skill names. Change the `automationLines.ts` skill descriptions to use the Floor and Redline wording.

### View model (pure, tested without DOM)

- `panelViewTypes.ts`: replace `AutomationView.autoBurn` with:
  - `status`: visible, activity, word, reason, heat text, leads text, toggle text
  - `strip`: visible, zones, floor and redline notches (value, editable), heat marker
  - `rows`: one per rule, each with visible, tag, skill-name caption, condition, action, firing, an optional switch, and chips or sub-rows
  - `reserve`
- New `src/ui/view/autoBurnStrip.ts`: `heatStripLayout(floor, redline, heat)` returns percent positions for the zones, the notches and the marker.
  - Heat has no cap, so the strip spans `0 .. max(redline × 1.5, floor + 1)`. Heat beyond the end pins the marker to the right edge and sets `overflow: true`; the label still shows the real value.
  - The 1.5 is a named display constant in the view, not tuning.
  - Tests cover zero, floor = redline - 1, huge heat, NaN and Infinity.
- `automationView.ts`: build the rows from `burn.rules()`, `burn.stepOwned()` and `burn.status()`, using only owner values. Format heat with the same formatter the Sleeve widget uses.
- Reveal: one item per owned skill, nothing earlier.
  - status line: Burn Toggle
  - strip with the Floor notch and THROTTLE row: Hold Down
  - Redline notch and TRIGGER row: Redline Trigger
  - FAILSAFE row with the Overclocks chip: Cool Overclocks
  - Auto-runs chip: Cool Auto-runs
  - RESTART Auto-run sub-row: Resume Auto-runs
  - RESTART Overclock sub-row: Resume Overclocks
  - editable notches: Tune Thresholds (before it, plain numbers)
  - Reserve field in the status line: Lead Reserve
- Follow the checklist in `docs/REVEAL_RULES.md`.
- `autoBurnChecklist.ts`: **fix the bug** where Auto-run chips are labelled with the Auto-run buyable's name ("Auto-run"). Label them with the action's name; the kind label says AUTO-RUN.
- Tests: rework `autoBurnUi.test.ts` and `automationTab.test.ts` to cover:
  - reveal order, step by step
  - two Auto-runs get distinct action names
  - the firing flag passes through from the status
  - the Floor and Redline values appear in the condition text
  - fixed numbers before Tune Thresholds, editable after it

### Widget (DOM)

- New `src/ui/widgets/autoBurnPanel.ts`: status line, heat strip and protocol rows. `automationWidget.ts` mounts it for the Auto Burn feature and keeps autosale and dispersal. That also shrinks `automationWidget.ts`, which is 8.7 KB now.
- Build the elements once. `render` only flips `hidden`, `.on`, `.firing` and changed text or positions.
  - The chip lists rebuild only when their ids change.
  - Nothing rebuilds every frame, and nothing scales with the number of buyables.
  - Inputs reuse `syncInput`, so typing is not overwritten.
- LED pills call `burn.setSwitch`. FAILSAFE chips call `setSwitch` for `offOverclocks` and `offActions`. RESTART chips call `setResumeAutoRun` and `setResumeOverclock`.
- Chips use the existing `auto-run` and `overclock` entity icons through `setIcon`.
- Delete `widgets/resumeChecklist.ts` and its styles if nothing else uses them.

### Styles

- New `src/ui/autoBurn.css`, imported in `main.ts` next to `style.css`, which is already 28 KB. Port the mockup's classes onto the existing tokens (`--branch-autoBurn`, `--cyan`, `--line`, ...); add `--red` and `--orange` tokens to `:root` if missing.
- Remove the Auto Burn-only rules (`.automation-hint`, `.automation-checklist`) from `style.css`. `.automation-switch` stays because autosale uses it.

### Skill icons (content)

- New `src/content/autoBurnSkillIcons.ts`: nine 16×16 grids, each an 11×11 base plus a 7×7 badge as in the mockup, drawn properly:
  - Burn Toggle: flame
  - Hold Down: flame + down arrow
  - Redline Trigger: gauge + flame
  - Cool Overclocks: chip + snowflake
  - Cool Auto-runs: loop + snowflake
  - Resume Auto-runs: loop + play
  - Resume Overclocks: chip + play
  - Tune Thresholds: sliders
  - Lead Reserve: lock + flame
- Use only `ICON_PALETTE` colours.
- `automationSkillIcons.ts` keeps the progress-bar art for the two placeholder lanes and spreads in the Auto Burn grids.
- `skillIcons.test.ts` and `icons.test.ts` must still pass, including the unique-icon check.
- The lane stays as today: whole lane shown, unmasked. The dimmed later nodes were only in the mockup.

### Docs (same change)

- `DESIGN.md` §8b and `docs/contexts/automation.md`: new switch names (Floor, Redline, Reserve), the panel layout and the status activities.
- `docs/ARCHITECTURE.md` and `docs/contexts/ui.md`: the new files.
- `docs/DECISIONS.md`: one entry covering the panel redesign, the Floor/Redline naming, `autoBurnStatus` as the owner and the strip scale rule.
- `docs/CONFIG.md`: no change.
- Delete `docs/mockups/` (or keep it, if the user wants).

## Checks

- `npm run check` passes. Every new file is under 10 KB (source) or 12 KB (tests), with TSDoc and `Called by:` / `Calls:` lines.
- Preview: screenshot the Automation tab with the Auto Burn lane fully owned and at an early step. If loading a test state fails twice, stop and report.
- Commit subject (player-facing): **Redesign the Auto Burn panel**.
- Impact check: presentation only; no option is added or removed.
- Layer-readiness check: the status reads the current sleeve (`state.sleeve`), the same assumption as today. No new singletons, no currency names.

## Open choices (defaults chosen; say if you want otherwise)

1. **Strip scale:** 0 to 1.5 × Redline, with the marker pinned at the edge beyond that.
2. **BLOCKED activity:** an extra status the mockup didn't show. Leads can't be used while an Overclock holds heat, and the status line says so.
3. **Empty restart list:** a muted line instead of hiding the sub-row, so the switch you bought stays visible.
