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
- A skill needs a unique icon, never a borrowed one.

## Reveal checklist (every new or changed stat, skill, tree, buyable, tooltip or text)

1. Name the earliest moment the player can know each concept it mentions (heat, ICE Rating, crits, sleeve level, re-sleeving, items, ...).
2. Gate the thing on that moment: the node, its name, its description, its tip, and any text it feeds into.
3. Concept words must not leak through a tooltip, a description or a masked/locked state before then.
4. Add or extend a test (`content/contentSkillGates.test.ts`, `statReveal.test.ts`) that states the expected reveal point.
