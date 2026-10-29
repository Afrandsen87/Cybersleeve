# Cybersleeve decisions log

Moved out of CLAUDE.md (2026-10-27) so the standing instructions stay small. The code and `DESIGN.md` describe what the game is now; this file records what the user decided and why. Read the relevant entry before changing that mechanic. Standing rules distilled from it are in CLAUDE.md.

Decided 2026-10-24 (by the user):

Decided 2026-10-24 (by the user, after the first full review):

Decided 2026-10-25 (by the user, after the second review):

Decided 2026-10-25 (by the user, after testing):

Decided 2026-10-25 (by the user, access ladder):

Decided 2026-10-25 (by the user, items):

Decided 2026-10-25 (by the user, after the performance review):

Decided 2026-10-25 (by the user, critical success):

Decided 2026-10-26 (by the user, Overclock, Focus and Burn leads):

Decided 2026-10-25 (by the user, icons):

Decided 2026-10-25 (by the user, Zero-days): Push malware gets the buyable *Zero-day exploits* (10,000 credits, placeholder), which lets its runs drop the item *Zero-day* (5%; no rarity, like the Burn lead; `sellable: false`). Clicking the Zero-day tile in the Inventory is a **toggle**: while on, every completed Push malware run uses one Zero-day up and is a critical success; the toggle switches itself off when none is left and cannot be switched on with none held. A batch of runs is settled in closed form (`min(runs, held)` guaranteed critical, the rest roll the normal chance). Configured by `items.zeroDay` (`{itemId, actionId}`); unit `core/zeroDays.ts`; the toggle is saved as `zeroDaysOn` and resets on re-sleeve.

Decided 2026-10-25 (by the user, Push malware crits): **Persistence** (Push malware, 500,000 credits, one time) triples what its critical successes do: both the reward and the action XP multipliers of the action's critical runs (effect `criticalBoost`; reading of "triples the critical success effect", confirm if only one was meant). **Ransomware** (Push malware, 100,000 placeholder) makes every critical Push malware run bank one guaranteed critical success for Grow network, spent by Grow network's next completed runs (effect `criticalLink`, state `bankedCriticals`, unit `core/criticalLinks.ts`). **Obfuscation** is a one-point skill that lowers Push malware's Overclock heat per run factor from 3 to 2 (effect `overclockHeatFactor`). Zero-day exploits cost 5,000 credits.

Working conventions (in use):

Decided 2026-10-26 (by the user, Kill servers buyables): Kill servers gets five buyables and an Overclock. Prices (placeholders) climb in this order, each a few orders of magnitude above the one before: Cascade failure 1e10, Credit Siphon 1e12, Decommission protocol 1e14, Kill chain 1e17, Black box recorder 1e20. The Credit Siphon icon is the stylised credits chip with speed stripes behind it.

Decided 2026-10-26 (by the user, heat cooling): the skill **Purge Protocol** (1 skill point, placeholder) makes each heat cooldown cycle remove 1 more heat per SLEEVE level of Build Legend (effect `heatCooldownAmountFromSleeveLevel`, stat `heatCooldownAmount`). Cycles do not get faster: the cooldown stays in discrete steps, so it takes effect at once when unlocked. It is meant as a late-stage skill, part of removing the heat tax. A paid "Launder credits" cooling toggle is wanted later, tied into another system; not built.

Decided 2026-10-26 (by the user, re-sleeve points and synthetic sleeves): a re-sleeve gives one **re-sleeve point** (`resleeve.pointsPerResleeve`), spent on a **tree of re-sleeve skills** in its own group on the Skills tab (`currency: 'resleevePoints'`, `requires` draw the tree). Re-sleeve skills are kept through re-sleeving (`CARRIED_OVER_BUYABLE_CURRENCIES`), ordinary skills still reset. **Every sleeve-run is written down at re-sleeve, whatever skills are owned** (`GameState.runs`: the sleeve's OWN credits per second after the heat tax, never including synthetic income so nothing compounds, and the total of its action levels); a **Stats** tab lists the latest 10. The tree: **Sleeve Euphoria** (every action level needs `1 - 0.5^log10(that action's sleeve level)` less XP: 50% at level 10, 75% at 100; multiplies with flat reductions and is outside their cap), **Synthetic Sleeves** and **Incorporation** (both need Euphoria; Incorporation is a placeholder that does nothing). **Synthetic sleeves:** buying the skill gives one at once, copied from the last finished run, and each later re-sleeve gives one more, copied from the run that just ended; runs before the purchase are never copied; each sleeve keeps its own run's numbers. A sleeve earns `its run's credits per second x min(1, current action level total / that run's total)`, untaxed by heat and not multiplied by the credit lever again. The Network widget shows exactly two lines for them: the number of sleeves and their total credits per second. Upgrades that change the base behaviour (they stop being only a speed-up) are expected later.

Decided 2026-10-26 (by the user, after the full review):

Decided 2026-10-27 (by the user, Corporation and item tuning):

Decided 2026-10-27 (by the user, new Anonymity skills):

Decided 2026-10-27 (by the user, more re-sleeve skills):

Decided 2026-10-28 (by the user, balance and design knowledge):


## Where the entries are

Every decision entry now lives in the doc of the context it decides (section "Decisions"). Read that entry before changing the mechanic.

| Context | Entries |
|---|---|
| [actions](contexts/actions.md) | 11 |
| [app](contexts/app.md) | 16 |
| [automation](contexts/automation.md) | 1 |
| [config](contexts/config.md) | 2 |
| [corporation](contexts/corporation.md) | 3 |
| [crits](contexts/crits.md) | 2 |
| [economy](contexts/economy.md) | 1 |
| [effects](contexts/effects.md) | 6 |
| [engine](contexts/engine.md) | 2 |
| [general](contexts/general.md) | 2 |
| [heat](contexts/heat.md) | 5 |
| [items](contexts/items.md) | 6 |
| [kernel](contexts/kernel.md) | 4 |
| [resleeve](contexts/resleeve.md) | 6 |
| [save](contexts/save.md) | 2 |
| [skills](contexts/skills.md) | 4 |
| [synth](contexts/synth.md) | 1 |
| [ui](contexts/ui.md) | 8 |

*Group: Decided 2026-10-29/30 (by the user, S8 state and save)*
- **Wallet / sleeve split, save v7.** `GameState = { wallet, sleeve }`. Wallet: credits, inventory, runs, synths, lastLifePurchases, automation (unchanged; a rework is planned), the corporation, and new all-time peak statistics. Sleeve: purchases, per-action state, network, heat, ICE Rating, Legend, Moles, `peakCredits`/`peakNetwork` (they drive the purchase reveal), the toggles, `keyToggles`. One migration function (flat v6 in, nested v7 out); only v7 is read afterwards. In memory there is one `state.sleeve` and one `wallet.corporation`; the SAVE already keeps them as keyed maps with one entry (`sleeves.main`, `wallet.corporations.main`), so a second sleeve or corporation needs no new save version. No assignment rule, no UI. The pre-migration save text is kept under `cybersleeve.save.premigration` until the next successful v7 save.
