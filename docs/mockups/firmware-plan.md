# Plan: Firmware page redesign and the Skills → Firmware rename

Approved mockup: [skills.html](skills.html), with the **side-by-side cards** layout (idea 8 **on**). The mockup already uses the new names. Two parts land together in one batch:

1. **Rename.** Players see **Firmware** instead of Skills and **Sleeve Firmware** instead of Sleeve skills, everywhere in the game.
2. **Redesign** of the Firmware tab: ideas 1–9 from the mockup.

Contexts: **ui** (views, widgets, text, styles) and **content** (descriptions and names that say "skill"). There is one small decision record. No game rules, saves or tuning change.

Some existing firmware names will read oddly as firmware (e.g. "Muscle Memory", "Silver Tongue"). That's accepted: the user will rework names later, so **don't rename individual firmware now**.

Related plans: [mainscreen-plan.md](mainscreen-plan.md) introduces the colour tokens, panel chrome, terminal tabs and top bar. This plan assumes its Batch A has landed. If it hasn't, build the few shared pieces this page needs (tokens, `.panel` chrome, `.led`, `.ph`) exactly as that plan specifies, so Batch A finds them already done. Whichever plan lands second writes its new text with the Firmware names.

## Part 1: rename Skills → Firmware

### Decision: player-facing only (record it in `docs/DECISIONS.md`)

- **What players see changes:** all text in `src/ui/uiText*.ts` and `tipText*.ts`, content names and descriptions, and the docs that describe the game to the player (`DESIGN.md`).
- **Code identifiers, save fields and saved keys stay as they are:** `skillPoints`, `resleevePoints`, `SkillQueries`, `skillTree.ts`, `SKILL_*` ids, `TAB_IDS` `'skills'`, reveal keys `skill:<id>`, `requiresSleeveSkills`, and so on. Renaming them would mean a save version bump and migration for no player gain. `CLAUDE.md` already says never to hard-code display names in logic.
- **Docs for developers** keep "skill" as the code term. Add one glossary line in two places: `DESIGN.md`'s intro and `CLAUDE.md` "Game rules". The line reads: *"Players see skills as **Firmware** and sleeve skills as **Sleeve Firmware**; code, saves and developer docs say skill."* That changes `CLAUDE.md`, so ask the user afterwards whether to run `npm run agents:sync`.

### Wording rules

- "Firmware" is a mass noun: never write "firmwares". One is "a firmware" or "this firmware"; several are "N firmware". Owning one is **installed**; buying one is **install**.
- The tab is **FIRMWARE**; the sleeve panel is **SLEEVE FIRMWARE**.
- Points are **firmware points** and **sleeve firmware points**.
- Branch names (Cybernetics, Anonymity, …) stay.

### What to change (inventory from a grep on this commit; re-grep before editing)

- `src/ui/uiText.ts`:
  - `titles.skills` and `titles.resleeveSkills`
  - `tabs.skills(points)`: the label becomes `FIRMWARE`; the count moves to the badge if the main-screen plan has landed, otherwise `Firmware (n)`
  - `skills.points` and `skills.resleevePoints`
  - `skills.note` (it becomes the legend hint, see idea 5)
  - currency words `skillPoints` and `resleevePoints` ("firmware points", "sleeve firmware points")
  - the re-sleeve confirm text ("gain a sleeve firmware point")
- `src/ui/tipTextSleeve.ts`: the interface-speed tip's `Skills = …` factor line becomes `Firmware = …`.
- `src/content/buyables/resleeveBranches/sleeveUp.ts` and `retention.ts`: descriptions that say "sleeve skills" or "its skills". Also grep every content description for "skill".
- **Automation lanes:** their entries are skills in code, bought with automation points. In player text, call them **firmware** too (e.g. the Auto Burn description "…as its firmware allows"). Grep `src/ui/uiText.ts` `automation` and `automationLines.ts`.
- **Leave alone:**
  - **Skill shard** (item) and **Skill transfer** (Practice Hacking buyable). Here "skill" means an action's competence (levels and XP), not the tree. The user decides these later. List them in the report.
  - Old entries in `content/changelog.ts`: they are history. The rename gets its own changelog line via the commit subject.
- **Tests:** update tests that assert these strings (grep the tests for `Skill`). Add a test that sweeps all player-visible text: `uiText` values plus content names and descriptions. It fails when the word "skill" appears, except in the allow-list (Skill shard, Skill transfer). This stops the old word coming back.
- **Docs:** `DESIGN.md` player-facing names, `docs/contexts/skills.md` (the glossary line) and `docs/REVEAL_RULES.md` (one note that "skill" there is shown as Firmware).

## Part 2: Firmware tab redesign (ideas 1–9)

Current code: `ui/view/skillTree.ts` (9.2 KB), `skillTreeJoin.ts`, `skillTreeTypes.ts`, `branchMask.ts`, `ui/view/panelViews.ts` (the tab and its two groups), `ui/widgets/skillTree.ts` (7.1 KB), `ui/widgets/skillsPanel.ts`.

The tree widget is shared with the Automation tab's lanes. The new node states (idea 3) and the install animation (idea 9) apply there too, which keeps them consistent. The inspector, branch headers and legend are Firmware-tab only.

### Idea 3: node states (view first, pure and tested)

`SkillNodeView` gains `state: 'installed' | 'affordable' | 'available' | 'locked' | 'encrypted'`. It is computed once in the view from what it already has, and the widget only maps state to a CSS class:

- `installed`: owned
- `encrypted`: `masked`, the existing reveal masking (`branchMask.ts`, `docs/REVEAL_RULES.md`)
- `locked`: `locked`, a parent not owned
- `affordable`: purchasable now, from `BuyableView.affordable`
- `available`: readable and parents owned, but too few points

Tests: each state, and the precedence order (installed > encrypted > locked > affordable > available).

Styles:
- installed: filled with the lane colour, plus a glow
- affordable: gold ring, slow pulse and a cost badge
- available: lane outline with a muted cost badge
- locked: dark with a padlock
- encrypted: animated static with `???`

The cost badge text comes from `BuyableView.costText`.

### Idea 2: inspector

- New `ui/widgets/firmwareInspector.ts`: a sticky right column on the Firmware tab.
- New pure view `ui/view/firmwareInspector.ts`, which builds `InspectorView` from the selected node:
  - icon, branch name (+ `PERSISTENT` for sleeve firmware), name, a status pill
  - the full description from `BuyableView`
  - **requires**: parents, with installed ✓
  - **unlocks next**: children, using `???` for encrypted ones
  - cost with the currency word, an INSTALL button, and a "why not" line ("you have N: earn more firmware points" or "install X first")
- Every value comes from `BuyableView` and the tree view; nothing is worked out again. An encrypted node shows only `???` and "unlocks as you play further", so no hidden text leaks (reveal rules).
- Selection is UI state: hovering previews, clicking pins. It is kept in the existing UI selection holder (`UiSelection`, or a sibling of it), not in game state. The default is the first affordable node, else the root of the first branch.
- INSTALL calls the same buy command the node click uses today (`ctx.activate` / `buy(id)`). One path; clicking a node now **selects** it instead of buying.
  - **This changes how buying works:** a click on a node no longer buys straight away. Mention it in the report and the changelog line.
  - On the Automation tab, a node click keeps buying as today, because there is no inspector there.
- Tests: the view for each state, encrypted hides text, the why-not lines, and the requires/unlocks lists.

### Idea 1: points readouts

The panel headers get big readouts: gold `N FIRMWARE POINTS` and magenta `N SLEEVE FIRMWARE POINTS`, muted at 0. The values come from the existing points text and values in the view. The tab badge shows the same count.

### Idea 4: branch headers

- Each branch card shows its name, a purpose line, `installed/total` and a segmented bar that fills from the left.
- Purpose lines are new text in `uiText` (`firmware.branchPurpose[branchId]`). The mockup's lines are **placeholders**; add them as they are and list them in the report so the user can rewrite them.
- `installed/total` counts only nodes the player can see. Encrypted nodes count in the total, because the bar shows that more exists, but their names are never shown. Check this against `REVEAL_RULES.md`, and if the rules say otherwise, count only revealed nodes.

### Idea 5: legend strip

A strip under the top bar with the five states and the hint "??? encrypted firmware unlocks as you play further". It replaces `skills.note`. Shown only on the Firmware tab.

### Idea 6: path highlight

Hovering a node adds a class to the edges and nodes on its path from the root, and a dashed outline to its children.
- The path comes from the tree view's `parents`, as a pure helper `pathToRoot(nodes, id)` (tested).
- The widget toggles classes on hover. There is no re-render and no work that grows with the tree on each frame; the cost is per hover.

### Idea 7: Sleeve Firmware panel

- Same node and lane styles as the main tree. The joined layout (`skillTreeJoin.ts`) stays, but its lanes become bands styled like the branch cards (lane colour, header with purpose, count and segments).
- The trunk node gets a `SLEEVE UP!` label under it, from `uiText`.
- Panel frame: magenta-tinted background, a `PERSISTENT` tag and "kept across re-sleeves", from `uiText`. That's true: sleeve skills are carried by the re-sleeve positive list. Verify against `CARRIED_OVER_*` before writing the text.
- The existing rule that sleeve firmware shows only its places until the first re-sleeve stays as it is.

### Idea 8: side-by-side cards

- The main branches sit in a grid of cards: `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`. More branches wrap to new rows automatically. A tree wider than its card scrolls sideways inside the card, so cards never overflow.
- Node size and spacing in cards: 38 px nodes, 54 px columns, 50 px rows. They are CSS custom properties, so a later layout can change them.
- **Growth is a known risk.** The user plans many more firmware. Record in `DECISIONS.md` that this layout is meant for the current tree size and should be revisited when branches get much wider or more numerous. Options to consider then: collapsible branches, zoom, or a tree that grows downwards.

### Idea 9: install animation

When a purchase succeeds, the widget adds an `install` class to the node: a fill sweeps through it, it scales up briefly, and a dash pulse runs along the edges to its children. The class is removed after the animation (`animationend`). It is CSS-only, triggered by the purchase, never per frame.

### Layout and files

- The Firmware tab becomes two columns: trees on the left (main panel, then Sleeve Firmware panel) and the inspector on the right (300 px, sticky).
- **Splits:**
  - `view/skillTree.ts` is at 9.2 KB: move node state into `view/firmwareNodeState.ts`
  - `widgets/skillTree.ts`: move edge drawing and path highlight into `widgets/skillTreeEdges.ts` if it passes about 10 KB
  - styles go in `src/ui/styles/firmware.css`, using the split from the main-screen plan, or a new file if that hasn't happened yet
- File names for new Firmware-tab-only code use "firmware". Shared tree code keeps "skillTree".

## Checks

- `npm run check` passes, with tests for the node states, the inspector view, `pathToRoot`, the branch counts and the "no 'skill' in player text" sweep. TSDoc with `Called by:` / `Calls:` lines; files under the size limits.
- Reveal: run the `docs/REVEAL_RULES.md` checklist for the inspector, the legend, the branch counts and the purpose lines. Encrypted firmware must never leak a name or description.
- Preview screenshots:
  - Firmware tab mid-game: some installed, some affordable, some encrypted
  - Firmware tab before the first re-sleeve: sleeve firmware masked
  - Automation tab: the node states there look right, and node clicks still buy
- Docs:
  - `docs/contexts/skills.md` and `docs/contexts/ui.md`
  - `docs/ARCHITECTURE.md` (new files)
  - `DESIGN.md` (names and tab description)
  - `docs/DECISIONS.md`: the rename decision (player-facing only), click selects and INSTALL buys, and the card layout with its growth caveat
  - the `CLAUDE.md` glossary line, then ask about `agents:sync`
- Commit subject (player-facing): **Rename Skills to Firmware and redesign the Firmware tab**. Put "node clicks now select; INSTALL buys" in the body and in the changelog entry.
- Layer-readiness check: the panels read the current sleeve's points as today, and the currency words come from `uiText`. No new singletons.
- Impact check: presentation and wording only. No firmware becomes better or worse.

## Open choices (defaults chosen; say if you want otherwise)

1. **Code keeps "skill".** Only players see Firmware; no save migration.
2. **Automation lanes count as firmware too** in player text.
3. **Skill shard and Skill transfer keep their names** for now, since they're about action levels, not firmware.
4. **A node click selects and INSTALL buys** on the Firmware tab. On the Automation tab a click still buys.
