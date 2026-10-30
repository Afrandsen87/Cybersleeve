# Reveal rules

Read this before adding or changing any stat, bar, button, purchase, skill, tree, tooltip or text. The rule: **nothing is shown before it matters.**

## Stats, bars, buttons and purchases

- A stat, bar, button or purchase stays hidden until something makes or changes it (`ui/view/statReveal.ts`, `ui/view/sleeveGate.ts`).
- Purchases are listed by base price via `sortByBasePrice` (`ui/view/buyableViews.ts`).

## Skills and skill trees

- A skill branch can be gated, data-driven. Example: the anonymity tree stays fully hidden until heat is revealed.
- A visible tree shows every node, icon and branch title. Only a skill's text reads `???` until it is readable: its `requires` gate is owned and every `parents` entry is readable (`ui/view/skillTree.ts`).
- A masked skill is never highlighted, clickable or purchasable.
- A parent is always in the same branch, and every parent-child pair is drawn as a line.
- A skill needs a unique icon, never a borrowed one. An item and the purchase that unlocks it may share a picture; a skill never may.

## Heat, items and the Augment button

- Heat (with ICE Rating) exists once an open action makes heat, or an Overclock unlock that makes heat is owned or shown in the action's square (`ui/view/squareRules.ts` owns "shown"; heat-making means `heatPerMinute > 0` or the action makes heat itself).
- The Inventory, an item group and each rarity row show only once that item and rarity has been seen (`Wallet.seenItems`) or is held. A drop upgrade alone shows nothing.
- The Augment cell on an action's square is empty until an owned buyable drops the schematic item (`ui/view/dropSource.ts`).

## Reveal checklist (every new or changed stat, skill, tree, buyable, tooltip or text)

1. Name the earliest moment the player can know each concept it mentions (heat, ICE Rating, crits, sleeve level, re-sleeving, items, ...).
2. Gate the thing on that moment: the node, its name, its description, its tip, and any text it feeds into.
3. Concept words must not leak through a tooltip, a description or a masked/locked state before then.
4. Add or extend a test (`content/contentSkillGates.test.ts`, `statReveal.test.ts`) that states the expected reveal point.
5. A tooltip, description or doc line never names content that does not exist yet (for example a "sixth action" when five exist). Describe the effect, not the future system.
