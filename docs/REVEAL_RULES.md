# Reveal rules

Read this before adding or changing any stat, bar, button, purchase, skill, tree, tooltip or text. The rule: **nothing is shown before it matters.**

## The reveal ledger (what was shown stays shown)

- **Reveal ledger** (`wallet.revealed`, `economy/revealLedger.ts`): a set of typed keys `stat:<id>`, `tab:<id>`, `skill:<id>`, `buyable:<id>` for everything the player has ever been shown. Only grows; survives a re-sleeve (`CARRIED_OVER_WALLET_FIELDS`). Queries never write it: each view build uses one `RevealTracker` (`ui/view/revealTracker.ts`) that says "shown" when the key is noted or the natural rule says so now, and collects keys that are new into `ViewModel.newlyRevealed`; `ui/dom.ts` then calls the engine command `noteRevealed(keys)` only when that list is not empty. Unknown and repeated keys are ignored (ids are resolved against the content, not a branch).
- A noted **stat** is never hidden again (`isStatHidden`), a noted **tab** stays visible (`tabsView`), a noted **skill** stays readable but is `locked` (faded) while its gates are unmet (`skillTree.ts`), a noted **purchase** is shown greyed and cannot be bought (`BuyableView.gated`) while `Shop.isAvailable` is false. Buying still goes only through `isAvailable`.
- A new revealable thing: pass its natural rule through `RevealTracker.reveals(kind, id, natural)` and add its id to the known keys (`REVEALABLE_STATS`, `TAB_IDS`; skills and purchases resolve by buyable id). The wallet invariant fails on a key that names nothing.
- **Tab blink** (`ui/view/tabAttention.ts`): Skills (skill + sleeve skill points) and Automation blink while points earned exceed points seen; opening the tab marks them seen; a re-sleeve that lowers earned lowers seen; after a reload a tab blinks only for unspent points. UI memory, not saved.

## Stats, bars, buttons and purchases

- A stat, bar, button or purchase stays hidden until something makes or changes it (`ui/view/statReveal.ts`, `ui/view/sleeveGate.ts`).
- Purchases are listed by base price via `sortByBasePrice` (`ui/view/buyableViews.ts`).

## Skills and skill trees

- The Skills tab shows once a skill point exists. Inside it every sleeve skill tree (every branch) is always visible; no branch is hidden, but the texts of a branch with a reveal stat (Anonymity: heat) read ??? until it is revealed (`ui/view/branchMask.ts`). The sleeve skill trees show once a sleeve skill point has been earned.
- A visible tree shows every node, icon and branch title. Only a skill's text reads `???` until it is readable: its `requires` gate is owned and every `parents` entry is readable (`ui/view/skillTree.ts`). In the sleeve skill tree (`parentsMustBeOwned`) every parent must be OWNED instead, so a skill reads ??? until the one before it is bought; Sleeve Up! (no parents) is readable as soon as the tree shows.
- A masked skill is never highlighted, clickable or purchasable.
- A parent is always in the same branch, or in a trunk branch (one parentless skill alone, Sleeve Up!); every parent-child pair is drawn as a line.
- A skill needs a unique icon, never a borrowed one. An item and the purchase that unlocks it may share a picture; a skill never may.

## Heat, items and the Augment button

- Heat (with ICE Rating) exists once an open action makes heat, or an Overclock unlock that makes heat is owned or shown in the action's square (`ui/view/squareRules.ts` owns "shown"; heat-making is `overclockMakesHeat` in `core/heat/heatMakers.ts`: `heatPerMinute > 0` or the action makes heat itself).
- Auto Burn (Automation tab): each switch, threshold input and the reserve input stays hidden until the lane skill that adds it is owned (`AutoBurnControls.stepOwned`); the Burn lead tile is a click that uses a lead until the lane's first skill makes it a toggle.
- The Inventory, an item group and each rarity row show only once that item and rarity has been seen (`Wallet.seenItems`) or is held. A drop upgrade alone shows nothing.
- The Inventory rarity legend includes only rarities with a shown sellable row; kept-only rows reveal no sale tier.
- The Augment cell on an action's square is empty until an owned buyable drops the schematic item (`ui/view/dropSource.ts`).

## Reveal checklist (every new or changed stat, skill, tree, buyable, tooltip or text)

1. Name the earliest moment the player can know each concept it mentions (heat, ICE Rating, crits, sleeve level, re-sleeving, items, ...).
2. Gate the thing on that moment: the node, its name, its description, its tip, and any text it feeds into.
3. Concept words must not leak through a tooltip, a description or a masked/locked state before then.
4. Add or extend a test (`content/contentSkillGates.test.ts`, `statReveal.test.ts`) that states the expected reveal point.
5. A tooltip, description or doc line never names content that does not exist yet (for example a "sixth action" when five exist). Describe the effect, not the future system.
