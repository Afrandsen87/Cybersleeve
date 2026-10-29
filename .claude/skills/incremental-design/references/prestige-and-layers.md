# Prestige and layers

**DRAFT.**

## What a good reset looks like
- **Trigger:** a clear, visible threshold or a player's choice, not a hidden timer. Cybersleeve: the player chooses when to re-sleeve.
- **Gain:** the reward grows with how far the run went, usually sub-linearly (a root or log of progress), so that resetting at ten times the progress is better but not ten times better. This creates the "when do I reset?" question, which is the point.
- **Loss:** the run's currency, purchases and levels. What persists is a positive list in code (`CARRIED_OVER_*`).
- **Speed-up:** the next run must reach the old wall faster. If it does not, the reset feels punitive.
- **Early game must change,** not only speed up: new automation arrives sooner, new choices exist, the order of purchases differs.

## Layering
- Each layer gets its own currency and its own decision. A layer that only multiplies the one below is a number, not a layer.
- Order: first prestige is cheap and frequent, the next costs many resets of the first, and so on. The player automates the lower layer before the next one opens.
- Reset-persistent upgrades are the main long-term power curve: they are bought with prestige currency and keep the player from feeling that a reset erased them.

## Cybersleeve's layers
- Layer 1: re-sleeving (sleeve XP, skills, re-sleeve skills).
- Later: several sleeves each replaying a copy of the previous lifetime; the Corporation producing synthetic sleeves; then cities, outposts, planets. The **copy** is the derivative scaling: more copies of a lifetime, not only a bigger multiplier.
- Overflow of numbers to Infinity (1e308) is itself a prestige trigger in the reference game (Derivative Clicker's infini-reset).

## Questions to answer for any new layer
1. What does the player do in this layer that they cannot do in the one below?
2. What is the currency, and what is the first thing it buys?
3. What is automated by the time this layer opens?
4. How does the lower layer's reset interact with it (what survives)?
