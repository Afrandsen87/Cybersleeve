# Context: heat

Heat: gain, tax, cooldown cycle, Moles, Legend speed-up.

Code: `src/core/heat/` (see `docs/contexts/_folders.md`). Text below is moved verbatim from the four main docs; headings name the source.

## Interface, state and config (S4)

- **`heatModel.ts` (P4, P5):** pure functions for the numbers the engine and the interface both need: `cycleMs(sleeve, legend)` (cooldown cycle before skills), `coolsNow(heat, amount)` (the cooldown waits for a whole amount), `heatTaxShare(heat, reduction, taxPerPoint, maxShare)` (share of income taxed, capped), `heatStopPoint(reduction, taxPerPoint, maxShare)` (heat at which the tax takes everything, `null` when it never does) and `moleSpeedFactor(bonusPerOrder, moles)` (Deep Cover). `cooldowns.ts` and `heatPace.ts` use them; `ui/view/sleeveView.ts` and `moleBonus.ts` only format their results (`heatModel.test.ts` checks the tip text equals the model values). `heatTaxFactor` (`heat.ts`) is the multiplier form of the same tax.
- **P15 (documented, no change):** heat per second (tick, `ActionRunner` slices) and heat per run (`runBatch`, `chargeRunHeat`) stay separate: one is time based, the other run based. A shared `heatGained` function is only worth adding if a third heat source appears.
- **Config variables:** `sleeve.heatCooldownMs`, `heatCooldownAmount`, `heatTaxPerPoint`, `legendHeatSpeedup`, `iceRatingOrdersForFullReduction`, `iceRatingReductionExponent`; skills `heatCooldownSpeed`, `idleHeatCooldown`, `moleAggregation`, `heatTaxCap`, `backChannel` (see `docs/CONFIG.md`).

## Decisions (from docs/DECISIONS.md)


*Group: Decided 2026-10-26 (by the user, Overclock, Focus and Burn leads)*
- **Heat may be a fraction of a point, but it only cools in whole points**: the cooldown bar waits while there is less than 1 heat. Burn leads and Overclock produce the fractions.

*Group: Decided 2026-10-27 (by the user, new Anonymity skills)*
- **Scorched Earth:** a lead takes its 5%, then a flat 1 point more (heat floors at 0). `BurnLeads.leadsNeeded` is the closed form Auto Burn uses, so Auto Burn does not use more leads than needed.

*Group: Decided 2026-10-27 (by the user, new Anonymity skills)*
- **Quiet Hours:** "idle" means no action is IN PROGRESS (`running`); a manual action that finished and waits is not in progress. Factor 5 is a placeholder, "might need to be more". **Undercover** adds Grow network (running without Overclock) to what counts as idle. The idle check is read at the start of each slice, like the rest of the cooling.

*Group: Decided 2026-10-27 (by the user, new Anonymity skills)*
- **Deep Cover:** Moles are never spent; heat cools `1.05 ^ log10(Moles)` times as fast (multiplicative, 5% per order of magnitude, placeholder); the Moles' own cooldown boost is dropped while it is owned. It is readable only once Back Channel Deals is owned.

*Group: Decided 2026-10-27 (by the user, new Anonymity skills)*
- **Blackout:** the user rejected "heat does nothing" and chose 50%. Read as a CAP: the heat tax takes at most half of node income. (The other reading, halving the tax per point, was not chosen; say so if that is what was meant.) ICE Rating keeps its job below the cap; the user expects to find another use for it later.

*Group: Decided 2026-10-30 (by the user)*
- **Auto Burn switches heat-making Overclocks and Auto-runs** (see `contexts/automation.md`). "Makes heat" is the one predicate in `core/heat/heatMakers.ts` (`actionMakesHeat`, `overclockMakesHeat`); the stat reveal rule in `ui/view/statReveal.ts` calls it instead of keeping its own copy.
- **Overclock heat on Push malware is chance only:** Overclock multiplies the chance a run makes heat by 4 (10% to 40%); the heat per run is unchanged. The skill Obfuscation (`overclockHeatChanceFactor`) halves that chance again (20%). *Decided 2026-10-30 (by the user):* x4, was x2. ICE Rating removes `(orders / 100) ^ 0.75` of the heat effect (a gentle curve of its orders of magnitude, 100% at 1e100; see DECISIONS 2026-10-31).
- **Heat shows once an Overclock that makes heat is on offer.** The reveal rule (`ui/view/statReveal.ts`) no longer waits for the Overclock to be owned: it also counts an Overclock unlock that is shown in the action's square (Auto-run owned, `ui/view/squareRules.ts` `overclockOnOffer`, the one owner of that predicate, also used by the square) when its overclock makes heat (`heatPerMinute > 0`, or the action makes heat itself). Heat and ICE Rating still appear together.
