# Economy and pacing

**DRAFT.** General genre knowledge; numbers are typical, not Cybersleeve's.

## The basic curve
- Cost of the n-th copy = base x growth^n. Typical growth is 1.07 to 1.15 per copy for "building" style purchases (Cookie Clicker uses about 1.15). Higher growth (x10, x100, x1000 per copy, as Access upgrade uses) is for rare, strong, capped-feeling purchases.
- Output per copy is roughly linear. Milestones (owning 10, 25, 50, 100...) double or triple a purchase's output. Milestones are what make the player keep buying past the point where the next copy alone is poor value.
- **Payback time** = price / added income per second. Early purchases pay back in seconds, mid game in minutes, late game in tens of minutes. A purchase whose payback is far longer than its neighbours' needs a different reason to be bought (a gate, a new system), or it is dead.

## Sanity-checking a new price (do this in the proposal)
1. Find the nearest existing purchases of the same currency (`content/buyables/<action>.ts`) and list their prices.
2. Estimate income at the moment the new thing is revealed (reveal is within `reveal.buyableOrders` of the peak held).
3. State time to afford, and payback time. If either is more than about 10x its neighbours, say why.
4. Check what it does to the **next** wall: it should move the wall, not remove it.

## Multipliers
- Additive inside a source, multiplicative between sources. Many small additive sources feel like steady progress; a few big multiplicative ones feel like events.
- Too many independent multipliers makes the game a product of numbers nobody can reason about. Each multiplier needs a name and a visible reason (this is the "no global multiplier" rule).
- Diminishing returns (concave curves, the Hacking Proficiency knee) are used to stop one lever from dominating. Prefer a visible knee over a hidden cap.

## Walls and bursts
- A wall is a stretch where the best available purchase takes noticeably long. Walls are fine and expected; they must always have a visible way through (a purchase, a skill point, a re-sleeve).
- A burst follows a wall: a purchase that raises income several-fold. Space bursts so that the player has something to look forward to every few minutes early on and every tens of minutes later.

## Randomness
- Drops and crits are batched in closed form. Variance should be low at scale (binomial over many runs) so that outcomes are predictable for the player and testable.
